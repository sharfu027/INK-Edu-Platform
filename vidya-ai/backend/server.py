from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import io
import uuid
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI(title="Vidya AI - Study Assistant Platform")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Models ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    standard: str = "10th"
    subject: str = "General"
    syllabus: str = "CBSE"
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    language: str = "English"
    model: str = "gpt-5.2"


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class PaperRequest(BaseModel):
    standard: str
    subject: str
    syllabus: str
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    language: str = "English"
    topic: Optional[str] = None
    total_marks: int = 80
    duration_minutes: int = 180
    mcq_count: int = 10
    two_mark_count: int = 5
    five_mark_count: int = 4
    ten_mark_count: int = 2
    include_coding: bool = False
    model: str = "gpt-5.2"
    pattern: Literal["Standard", "Techno"] = "Standard"
    math_track_a_topic: Optional[str] = None
    math_track_b_topic: Optional[str] = None
    physics_topic: Optional[str] = None
    chemistry_topic: Optional[str] = None

class PaperResponse(BaseModel):
    id: str
    title: str
    paper: str
    answer_key: str
    created_at: str


class DiagramRequest(BaseModel):
    prompt: str
    standard: str = "10th"
    subject: str = "Biology"
    language: str = "English"


class DiagramResponse(BaseModel):
    id: str
    prompt: str
    image_base64: str
    mime_type: str
    created_at: str


# ---------- Education Options ----------
EDUCATION_OPTIONS = {
    "standards": [
        "Nursery", "LKG", "UKG",
        "1st", "2nd", "3rd", "4th", "5th",
        "6th", "7th", "8th", "9th", "10th",
        "PUC 1st Year", "PUC 2nd Year",
        "ITI", "Diploma 1st Year", "Diploma 2nd Year", "Diploma 3rd Year",
        "Degree 1st Year", "Degree 2nd Year", "Degree 3rd Year",
        "Engineering 1st Year", "Engineering 2nd Year",
        "Engineering 3rd Year", "Engineering 4th Year",
        "MBBS", "Law", "MBA", "MA", "MSc",
        "MTech", "MPhil", "PhD",
    ],
    "subjects": [
        "Mathematics", "Physics", "Chemistry", "Biology", "Science",
        "English", "Social Science", "History", "Geography", "Civics",
        "Economics", "Commerce", "Accountancy", "Business Studies",
        "Computer Science", "Coding & Programming", "Data Structures",
        "Algorithms", "Artificial Intelligence", "Machine Learning",
        "Mechanical Engineering", "Civil Engineering", "Electrical Engineering",
        "Electronics", "Anatomy", "Physiology", "Pharmacology",
        "Constitutional Law", "Criminal Law", "Hindi", "Kannada", "Sanskrit",
        "Art & Craft", "Music", "Physical Education",
    ],
    "syllabuses": [
        "CBSE", "ICSE", "State Board", "NCERT",
        "Karnataka State", "Maharashtra State", "Tamil Nadu State",
        "VTU", "Anna University", "JNTU",
        "NEET", "JEE Main", "JEE Advanced", "GATE", "UPSC", "CAT", "UGC NET",
    ],
    "languages": [
        "English", "Hindi", "Kannada", "Tamil", "Telugu",
        "Marathi", "Bengali", "Gujarati", "Malayalam", "Punjabi", "Urdu",
    ],
    "difficulties": ["Easy", "Medium", "Hard"],
}


# ---------- Helpers ----------
def make_system_prompt(standard, subject, syllabus, difficulty, language):
    return (
        f"You are Vidya AI, an expert academic tutor for Indian and global students. "
        f"Provide accurate, pedagogically-sound answers tailored to this context:\n"
        f"- Standard / Level: {standard}\n"
        f"- Subject: {subject}\n"
        f"- Syllabus / Board: {syllabus}\n"
        f"- Difficulty: {difficulty}\n"
        f"- Language: Respond primarily in {language}. Keep technical terms in English when appropriate.\n\n"
        f"Rules:\n"
        f"1. Match explanation depth to the student's level.\n"
        f"2. Use simple examples, analogies, and step-by-step reasoning.\n"
        f"3. For math/science, show working clearly with numbered steps.\n"
        f"4. For coding, give clean, commented code with explanation.\n"
        f"5. Use markdown formatting (headings, bullets, code blocks) for readability.\n"
        f"6. If the topic is out of syllabus, mention it briefly then still help."
    )


def make_techno_paper_prompt(req: PaperRequest):
    total_q = req.mcq_count or 60
    q_per_sec = total_q // 4
    fbt_per_sec = q_per_sec // 3
    straight_per_sec = q_per_sec - fbt_per_sec
    
    m_a_straight_end = straight_per_sec
    m_b_straight_start = m_a_straight_end + 1
    m_b_straight_end = m_a_straight_end + straight_per_sec
    p_straight_start = m_b_straight_end + 1
    p_straight_end = m_b_straight_end + straight_per_sec
    c_straight_start = p_straight_end + 1
    c_straight_end = p_straight_end + straight_per_sec
    
    fbt_m_a_start = c_straight_end + 1
    fbt_m_a_end = c_straight_end + fbt_per_sec
    fbt_m_b_start = fbt_m_a_end + 1
    fbt_m_b_end = fbt_m_a_end + fbt_per_sec
    fbt_p_start = fbt_m_b_end + 1
    fbt_p_end = fbt_m_b_end + fbt_per_sec
    fbt_c_start = fbt_p_end + 1
    fbt_c_end = total_q
    fbt_c_count = fbt_c_end - fbt_c_start + 1

    mark_per_question = req.total_marks / total_q if total_q > 0 else 1.0

    return (
        f"Generate a complete examination question paper following the 'Techno Objective Test' multi-subject pattern. "
        f"Output STRICT JSON with two keys: "
        f'"paper" (the question paper markdown) and "answer_key" (the answer key markdown).\n\n'
        f"Specifications:\n"
        f"- Standard: {req.standard}\n"
        f"- Syllabus: {req.syllabus}\n"
        f"- Difficulty: {req.difficulty}\n"
        f"- Language: {req.language}\n"
        f"- Total marks: {req.total_marks}\n"
        f"- Duration: {req.duration_minutes} minutes\n\n"
        f"Syllabus coverage and topics:\n"
        f"- Mathematics (Track A) Topic: {req.math_track_a_topic or 'General Algebra & Numbers'}\n"
        f"- Mathematics (Track B) Topic: {req.math_track_b_topic or 'General Arithmetic & Mensuration'}\n"
        f"- Physics Topic: {req.physics_topic or 'General Force & Light'}\n"
        f"- Chemistry Topic: {req.chemistry_topic or 'General Matter & Changes'}\n\n"
        f"Structure required (Strictly numbered Q1 to Q{total_q}, all questions are 4-option MCQs/Straight Objective type worth {mark_per_question:.2f} mark each):\n"
        f"- **Mathematics Track - A**: Questions 1 to {m_a_straight_end} ({straight_per_sec} questions)\n"
        f"- **Mathematics Track - B**: Questions {m_b_straight_start} to {m_b_straight_end} ({straight_per_sec} questions)\n"
        f"- **Physics**: Questions {p_straight_start} to {p_straight_end} ({straight_per_sec} questions)\n"
        f"- **Chemistry**: Questions {c_straight_start} to {c_straight_end} ({straight_per_sec} questions)\n"
        f"- **Techno Foundation Examination (FBT) Pattern**:\n"
        f"  - Math (A): Questions {fbt_m_a_start} to {fbt_m_a_end} ({fbt_per_sec} questions)\n"
        f"  - Math (B): Questions {fbt_m_b_start} to {fbt_m_b_end} ({fbt_per_sec} questions)\n"
        f"  - Physics: Questions {fbt_p_start} to {fbt_p_end} ({fbt_per_sec} questions)\n"
        f"  - Chemistry: Questions {fbt_c_start} to {fbt_c_end} ({fbt_c_count} questions)\n\n"
        f"Formatting:\n"
        f"- Use markdown with headings: `## Mathematics Track - A`, `## Mathematics Track - B`, `## Physics`, `## Chemistry`, and `## Techno Foundation Examination (FBT)`.\n"
        f"- Number questions sequentially from 1 to {total_q} across the entire paper.\n"
        f"- Answer key must mirror the question numbers 1 to {total_q} and give concise correct options (A, B, C, D) with short explanations.\n\n"
        f'Return only valid JSON like: {{"paper": "...", "answer_key": "..."}}'
    )


def make_paper_prompt(req: PaperRequest):
    topic_line = f"Focus topic: {req.topic}\n" if req.topic else ""
    coding_line = (
        f"- Coding / Programming Section: Include 2 coding problems with full solution.\n"
        if req.include_coding
        else ""
    )
    return (
        f"Generate a complete examination question paper. Output STRICT JSON with two keys: "
        f'"paper" (the question paper markdown) and "answer_key" (the answer key markdown).\n\n'
        f"Specifications:\n"
        f"- Standard: {req.standard}\n"
        f"- Subject: {req.subject}\n"
        f"- Syllabus: {req.syllabus}\n"
        f"- Difficulty: {req.difficulty}\n"
        f"- Language: {req.language}\n"
        f"{topic_line}"
        f"- Total marks: {req.total_marks}\n"
        f"- Duration: {req.duration_minutes} minutes\n\n"
        f"Sections required (each clearly labelled, with marks distribution):\n"
        f"- Section A: {req.mcq_count} MCQ questions (1 mark each) with 4 options labelled A, B, C, D.\n"
        f"- Section B: {req.two_mark_count} short-answer questions (2 marks each).\n"
        f"- Section C: {req.five_mark_count} medium-answer questions (5 marks each).\n"
        f"- Section D: {req.ten_mark_count} long-answer questions (10 marks each).\n"
        f"{coding_line}\n"
        f"Formatting:\n"
        f"- Use markdown with proper headings (## Section A, ## Section B...).\n"
        f"- Number questions sequentially within each section.\n"
        f"- Answer key must mirror the question numbering and give concise correct answers.\n"
        f"- Stay strictly within the {req.syllabus} curriculum for {req.standard} {req.subject}.\n\n"
        f'Return only valid JSON like: {{"paper": "...", "answer_key": "..."}}'
    )


async def call_llm(system_msg: str, user_text: str, session_id: str, model: str = "gpt-5.2") -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("openai", model)
    reply = await chat.send_message(UserMessage(text=user_text))
    return reply


def build_pdf(
    title: str,
    paper_markdown: str,
    answer_key_markdown: str,
    pattern: str = "Standard",
    request_data: Optional[dict] = None
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "T", parent=styles["Title"], fontSize=18, leading=22, alignment=TA_CENTER,
        textColor="#000000", spaceAfter=14,
    )
    date_style = ParagraphStyle(
        "D", parent=styles["Normal"], fontSize=10, leading=12, alignment=TA_CENTER,
        textColor="#475569", spaceAfter=14,
    )
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, textColor="#000000")
    body = ParagraphStyle("B", parent=styles["BodyText"], fontSize=11, leading=15)
    
    story = [Paragraph(title, title_style)]
    
    if pattern == "Techno":
        # Centered examination date
        current_date_str = datetime.now().strftime("%d-%m-%Y")
        story.append(Paragraph(f"Examination Date: {current_date_str}", date_style))
    
    story.append(Spacer(1, 0.3 * cm))

    # Helper function to generate Paragraph inside cells
    table_cell_style = ParagraphStyle("TC", parent=styles["Normal"], fontSize=9, leading=11)
    table_header_style = ParagraphStyle("TH", parent=styles["Normal"], fontSize=9, leading=11, fontName="Helvetica-Bold")
    
    def make_cell(text, is_header=False):
        style = table_header_style if is_header else table_cell_style
        return Paragraph(text, style)

    if pattern == "Techno" and request_data:
        # Table 1: Syllabus Coverage
        syllabus_data = [
            [make_cell("Subject / Track", True), make_cell("Syllabus / Focus Topic", True)],
            [make_cell("Mathematics Track - A"), make_cell(request_data.get("math_track_a_topic") or "General Algebra & Numbers")],
            [make_cell("Mathematics Track - B"), make_cell(request_data.get("math_track_b_topic") or "General Arithmetic & Mensuration")],
            [make_cell("Physics"), make_cell(request_data.get("physics_topic") or "General Force & Light")],
            [make_cell("Chemistry"), make_cell(request_data.get("chemistry_topic") or "General Matter & Changes")],
        ]
        syllabus_table = Table(syllabus_data, colWidths=[5 * cm, 12 * cm])
        syllabus_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        story.append(Paragraph("Syllabus Coverage", h2))
        story.append(Spacer(1, 0.1 * cm))
        story.append(syllabus_table)
        story.append(Spacer(1, 0.4 * cm))

        # Table 2: Marks/Question Distribution
        total_q = request_data.get("mcq_count", 60) or 60
        total_m = request_data.get("total_marks", 60) or 60
        
        q_per_sec = total_q // 4
        fbt_per_sec = q_per_sec // 3
        straight_per_sec = q_per_sec - fbt_per_sec
        
        m_a_straight_end = straight_per_sec
        m_b_straight_start = m_a_straight_end + 1
        m_b_straight_end = m_a_straight_end + straight_per_sec
        p_straight_start = m_b_straight_end + 1
        p_straight_end = m_b_straight_end + straight_per_sec
        c_straight_start = p_straight_end + 1
        c_straight_end = p_straight_end + straight_per_sec
        
        fbt_m_a_start = c_straight_end + 1
        fbt_m_a_end = c_straight_end + fbt_per_sec
        fbt_m_b_start = fbt_m_a_end + 1
        fbt_m_b_end = fbt_m_a_end + fbt_per_sec
        fbt_p_start = fbt_m_b_end + 1
        fbt_p_end = fbt_m_b_end + fbt_per_sec
        fbt_c_start = fbt_p_end + 1
        fbt_c_end = total_q
        fbt_c_count = fbt_c_end - fbt_c_start + 1
        
        marks_per_sec = (q_per_sec * total_m) // total_q if total_q > 0 else 0
        marks_last_sec = total_m - (3 * marks_per_sec)

        dist_headers = [
            "Subject / Section",
            f"Straight Objective\n(Q1-{c_straight_end})",
            f"FBT\n(Q{fbt_m_a_start}-{total_q})",
            "Total Questions",
            "Total Marks"
        ]
        dist_rows = [
            ["Mathematics Track - A", f"{straight_per_sec} (Q1-{m_a_straight_end})", f"{fbt_per_sec} (Q{fbt_m_a_start}-{fbt_m_a_end})", f"{q_per_sec}", f"{marks_per_sec}"],
            ["Mathematics Track - B", f"{straight_per_sec} (Q{m_b_straight_start}-{m_b_straight_end})", f"{fbt_per_sec} (Q{fbt_m_b_start}-{fbt_m_b_end})", f"{q_per_sec}", f"{marks_per_sec}"],
            ["Physics", f"{straight_per_sec} (Q{p_straight_start}-{p_straight_end})", f"{fbt_per_sec} (Q{fbt_p_start}-{fbt_p_end})", f"{q_per_sec}", f"{marks_per_sec}"],
            ["Chemistry", f"{straight_per_sec} (Q{c_straight_start}-{c_straight_end})", f"{fbt_c_count} (Q{fbt_c_start}-{fbt_c_end})", f"{q_per_sec}", f"{marks_last_sec}"],
            ["Total", f"{4 * straight_per_sec}", f"{3 * fbt_per_sec + fbt_c_count}", f"{total_q}", f"{total_m}"]
        ]
        
        dist_data = []
        dist_data.append([make_cell(h.replace("\n", "<br/>"), True) for h in dist_headers])
        for row in dist_rows[:-1]:
            dist_data.append([make_cell(cell) for cell in row])
        dist_data.append([make_cell(cell, True) for cell in dist_rows[-1]])
        
        dist_table = Table(dist_data, colWidths=[4.5 * cm, 3.2 * cm, 3.2 * cm, 3.1 * cm, 3 * cm])
        dist_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#F8FAFC")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        story.append(Paragraph("Question & Marks Distribution", h2))
        story.append(Spacer(1, 0.1 * cm))
        story.append(dist_table)
        story.append(Spacer(1, 0.5 * cm))

    def add_block(text):
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                story.append(Spacer(1, 0.15 * cm))
                continue
            if line.startswith("## "):
                story.append(Spacer(1, 0.2 * cm))
                story.append(Paragraph(line[3:], h2))
            elif line.startswith("# "):
                story.append(Paragraph(line[2:], title_style))
            else:
                safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(safe, body))

    add_block(paper_markdown)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Answer Key", title_style))
    add_block(answer_key_markdown)

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Vidya AI Backend - Ready"}


@api_router.get("/options")
async def get_options():
    return EDUCATION_OPTIONS


@api_router.get("/lessons")
async def get_lessons(standard: str, subject: str):
    from ncert_data import NCERT_LESSONS
    std_key = standard.strip()
    subj_key = subject.strip()
    
    if std_key not in NCERT_LESSONS:
        return {"lessons": []}
        
    std_lessons = NCERT_LESSONS[std_key]
    
    # Direct match (e.g. Mathematics, Physics, Chemistry, Biology)
    if subj_key in std_lessons:
        return {"lessons": std_lessons[subj_key]}
        
    # If subject is "Science", merge Physics, Chemistry, Biology chapters
    if subj_key.lower() == "science":
        merged = []
        if "Physics" in std_lessons:
            merged.extend(std_lessons["Physics"])
        if "Chemistry" in std_lessons:
            merged.extend(std_lessons["Chemistry"])
        if "Biology" in std_lessons:
            merged.extend(std_lessons["Biology"])
        return {"lessons": merged}
        
    return {"lessons": []}


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    system_msg = make_system_prompt(
        req.standard, req.subject, req.syllabus, req.difficulty, req.language
    )
    try:
        reply = await call_llm(system_msg, req.message, session_id, req.model)
    except Exception as e:
        logger.exception("LLM chat failed")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    # Persist
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_message": req.message,
        "ai_reply": reply,
        "context": {
            "standard": req.standard, "subject": req.subject,
            "syllabus": req.syllabus, "difficulty": req.difficulty,
            "language": req.language,
        },
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(doc)
    return ChatResponse(session_id=session_id, reply=reply)


@api_router.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    msgs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"session_id": session_id, "messages": msgs}


@api_router.post("/paper/generate", response_model=PaperResponse)
async def generate_paper(req: PaperRequest):
    if req.pattern == "Techno":
        if req.mcq_count == 10:
            req.mcq_count = 60
        if req.total_marks == 80:
            req.total_marks = 60
        if req.duration_minutes == 180:
            req.duration_minutes = 90
        if req.two_mark_count == 5:
            req.two_mark_count = 0
        if req.five_mark_count == 4:
            req.five_mark_count = 0
        if req.ten_mark_count == 2:
            req.ten_mark_count = 0

    session_id = str(uuid.uuid4())
    system_msg = (
        "You are Vidya AI, an expert exam paper designer for Indian boards & universities. "
        "Always respond with valid JSON only, no markdown fences. Stay strictly within syllabus."
    )
    if req.pattern == "Techno":
        prompt = make_techno_paper_prompt(req)
    else:
        prompt = make_paper_prompt(req)
    try:
        reply = await call_llm(system_msg, prompt, session_id, req.model)
    except Exception as e:
        logger.exception("Paper generation failed")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    # Parse JSON; tolerate code fences
    raw = reply.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        data = json.loads(raw)
        paper_md = data.get("paper", "")
        answer_md = data.get("answer_key", "")
    except Exception:
        # Fallback: treat whole reply as paper
        paper_md = reply
        answer_md = ""

    paper_id = str(uuid.uuid4())
    if req.pattern == "Techno":
        title = f"Techno Objective Test - Class {req.standard} ({req.difficulty})"
    else:
        title = f"{req.syllabus} - {req.standard} {req.subject} ({req.difficulty})"
    doc = {
        "id": paper_id,
        "title": title,
        "paper": paper_md,
        "answer_key": answer_md,
        "request": req.model_dump(),
        "created_at": now_iso(),
    }
    await db.papers.insert_one(doc)
    return PaperResponse(
        id=paper_id, title=title, paper=paper_md,
        answer_key=answer_md, created_at=doc["created_at"],
    )


@api_router.get("/paper/{paper_id}")
async def get_paper(paper_id: str):
    p = await db.papers.find_one({"id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Paper not found")
    return p


@api_router.get("/papers")
async def list_papers():
    papers = await db.papers.find({}, {"_id": 0, "paper": 0, "answer_key": 0}).sort("created_at", -1).to_list(50)
    return {"papers": papers}


@api_router.get("/paper/{paper_id}/pdf")
async def paper_pdf(paper_id: str):
    p = await db.papers.find_one({"id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Paper not found")
    req_data = p.get("request", {})
    pattern = req_data.get("pattern", "Standard")
    pdf_bytes = build_pdf(
        p["title"],
        p["paper"],
        p.get("answer_key", ""),
        pattern=pattern,
        request_data=req_data
    )
    fname = f"vidya-paper-{paper_id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api_router.post("/diagram/generate", response_model=DiagramResponse)
async def generate_diagram(req: DiagramRequest):
    session_id = str(uuid.uuid4())
    system_msg = (
        "You are an educational diagram generator. Produce clean, labelled, textbook-style "
        "diagrams suitable for students. Prefer light backgrounds, clear labels, and accurate proportions."
    )
    full_prompt = (
        f"Create a clear, labelled educational diagram for a {req.standard} student studying {req.subject}. "
        f"Topic: {req.prompt}. Style: textbook illustration, white background, bold labels in English, "
        f"high contrast lines, no watermark, no extra text. Suitable for printing in a student notebook."
    )
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg,
        ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        text, images = await chat.send_message_multimodal_response(UserMessage(text=full_prompt))
    except Exception as e:
        logger.exception("Diagram generation failed")
        raise HTTPException(status_code=500, detail=f"Image AI error: {str(e)}")

    if not images:
        raise HTTPException(500, "No image returned from model")

    img = images[0]
    diag_id = str(uuid.uuid4())
    doc = {
        "id": diag_id,
        "prompt": req.prompt,
        "image_base64": img["data"],
        "mime_type": img.get("mime_type", "image/png"),
        "context": req.model_dump(),
        "created_at": now_iso(),
    }
    await db.diagrams.insert_one(doc)
    return DiagramResponse(
        id=diag_id, prompt=req.prompt,
        image_base64=img["data"], mime_type=img.get("mime_type", "image/png"),
        created_at=doc["created_at"],
    )


@api_router.get("/diagrams")
async def list_diagrams():
    diags = await db.diagrams.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"diagrams": diags}


class SummaryRequest(BaseModel):
    standard: str
    subject: str
    topic: str

@api_router.post("/summary")
async def generate_summary(req: SummaryRequest):
    prompt = (
        f"Generate a comprehensive, student-friendly academic summary for the topic '{req.topic}' "
        f"of the subject '{req.subject}' for standard/level '{req.standard}'. "
        f"Explain the key concepts, main definitions, and important points clearly. "
        f"Use clean markdown formatting with headings, bullet points, and code blocks if applicable."
    )
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY)
        chat = chat.with_model("gemini", "gemini-2.5-flash-lite")
        reply = await chat.send_message(UserMessage(text=prompt))
        return {"summary": reply}
    except Exception as e:
        logger.exception("Summary generation failed")
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


# Mount router
app.include_router(api_router)

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
cors_origins_env = os.environ.get("CORS_ORIGINS")
if cors_origins_env:
    origins.extend(cors_origins_env.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

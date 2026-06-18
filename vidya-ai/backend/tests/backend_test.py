import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://exam-generator-pro-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Shared state across tests
state = {}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health ----
def test_root(client):
    r = client.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    assert "message" in r.json()


def test_options(client):
    r = client.get(f"{API}/options", timeout=30)
    assert r.status_code == 200
    data = r.json()
    for k in ["standards", "subjects", "syllabuses", "languages", "difficulties"]:
        assert k in data and isinstance(data[k], list) and len(data[k]) > 0


# ---- Chat ----
def test_chat_and_followup_and_history(client):
    payload = {
        "standard": "10th", "subject": "Mathematics", "syllabus": "CBSE",
        "difficulty": "Medium", "language": "English",
        "message": "Explain Pythagoras theorem in 3 sentences",
    }
    r = client.post(f"{API}/chat", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("session_id") and isinstance(d.get("reply"), str) and len(d["reply"]) > 10
    sid = d["session_id"]
    state["sid"] = sid

    # Follow-up
    payload2 = {**payload, "session_id": sid, "message": "Give one numerical example."}
    r2 = client.post(f"{API}/chat", json=payload2, timeout=120)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["session_id"] == sid
    assert len(d2["reply"]) > 5

    # History
    r3 = client.get(f"{API}/chat/history/{sid}", timeout=30)
    assert r3.status_code == 200
    h = r3.json()
    assert h["session_id"] == sid
    assert len(h["messages"]) >= 2


# ---- Paper ----
def test_paper_generate_and_retrieve_and_pdf_and_list(client):
    payload = {
        "standard": "10th", "subject": "Science", "syllabus": "CBSE",
        "difficulty": "Medium", "language": "English",
        "mcq_count": 3, "two_mark_count": 2, "five_mark_count": 1, "ten_mark_count": 1,
        "include_coding": False,
    }
    r = client.post(f"{API}/paper/generate", json=payload, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["id", "title", "paper", "answer_key", "created_at"]:
        assert k in d
    assert isinstance(d["paper"], str) and len(d["paper"]) > 50
    pid = d["id"]
    state["pid"] = pid

    # Get paper
    r2 = client.get(f"{API}/paper/{pid}", timeout=30)
    assert r2.status_code == 200
    assert r2.json()["id"] == pid

    # PDF
    r3 = client.get(f"{API}/paper/{pid}/pdf", timeout=60)
    assert r3.status_code == 200
    assert r3.headers.get("content-type", "").startswith("application/pdf")
    assert len(r3.content) > 500

    # List
    r4 = client.get(f"{API}/papers", timeout=30)
    assert r4.status_code == 200
    papers = r4.json().get("papers", [])
    assert any(p["id"] == pid for p in papers)


# ---- Diagram ----
def test_diagram_generate_and_list(client):
    payload = {
        "prompt": "Simple labelled diagram of a plant cell",
        "standard": "8th", "subject": "Biology",
    }
    r = client.post(f"{API}/diagram/generate", json=payload, timeout=240)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["id", "image_base64", "mime_type", "created_at"]:
        assert k in d
    assert len(d["image_base64"]) > 1000
    assert d["mime_type"].startswith("image/")

    r2 = client.get(f"{API}/diagrams", timeout=30)
    assert r2.status_code == 200
    diagrams = r2.json().get("diagrams", [])
    assert any(x["id"] == d["id"] for x in diagrams)


# ---- NCERT Lessons & Techno Pattern ----
def test_lessons_endpoint(client):
    r = client.get(f"{API}/lessons?standard=10th&subject=Mathematics", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "lessons" in data
    assert len(data["lessons"]) > 0
    assert "Ch 1: Real Numbers" in data["lessons"]

    r2 = client.get(f"{API}/lessons?standard=9th&subject=Science", timeout=30)
    assert r2.status_code == 200
    data2 = r2.json()
    assert "lessons" in data2
    assert len(data2["lessons"]) > 0
    assert "Ch 8: Motion" in data2["lessons"]
    assert "Ch 1: Matter in Our Surroundings" in data2["lessons"]
    assert "Ch 5: The Fundamental Unit of Life" in data2["lessons"]


def test_techno_paper_generate(client):
    payload = {
        "standard": "8th",
        "subject": "Science",
        "syllabus": "NCERT",
        "pattern": "Techno",
        "math_track_a_topic": "Ch 1: Rational Numbers",
        "math_track_b_topic": "Ch 11: Mensuration",
        "physics_topic": "Ch 11: Force and Pressure",
        "chemistry_topic": "Ch 4: Materials: Metals and Non-Metals"
    }
    r = client.post(f"{API}/paper/generate", json=payload, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["id", "title", "paper", "answer_key", "created_at"]:
        assert k in d
    assert "Techno Objective Test" in d["title"]
    assert "Mathematics Track - A" in d["paper"]
    assert "FBT" in d["paper"]
    
    pid = d["id"]
    r2 = client.get(f"{API}/paper/{pid}/pdf", timeout=60)
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("application/pdf")
    assert len(r2.content) > 500

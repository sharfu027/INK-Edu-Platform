import { useState, useEffect } from "react";
import { FileText, Download, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api, API } from "@/lib/api";
import { mdToHtml } from "@/lib/markdown";
import ContextBar, { DEFAULT_CONTEXT, useOptions } from "@/components/ContextBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function PaperPage() {
  const opts = useOptions();
  const [ctx, setCtx] = useState({ ...DEFAULT_CONTEXT, subject: "Science" });
  const [form, setForm] = useState({
    topic: "",
    total_marks: 80,
    duration_minutes: 180,
    mcq_count: 10,
    two_mark_count: 5,
    five_mark_count: 4,
    ten_mark_count: 2,
    include_coding: false,
  });

  const [pattern, setPattern] = useState("Standard");
  const [lessons, setLessons] = useState([]);
  const [mathLessons, setMathLessons] = useState([]);
  const [physicsLessons, setPhysicsLessons] = useState([]);
  const [chemistryLessons, setChemistryLessons] = useState([]);
  const [biologyLessons, setBiologyLessons] = useState([]);

  const [selectedTopic, setSelectedTopic] = useState("");
  const [mathTrackATopic, setMathTrackATopic] = useState("");
  const [mathTrackBTopic, setMathTrackBTopic] = useState("");
  const [physicsTopic, setPhysicsTopic] = useState("");
  const [chemistryTopic, setChemistryTopic] = useState("");
  const [biologyTopic, setBiologyTopic] = useState("");

  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("paper"); // paper | answer

  const updateForm = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePatternChange = (newPattern) => {
    setPattern(newPattern);
    if (newPattern === "Techno") {
      setForm((f) => ({
        ...f,
        total_marks: 60,
        duration_minutes: 90,
        mcq_count: 60,
        two_mark_count: 0,
        five_mark_count: 0,
        ten_mark_count: 0,
      }));
    } else {
      setForm((f) => ({
        ...f,
        total_marks: 80,
        duration_minutes: 180,
        mcq_count: 10,
        two_mark_count: 5,
        five_mark_count: 4,
        ten_mark_count: 2,
      }));
    }
  };

  const stdBase = ctx.standard ? ctx.standard.split("-")[0] : "";
  const isNcertStandard = ["6th", "7th", "8th", "9th", "10th", "6", "7", "8", "9", "10"].includes(stdBase);

  useEffect(() => {
    if (!isNcertStandard) {
      setLessons([]);
      setMathLessons([]);
      setPhysicsLessons([]);
      setChemistryLessons([]);
      setBiologyLessons([]);
      return;
    }

    if (ctx.subject === "Science") {
      Promise.all([
        api.get(`/lessons?standard=${ctx.standard}&subject=Physics`),
        api.get(`/lessons?standard=${ctx.standard}&subject=Chemistry`),
        api.get(`/lessons?standard=${ctx.standard}&subject=Biology`),
      ]).then(([physRes, chemRes, bioRes]) => {
        setPhysicsLessons(physRes.data.lessons || []);
        setChemistryLessons(chemRes.data.lessons || []);
        setBiologyLessons(bioRes.data.lessons || []);
        
        setPhysicsTopic("");
        setChemistryTopic("");
        setBiologyTopic("");
      }).catch(() => {
        setPhysicsLessons([]);
        setChemistryLessons([]);
        setBiologyLessons([]);
      });
    } else if (ctx.subject === "Mathematics" && pattern === "Techno") {
      api.get(`/lessons?standard=${ctx.standard}&subject=Mathematics`)
        .then((res) => {
          setMathLessons(res.data.lessons || []);
          setMathTrackATopic("");
          setMathTrackBTopic("");
        })
        .catch(() => setMathLessons([]));
    } else {
      api.get(`/lessons?standard=${ctx.standard}&subject=${ctx.subject}`)
        .then((res) => {
          setLessons(res.data.lessons || []);
          setSelectedTopic("");
        })
        .catch(() => setLessons([]));
    }
  }, [ctx.standard, ctx.subject, pattern, isNcertStandard]);

  const generate = async () => {
    setLoading(true);
    setPaper(null);
    try {
      const payload = {
        ...ctx,
        ...form,
        pattern,
      };

      if (ctx.subject === "Science") {
        if (pattern === "Techno") {
          payload.physics_topic = physicsTopic;
          if (biologyTopic) {
            payload.chemistry_topic = `${chemistryTopic || "General"} & Biology: ${biologyTopic}`;
          } else {
            payload.chemistry_topic = chemistryTopic;
          }
        } else {
          payload.topic = `Physics: ${physicsTopic || "General"}, Chemistry: ${chemistryTopic || "General"}, Biology: ${biologyTopic || "General"}`;
        }
      } else if (ctx.subject === "Mathematics" && pattern === "Techno") {
        payload.math_track_a_topic = mathTrackATopic;
        payload.math_track_b_topic = mathTrackBTopic;
      } else {
        const t = selectedTopic || form.topic;
        payload.topic = t;
        if (pattern === "Techno") {
          if (ctx.subject === "Physics") {
            payload.physics_topic = t;
          } else if (ctx.subject === "Chemistry") {
            payload.chemistry_topic = t;
          } else if (ctx.subject === "Biology") {
            payload.chemistry_topic = `Biology: ${t}`;
          } else if (ctx.subject === "Mathematics") {
            payload.math_track_a_topic = t;
            payload.math_track_b_topic = t;
          }
        }
      }


      const { data } = await api.post("/paper/generate", payload, { timeout: 120000 });
      setPaper(data);
      toast.success("Question paper generated!");
    } catch (e) {
      toast.error("Failed: " + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <div>
          <div className="label">Generator</div>
          <h1 className="font-display font-bold text-lg tracking-tight">Question Paper Generator</h1>
        </div>
        {paper && (
          <a
            href={`${API}/paper/${paper.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            data-testid="paper-download-pdf"
          >
            <Button className="rounded-sm bg-black hover:bg-black/90 h-9 px-4 text-xs font-semibold tracking-wide">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download PDF
            </Button>
          </a>
        )}
      </div>

      <ContextBar ctx={ctx} setCtx={setCtx} opts={opts} />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
          {/* Form */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-sm p-6">
            <div className="label mb-4">Paper Specification</div>

            <div className="space-y-4">
              {/* Pattern Selector */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Exam Pattern
                </Label>
                <select
                  data-testid="paper-pattern-select"
                  value={pattern}
                  onChange={(e) => handlePatternChange(e.target.value)}
                  className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <option value="Standard">Standard Custom Pattern</option>
                  <option value="Techno">Techno Objective Test (60m/60q)</option>
                </select>
              </div>

              {isNcertStandard ? (
                <div className="space-y-4">
                  {/* Case 1: Subject is Science (shows Physics, Chemistry, Biology selectors) */}
                  {ctx.subject === "Science" && (
                    <>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Physics Lesson
                        </Label>
                        <select
                          data-testid="paper-physics-select"
                          value={physicsTopic}
                          onChange={(e) => setPhysicsTopic(e.target.value)}
                          className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <option value="">-- Select Physics Chapter --</option>
                          {physicsLessons.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Chemistry Lesson
                        </Label>
                        <select
                          data-testid="paper-chemistry-select"
                          value={chemistryTopic}
                          onChange={(e) => setChemistryTopic(e.target.value)}
                          className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <option value="">-- Select Chemistry Chapter --</option>
                          {chemistryLessons.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Biology Lesson
                        </Label>
                        <select
                          data-testid="paper-biology-select"
                          value={biologyTopic}
                          onChange={(e) => setBiologyTopic(e.target.value)}
                          className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <option value="">-- Select Biology Chapter --</option>
                          {biologyLessons.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Case 2: Subject is Mathematics and pattern is Techno -> Show Math Track A & B selectors */}
                  {ctx.subject === "Mathematics" && pattern === "Techno" && (
                    <>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Mathematics Track A Lesson
                        </Label>
                        <select
                          data-testid="paper-math-a-select"
                          value={mathTrackATopic}
                          onChange={(e) => setMathTrackATopic(e.target.value)}
                          className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <option value="">-- Select Math Chapter --</option>
                          {mathLessons.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Mathematics Track B Lesson
                        </Label>
                        <select
                          data-testid="paper-math-b-select"
                          value={mathTrackBTopic}
                          onChange={(e) => setMathTrackBTopic(e.target.value)}
                          className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <option value="">-- Select Math Chapter --</option>
                          {mathLessons.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Case 3: Any other subject -> Show single dropdown for that subject */}
                  {ctx.subject !== "Science" && !(ctx.subject === "Mathematics" && pattern === "Techno") && (
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        NCERT Chapter / Lesson ({ctx.subject})
                      </Label>
                      <select
                        data-testid="paper-lesson-select"
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        className="mt-1.5 w-full rounded-sm border border-slate-300 bg-white h-10 px-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <option value="">-- Select NCERT Chapter --</option>
                        {lessons.map((lesson) => (
                          <option key={lesson} value={lesson}>{lesson}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Case 1: Subject is Science -> Show Physics, Chemistry, Biology text inputs */}
                  {ctx.subject === "Science" && (
                    <>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Physics Topic
                        </Label>
                        <Input
                          data-testid="paper-physics-input"
                          value={physicsTopic}
                          onChange={(e) => setPhysicsTopic(e.target.value)}
                          placeholder="e.g. Optics"
                          className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Chemistry Topic
                        </Label>
                        <Input
                          data-testid="paper-chemistry-input"
                          value={chemistryTopic}
                          onChange={(e) => setChemistryTopic(e.target.value)}
                          placeholder="e.g. Organic Chemistry"
                          className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Biology Topic
                        </Label>
                        <Input
                          data-testid="paper-biology-input"
                          value={biologyTopic}
                          onChange={(e) => setBiologyTopic(e.target.value)}
                          placeholder="e.g. Cell Division"
                          className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>
                    </>
                  )}

                  {/* Case 2: Subject is Mathematics and pattern is Techno -> Show Track A & B text inputs */}
                  {ctx.subject === "Mathematics" && pattern === "Techno" && (
                    <>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Mathematics Track A Topic
                        </Label>
                        <Input
                          data-testid="paper-math-a-input"
                          value={mathTrackATopic}
                          onChange={(e) => setMathTrackATopic(e.target.value)}
                          placeholder="e.g. Algebra"
                          className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Mathematics Track B Topic
                        </Label>
                        <Input
                          data-testid="paper-math-b-input"
                          value={mathTrackBTopic}
                          onChange={(e) => setMathTrackBTopic(e.target.value)}
                          placeholder="e.g. Geometry"
                          className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>
                    </>
                  )}

                  {/* Case 3: Any other subject -> Show single text input */}
                  {ctx.subject !== "Science" && !(ctx.subject === "Mathematics" && pattern === "Techno") && (
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Focus topic (optional)
                      </Label>
                      <Input
                        data-testid="paper-topic-input"
                        value={form.topic}
                        onChange={(e) => updateForm("topic", e.target.value)}
                        placeholder="e.g. Photosynthesis, Trigonometry"
                        className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Specification fields rendered unconditionally */}
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Total marks" testid="paper-total-marks"
                  value={form.total_marks} onChange={(v) => updateForm("total_marks", v)} />
                <NumField label="Duration (min)" testid="paper-duration"
                  value={form.duration_minutes} onChange={(v) => updateForm("duration_minutes", v)} />
              </div>

              <div className="pt-2">
                <div className="label mb-3">Question Distribution</div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="MCQ (1m)" testid="paper-mcq" value={form.mcq_count}
                    onChange={(v) => updateForm("mcq_count", v)} />
                  <NumField label="Short (2m)" testid="paper-2mark" value={form.two_mark_count}
                    onChange={(v) => updateForm("two_mark_count", v)} />
                  <NumField label="Medium (5m)" testid="paper-5mark" value={form.five_mark_count}
                    onChange={(v) => updateForm("five_mark_count", v)} />
                  <NumField label="Long (10m)" testid="paper-10mark" value={form.ten_mark_count}
                    onChange={(v) => updateForm("ten_mark_count", v)} />
                </div>
              </div>

              <div className="flex items-center justify-between border border-slate-200 p-3 rounded-sm">
                <div>
                  <div className="text-sm font-semibold">Coding section</div>
                  <div className="text-xs text-slate-500">For CS/IT subjects</div>
                </div>
                <Switch
                  data-testid="paper-coding-switch"
                  checked={form.include_coding}
                  onCheckedChange={(v) => updateForm("include_coding", v)}
                />
              </div>

              {/* Techno Specs info card conditionally displayed below */}
              {pattern === "Techno" && (
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-4 text-xs space-y-2">
                  <div className="font-semibold text-slate-700">Techno Objective Test Pattern Specs:</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Marks:</span>
                    <span className="font-bold">60 Marks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-bold">90 Minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Questions:</span>
                    <span className="font-bold">60 MCQs (1 Mark each)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    * Split: 15 questions each for Math A, Math B, Physics, Chemistry (including 5 FBT pattern questions each).
                  </div>
                </div>
              )}

              <Button
                data-testid="paper-generate-btn"
                onClick={generate}
                disabled={loading}
                className="w-full rounded-sm bg-black hover:bg-black/90 h-11 font-semibold tracking-wide"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating paper...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" /> Generate Question Paper</>
                )}
              </Button>
              <p className="text-[11px] text-slate-400 text-center font-mono">
                Takes ~30-60 seconds · Powered by GPT-5.2
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-sm min-h-[500px]">
            {!paper && !loading && (
              <div className="h-full flex items-center justify-center py-24">
                <div className="text-center max-w-sm">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 mb-4" strokeWidth={1.5} />
                  <h3 className="font-display font-bold text-xl mb-2">Your paper will appear here</h3>
                  <p className="text-sm text-slate-500">
                    Set your specs on the left, then click generate. You can preview the paper and
                    the answer key, then export as PDF.
                  </p>
                </div>
              </div>
            )}
            {loading && (
              <div className="h-full flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-400 mb-3" />
                  <p className="text-sm text-slate-500">Designing your exam paper...</p>
                </div>
              </div>
            )}
            {paper && (
              <div data-testid="paper-preview">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="label">Paper</div>
                    <h2 className="font-display font-bold text-lg tracking-tight">{paper.title}</h2>
                  </div>
                  <div className="flex border border-slate-200 rounded-sm overflow-hidden">
                    <button
                      data-testid="paper-tab-paper"
                      className={`px-4 py-1.5 text-xs font-semibold ${tab === "paper" ? "bg-black text-white" : "bg-white text-slate-600"}`}
                      onClick={() => setTab("paper")}
                    >Paper</button>
                    <button
                      data-testid="paper-tab-answer"
                      className={`px-4 py-1.5 text-xs font-semibold ${tab === "answer" ? "bg-black text-white" : "bg-white text-slate-600"}`}
                      onClick={() => setTab("answer")}
                    >Answer Key</button>
                  </div>
                </div>
                <div className="p-8 bubble-ai border-0 rounded-none max-w-none prose prose-slate"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(tab === "paper" ? paper.paper : (paper.answer_key || "_Answer key not generated._")) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NumField({ label, value, onChange, testid }) {
  return (
    <div>
      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</Label>
      <Input
        data-testid={testid}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
      />
    </div>
  );
}

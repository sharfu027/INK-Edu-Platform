import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Wand2, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ContextBar, { DEFAULT_CONTEXT, useOptions } from "@/components/ContextBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "Labelled diagram of the human digestive system",
  "Political map of India with state capitals",
  "Series circuit with resistor, battery and switch",
  "Structure of a benzene molecule with bond labels",
  "Cross-section of a plant leaf showing photosynthesis",
  "Block diagram of a computer system",
];

export default function DiagramPage() {
  const opts = useOptions();
  const [ctx, setCtx] = useState({ ...DEFAULT_CONTEXT, subject: "Biology" });
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [gallery, setGallery] = useState([]);

  const loadGallery = async () => {
    try {
      const { data } = await api.get("/diagrams");
      setGallery(data.diagrams || []);
    } catch (_) {}
  };
  useEffect(() => { loadGallery(); }, []);

  const generate = async (text) => {
    const p = (text || prompt).trim();
    if (!p) {
      toast.error("Please describe what diagram you want");
      return;
    }
    setLoading(true);
    setCurrent(null);
    try {
      const { data } = await api.post(
        "/diagram/generate",
        { prompt: p, standard: ctx.standard, subject: ctx.subject, language: ctx.language },
        { timeout: 180000 },
      );
      setCurrent(data);
      loadGallery();
      toast.success("Diagram generated!");
    } catch (e) {
      toast.error("Failed: " + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const download = (img) => {
    const a = document.createElement("a");
    a.href = `data:${img.mime_type};base64,${img.image_base64}`;
    a.download = `ink-education-ai-diagram-${img.id.slice(0, 8)}.png`;
    a.click();
  };

  return (
    <>
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <div>
          <div className="label">Generator</div>
          <h1 className="font-display font-bold text-lg tracking-tight">Diagram Maker</h1>
        </div>
        {current && (
          <Button
            data-testid="diagram-download-btn"
            onClick={() => download(current)}
            className="rounded-sm bg-black hover:bg-black/90 h-9 px-4 text-xs font-semibold tracking-wide"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download PNG
          </Button>
        )}
      </div>

      <ContextBar ctx={ctx} setCtx={setCtx} opts={opts} />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
          {/* Prompt */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-sm p-6 h-fit">
            <div className="label mb-4">Describe the diagram</div>
            <Textarea
              data-testid="diagram-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Labelled diagram of the human heart with chambers and blood vessels"
              rows={5}
              className="rounded-sm border-slate-300 resize-none focus-visible:ring-2 focus-visible:ring-blue-600 text-sm"
            />
            <Button
              data-testid="diagram-generate-btn"
              onClick={() => generate()}
              disabled={loading}
              className="w-full mt-4 rounded-sm bg-black hover:bg-black/90 h-11 font-semibold tracking-wide"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Drawing your diagram...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" /> Generate Diagram</>
              )}
            </Button>
            <p className="text-[11px] text-slate-400 text-center mt-2 font-mono">
              Powered by Gemini Nano Banana
            </p>

            <div className="mt-6">
              <div className="label mb-3">Examples</div>
              <div className="space-y-2">
                {EXAMPLES.map((e, i) => (
                  <button
                    key={e}
                    data-testid={`diagram-example-${i}`}
                    onClick={() => { setPrompt(e); }}
                    className="text-left w-full text-xs p-2.5 border border-slate-200 hover:border-black bg-white rounded-sm transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview + gallery */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-sm min-h-[400px]">
              {!current && !loading && (
                <div className="h-full flex items-center justify-center py-24">
                  <div className="text-center max-w-sm">
                    <ImagePlus className="w-10 h-10 mx-auto text-slate-300 mb-4" strokeWidth={1.5} />
                    <h3 className="font-display font-bold text-xl mb-2">Your diagram will appear here</h3>
                    <p className="text-sm text-slate-500">
                      Describe what you need and we'll generate a textbook-style labelled diagram.
                    </p>
                  </div>
                </div>
              )}
              {loading && (
                <div className="h-full flex items-center justify-center py-24">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-400 mb-3" />
                    <p className="text-sm text-slate-500">Drawing labelled diagram...</p>
                  </div>
                </div>
              )}
              {current && (
                <div className="p-6" data-testid="diagram-preview">
                  <div className="aspect-square sm:aspect-video bg-slate-50 border border-slate-200 rounded-sm overflow-hidden">
                    <img
                      src={`data:${current.mime_type};base64,${current.image_base64}`}
                      alt={current.prompt}
                      className="w-full h-full object-contain bg-white"
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">"{current.prompt}"</p>
                </div>
              )}
            </div>

            {gallery.length > 0 && (
              <div>
                <div className="label mb-3">Recent diagrams</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="diagram-gallery">
                  {gallery.slice(0, 8).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setCurrent(d)}
                      className="group block bg-white border border-slate-200 hover:border-black rounded-sm overflow-hidden text-left"
                    >
                      <div className="aspect-square bg-slate-50">
                        <img
                          src={`data:${d.mime_type};base64,${d.image_base64}`}
                          alt={d.prompt}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 text-[11px] text-slate-600 truncate">{d.prompt}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

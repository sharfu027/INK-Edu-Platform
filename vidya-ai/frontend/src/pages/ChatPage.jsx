import { useEffect, useRef, useState } from "react";
import { Send, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { mdToHtml } from "@/lib/markdown";
import ContextBar, { DEFAULT_CONTEXT, useOptions } from "@/components/ContextBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTIONS = [
  "Explain Newton's three laws with examples",
  "Solve: 2x² + 5x - 3 = 0 step by step",
  "Generate notes on photosynthesis for revision",
  "Write a Python program for binary search",
];

export default function ChatPage() {
  const opts = useOptions();
  const [ctx, setCtx] = useState(DEFAULT_CONTEXT);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setSending(true);
    try {
      const { data } = await api.post("/chat", {
        session_id: sessionId,
        message: msg,
        ...ctx,
      });
      setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "ai", content: data.reply }]);
    } catch (e) {
      const detail = e?.response?.data?.detail || e.message;
      toast.error("AI error: " + detail);
      setMessages((m) => [...m, { role: "ai", content: "Sorry, I hit an error. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setSessionId(null);
  };

  return (
    <>
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <div>
          <div className="label">Study Chat</div>
          <h1 className="font-display font-bold text-lg tracking-tight">Ask INK Education AI anything</h1>
        </div>
        <Button
          variant="outline"
          onClick={reset}
          data-testid="chat-reset-btn"
          className="rounded-sm border-slate-300 h-9 px-3 text-xs font-semibold"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> New chat
        </Button>
      </div>

      <ContextBar ctx={ctx} setCtx={setCtx} opts={opts} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8" data-testid="chat-messages">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex w-12 h-12 bg-black text-white items-center justify-center mb-5 rounded-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="font-display font-black text-3xl tracking-tight mb-2">
                What shall we learn today?
              </h2>
              <p className="text-slate-500 mb-8">Pick your context above. Try one of these:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    data-testid={`chat-suggestion-${i}`}
                    onClick={() => send(s)}
                    className="text-left p-4 border border-slate-200 hover:border-black bg-white rounded-sm text-sm transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              data-testid={`chat-msg-${i}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} fade-up`}
            >
              <div
                className={`${
                  m.role === "user" ? "bubble-user" : "bubble-ai"
                } px-4 py-3 max-w-[85%] text-[15px] leading-relaxed`}
              >
                {m.role === "ai" ? (
                  <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bubble-ai px-4 py-3 inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <Textarea
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Ask anything about ${ctx.subject} for ${ctx.standard} (${ctx.language})...`}
              rows={2}
              className="rounded-sm border-slate-300 resize-none focus-visible:ring-2 focus-visible:ring-blue-600 text-[15px]"
            />
            <Button
              data-testid="chat-send-btn"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="rounded-sm bg-black hover:bg-black/90 h-[68px] w-14"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            ⏎ to send · Shift+⏎ for newline · Model: gpt-5.2
          </div>
        </div>
      </div>
    </>
  );
}

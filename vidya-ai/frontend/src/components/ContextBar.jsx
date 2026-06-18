import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const DEFAULT_CONTEXT = {
  standard: "10th",
  subject: "Mathematics",
  syllabus: "CBSE",
  difficulty: "Medium",
  language: "English",
};

export function useOptions() {
  const [opts, setOpts] = useState(null);
  useEffect(() => {
    api.get("/options").then((r) => setOpts(r.data)).catch(() => {});
  }, []);
  return opts;
}

function Field({ label, value, onChange, options, testid }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="label">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          data-testid={testid}
          className="rounded-sm border-slate-300 bg-white h-10 text-sm font-medium focus:ring-2 focus:ring-blue-600"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {(options || []).map((o) => (
            <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ContextBar({ ctx, setCtx, opts, extra }) {
  if (!opts) {
    return (
      <div className="border-b border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
        Loading education options...
      </div>
    );
  }
  return (
    <div className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Field
          label="Standard"
          value={ctx.standard}
          onChange={(v) => setCtx({ ...ctx, standard: v })}
          options={opts.standards}
          testid="ctx-standard"
        />
        <Field
          label="Subject"
          value={ctx.subject}
          onChange={(v) => setCtx({ ...ctx, subject: v })}
          options={opts.subjects}
          testid="ctx-subject"
        />
        <Field
          label="Syllabus"
          value={ctx.syllabus}
          onChange={(v) => setCtx({ ...ctx, syllabus: v })}
          options={opts.syllabuses}
          testid="ctx-syllabus"
        />
        <Field
          label="Difficulty"
          value={ctx.difficulty}
          onChange={(v) => setCtx({ ...ctx, difficulty: v })}
          options={opts.difficulties}
          testid="ctx-difficulty"
        />
        <Field
          label="Language"
          value={ctx.language}
          onChange={(v) => setCtx({ ...ctx, language: v })}
          options={opts.languages}
          testid="ctx-language"
        />
      </div>
      {extra && <div className="mt-4">{extra}</div>}
    </div>
  );
}

import { useState } from "react";

interface Props {
  prompt: string;
  query: string;
}

export function ClaudePromptBox({ prompt, query }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border border-blue-900/60 bg-blue-950/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-950/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-lg">✦</span>
          <div>
            <p className="text-sm font-semibold text-slate-200">Claude Prompt</p>
            <p className="text-xs text-slate-500">
              Ready-to-paste synthesis prompt for &ldquo;{query}&rdquo;
            </p>
          </div>
        </div>
        <span className="text-slate-500 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-blue-900/40 px-5 py-4 animate-fade-in">
          <div className="relative">
            <pre className="text-xs font-mono text-blue-200/80 whitespace-pre-wrap leading-relaxed bg-navy-950 rounded-lg p-4 max-h-64 overflow-y-auto">
              {prompt}
            </pre>
            <button
              onClick={copy}
              className="absolute top-2 right-2 text-xs bg-blue-800 hover:bg-blue-700 text-blue-100 px-2.5 py-1 rounded-md transition-colors"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Paste this into Claude, ChatGPT, or any LLM to get a synthesised summary of community insights.
          </p>
        </div>
      )}
    </div>
  );
}

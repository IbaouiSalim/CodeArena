import { X, BookOpen } from "lucide-react";
import { snippetExamples } from "../utils/snippets";
import type { Language, SnippetExample } from "../types";
import { useState } from "react";

interface SnippetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (snippet: SnippetExample) => void;
}

const languageTabs: { value: Language | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "cpp", label: "C++" },
  { value: "rust", label: "Rust" },
  { value: "javascript", label: "JS" },
];

const langColors: Record<Language, string> = {
  python: "#3572A5",
  go: "#00ADD8",
  cpp: "#f34b7d",
  rust: "#DEA584",
  javascript: "#F7DF1E",
};

export default function SnippetLibrary({ isOpen, onClose, onSelect }: SnippetLibraryProps) {
  const [filter, setFilter] = useState<Language | "all">("all");

  if (!isOpen) return null;

  const filtered =
    filter === "all" ? snippetExamples : snippetExamples.filter((s) => s.language === filter);

  return (
    // Modal overlay (dark background)
    <div className="modal-overlay" onClick={onClose}>
      {/* Modal box (white/dark box in the center) */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* ─── Modal Header ─── */}
        <div className="modal-header">
          <div className="modal-title">
            <BookOpen size={18} />
            <span>Snippet Library</span>
          </div>
          {/* Close button (X) */}
          <button className="modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* ─── Filter tabs (All, Python, Go, C++, Rust, JS) ─── */}
        <div className="modal-tabs">
          {languageTabs.map((tab) => (
            <button
              key={tab.value}
              className={`tab ${filter === tab.value ? "active" : ""}`}
              onClick={() => setFilter(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Snippet cards grid ─── */}
        <div className="modal-body">
          <div className="snippet-grid">
            {filtered.map((snippet, i) => (
              <button
                key={`${snippet.language}-${snippet.title}-${i}`}
                className="snippet-card"
                onClick={() => {
                  onSelect(snippet);
                  {
                    /* User picked this snippet */
                  }
                  onClose();
                  {
                    /* Close the modal */
                  }
                }}
                type="button"
              >
                {/* Card header: colored dot and language name */}
                <div className="snippet-card-header">
                  <span
                    className="lang-dot"
                    style={{ backgroundColor: langColors[snippet.language] }}
                  />
                  <span className="snippet-lang">{snippet.language}</span>
                </div>

                {/* Card title */}
                <h3 className="snippet-title">{snippet.title}</h3>

                {/* First 4 lines of code as a preview */}
                <pre className="snippet-preview">
                  {snippet.code.split("\n").slice(0, 4).join("\n")}
                </pre>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

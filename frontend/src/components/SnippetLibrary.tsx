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
    filter === "all"
      ? snippetExamples
      : snippetExamples.filter((s) => s.language === filter);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <BookOpen size={18} />
            <span>Snippet Library</span>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

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

        <div className="modal-body">
          <div className="snippet-grid">
            {filtered.map((snippet, i) => (
              <button
                key={`${snippet.language}-${snippet.title}-${i}`}
                className="snippet-card"
                onClick={() => {
                  onSelect(snippet);
                  onClose();
                }}
                type="button"
              >
                <div className="snippet-card-header">
                  <span
                    className="lang-dot"
                    style={{ backgroundColor: langColors[snippet.language] }}
                  />
                  <span className="snippet-lang">{snippet.language}</span>
                </div>
                <h3 className="snippet-title">{snippet.title}</h3>
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

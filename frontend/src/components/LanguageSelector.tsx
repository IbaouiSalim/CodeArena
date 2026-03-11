import { useState, useRef, useEffect } from "react";
import type { Language } from "../types";
import { ChevronDown, Check } from "lucide-react";

interface LanguageSelectorProps {
  language: Language;
  onChange: (lang: Language) => void;
}

const languages: {
  value: Language;
  label: string;
  icon: string;
  desc: string;
  color: string;
}[] = [
  { value: "python", label: "Python", icon: "/lang-icons/python.png", desc: "3.12", color: "#3776AB" },
  { value: "javascript", label: "JavaScript", icon: "/lang-icons/javascript.png", desc: "Node 22", color: "#F7DF1E" },
  { value: "go", label: "Go", icon: "/lang-icons/go.png", desc: "1.23", color: "#00ADD8" },
  { value: "cpp", label: "C++", icon: "/lang-icons/cpp.png", desc: "GCC 13", color: "#659BD3" },
  { value: "rust", label: "Rust", icon: "/lang-icons/rust.png", desc: "1.83", color: "#DEA584" },
];

export default function LanguageSelector({ language, onChange }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = languages.find((l) => l.value === language)!;

  // close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="lang-select" ref={ref}>
      <button
        className="lang-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <div className="lang-select-current">
          <img src={current.icon} alt="" className="lang-select-icon" />
          <span className="lang-select-label">{current.label}</span>
          <span className="lang-select-version">{current.desc}</span>
        </div>
        <ChevronDown size={14} className={`lang-select-chevron ${open ? "rotated" : ""}`} />
      </button>

      {open && (
        <div className="lang-select-dropdown" role="listbox" aria-label="Languages">
          <div className="lang-select-header">Select Language</div>
          {languages.map((l) => {
            const selected = l.value === language;
            return (
              <button
                key={l.value}
                className={`lang-select-option ${selected ? "selected" : ""}`}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(l.value);
                  setOpen(false);
                }}
              >
                <div
                  className="lang-select-option-indicator"
                  style={{ backgroundColor: l.color }}
                />
                <img src={l.icon} alt="" className="lang-select-icon" />
                <div className="lang-select-option-text">
                  <span className="lang-select-option-name">{l.label}</span>
                  <span className="lang-select-option-desc">{l.desc}</span>
                </div>
                {selected && <Check size={14} className="lang-select-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

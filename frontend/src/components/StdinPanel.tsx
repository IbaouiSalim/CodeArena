import { Keyboard, Trash2 } from "lucide-react";

interface StdinPanelProps {
  stdin: string;
  onChange: (value: string) => void;
  /** When true, renders as a full-size panel (for mobile tab view) */
  fullSize?: boolean;
}

export default function StdinPanel({ stdin, onChange, fullSize = false }: StdinPanelProps) {
  if (fullSize) {
    return (
      <div className="stdin-panel-full">
        <div className="stdin-full-header">
          <Keyboard size={14} />
          <span>Program Input (stdin)</span>
          {stdin.length > 0 && (
            <button
              className="btn btn-ghost btn-tiny"
              onClick={() => onChange("")}
              title="Clear input"
              type="button"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <textarea
          className="stdin-full-input"
          value={stdin}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            "Enter input for your program here...\n\nExample: if your code reads from stdin\n(input() in Python, Scanner in Go, cin in C++),\ntype the values your program expects."
          }
          spellCheck={false}
        />
        {stdin.length > 0 && (
          <div className="stdin-full-footer">
            <span className="stdin-char-count">
              {stdin.length} character{stdin.length !== 1 ? "s" : ""} · {stdin.split("\n").length}{" "}
              line{stdin.split("\n").length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stdin-panel">
      <div className="stdin-inline-header">
        <Keyboard size={14} />
        <span>stdin</span>
        {stdin.length > 0 && <span className="stdin-dot" />}
        {stdin.length > 0 && (
          <button
            className="btn btn-ghost btn-tiny"
            onClick={() => onChange("")}
            title="Clear"
            type="button"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <textarea
        className="stdin-input"
        value={stdin}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter input for your program (stdin)..."
        rows={3}
        spellCheck={false}
      />
    </div>
  );
}

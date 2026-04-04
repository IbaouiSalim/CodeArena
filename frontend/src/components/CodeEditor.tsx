import Editor from "@monaco-editor/react";
import type { Language } from "../types";

interface CodeEditorProps {
  language: Language;
  code: string;
  onChange: (value: string) => void;
}

const languageMap: Record<Language, string> = {
  python: "python",
  go: "go",
  cpp: "cpp",
  rust: "rust",
  javascript: "javascript",
};

export default function CodeEditor({ language, code, onChange }: CodeEditorProps) {
  return (
    <div className="code-editor">
      <Editor
        height="100%"
        language={languageMap[language]}
        value={code}
        onChange={(value) => onChange(value ?? "")}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          lineNumbers: "on",
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          tabSize: 4,
          wordWrap: "on",
          suggest: { showKeywords: true }
        }}
      />
    </div>
  );
}

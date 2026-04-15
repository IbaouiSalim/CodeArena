import { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import type { Language } from "../types";

interface CodeEditorProps {
  language: Language;
  code: string;
  onChange: (value: string) => void;
  onRun?: () => void;
}

const languageMap: Record<Language, string> = {
  python: "python",
  go: "go",
  cpp: "cpp",
  rust: "rust",
  javascript: "javascript",
};

export default function CodeEditor({ language, code, onChange, onRun }: CodeEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null); // Monaco editor instance
  const monacoRef = useRef<Monaco | null>(null);

  // Add Ctrl+Enter keyboard shortcut to Monaco Editor
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !onRun) return;

    const editor = editorRef.current;

    // Get the editor's HTML container and listen for key events
    const editorContainer = editor.getContainerDomNode();
    if (editorContainer) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onRun();
        }
      };

      editorContainer.addEventListener("keydown", handleKeyDown, true);
      return () => {
        editorContainer.removeEventListener("keydown", handleKeyDown, true);
      };
    }

    return () => {};
  }, [onRun]);

  return (
    <div className="code-editor">
      <Editor
        height="100%"
        language={languageMap[language]}
        value={code}
        onChange={(value) => onChange(value ?? "")}
        theme="vs-dark"
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          monacoRef.current = monaco;
        }}
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
          suggest: { showKeywords: true },
        }}
      />
    </div>
  );
}

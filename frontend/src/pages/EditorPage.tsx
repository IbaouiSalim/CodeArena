import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Play, BookOpen, Code, Terminal } from "lucide-react";
import type { Language, SnippetExample } from "../types";
import Header from "../components/Header";
import CodeEditor from "../components/CodeEditor";
import LanguageSelector from "../components/LanguageSelector";
import InteractiveTerminal from "../components/InteractiveTerminal";
import ShareButton from "../components/ShareButton";
import SnippetLibrary from "../components/SnippetLibrary";
import { loadSnippet } from "../utils/api";

function getWebSocketURL(): string {
  if (typeof window === "undefined") return "ws://localhost:8080/api/execute/ws";
  
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (window.location.hostname === "localhost") {
    return `${protocol}//localhost:8080/api/execute/ws`;
  }
  return `${protocol}//${window.location.host}/api/execute/ws`;
}

const WS_URL = getWebSocketURL();

type MobileTab = "code" | "terminal";

const defaultCode: Record<Language, string> = {
  python: `print("Hello, World!")`,
  javascript: `console.log("Hello, World!");`,
  go: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`,
  cpp: `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`,
  rust: `fn main() {
    println!("Hello, World!");
}`,
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function EditorPage() {
  const { token } = useParams<{ token?: string }>();

  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(defaultCode.python);
  const [isRunning, setIsRunning] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("code");

  const isMobile = useIsMobile();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    
    loadSnippet(token)
      .then((snippet) => {
        setLanguage(snippet.language);
        setCode(snippet.code);
      })
      .catch(() => {
      });
  }, [token]);

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLanguage(lang);
      setCode(defaultCode[lang]);
    },
    [],
  );

  const handleRun = useCallback(() => {
    if (!code.trim() || isRunning) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsRunning(true);
    if (isMobile) setMobileTab("terminal");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "start",
          language,
          code,
        }),
      );
    };

    ws.onclose = () => {
      setIsRunning(false);  // Code finished executing
    };

    ws.onerror = () => {
      setIsRunning(false);  // Connection error
    };
  }, [language, code, isRunning, isMobile]);

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handler: Example code selected from snippet library
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleSnippetSelect = useCallback((snippet: SnippetExample) => {
    setLanguage(snippet.language);
    setCode(snippet.code);
    setMobileTab("code");  // Switch to code view on mobile
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handler: Keyboard shortcut (Ctrl+Enter or Cmd+Enter to run)
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();  // Prevent default browser behavior
        handleRun();
      }
    },
    [handleRun],
  );

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="editor-page" onKeyDown={handleKeyDown}>
      <Header />

      <div className="toolbar">
        <div className="toolbar-left">
          <LanguageSelector language={language} onChange={handleLanguageChange} />
          
          <button
            className="btn btn-ghost hide-mobile"
            onClick={() => setLibraryOpen(true)}
            title="Snippet library"
            type="button"
          >
            <BookOpen size={16} />
            <span>Examples</span>
          </button>
        </div>

        <div className="toolbar-right">
          <button
            className="btn btn-ghost show-mobile-only"
            onClick={() => setLibraryOpen(true)}
            title="Examples"
            type="button"
          >
            <BookOpen size={16} />
          </button>
          
          <ShareButton language={language} code={code} stdin="" />
          
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            type="button"
          >
            {isRunning ? (
              <div className="spinner-small" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            <span>Run</span>
            <kbd className="kbd">Ctrl+↵</kbd>
          </button>
        </div>
      </div>

      {isMobile && (
        <div className="mobile-tabs">
          <button
            className={`mobile-tab ${mobileTab === "code" ? "active" : ""}`}
            onClick={() => setMobileTab("code")}
            type="button"
          >
            <Code size={15} />
            <span>Code</span>
          </button>
          <button
            className={`mobile-tab ${mobileTab === "terminal" ? "active" : ""}`}
            onClick={() => setMobileTab("terminal")}
            type="button"
          >
            <Terminal size={15} />
            <span>Terminal</span>
          </button>
        </div>
      )}

      {!isMobile && (
        <div className="editor-layout">
          <div className="editor-main">
            <CodeEditor language={language} code={code} onChange={setCode} />
          </div>
          <InteractiveTerminal isRunning={isRunning} wsRef={wsRef} />
        </div>
      )}

      {isMobile && (
        <div className="mobile-content">
          {mobileTab === "code" && (
            <div className="mobile-panel">
              <CodeEditor language={language} code={code} onChange={setCode} />
            </div>
          )}
          {mobileTab === "terminal" && (
            <div className="mobile-panel">
              <InteractiveTerminal isRunning={isRunning} wsRef={wsRef} />
            </div>
          )}
        </div>
      )}

      <SnippetLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleSnippetSelect}
      />
    </div>
  );
}

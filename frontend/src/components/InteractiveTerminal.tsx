import { useRef, useEffect, useCallback, useState } from "react";
import { Terminal, AlertCircle, Clock, CheckCircle, CornerDownLeft } from "lucide-react";

interface ExitInfo {
  exitCode: number;
  durationMs: number;
  wasTimeout: boolean;
}

interface InteractiveTerminalProps {
  /** Whether the program is currently running */
  isRunning: boolean;
  /** Called when user clicks Run – returns the WebSocket to use */
  wsRef: React.MutableRefObject<WebSocket | null>;
}

interface TerminalEntry {
  type: "output" | "stderr" | "error" | "system";
  text: string;
}

export default function InteractiveTerminal({ isRunning, wsRef }: InteractiveTerminalProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries, isRunning, exitInfo]);

  // Focus input when program starts running
  useEffect(() => {
    if (isRunning) {
      setEntries([]);
      setExitInfo(null);
      setHasRun(true);
      // Small delay to let the input render
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isRunning]);

  // Listen for WebSocket messages — re-attach when isRunning changes
  // (isRunning becomes true right after wsRef.current is set)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "output":
            setEntries((prev) => [...prev, { type: "output", text: msg.data }]);
            break;
          case "stderr":
            setEntries((prev) => [...prev, { type: "stderr", text: msg.data }]);
            break;
          case "error":
            setEntries((prev) => [...prev, { type: "error", text: msg.message }]);
            break;
          case "exit":
            setExitInfo({
              exitCode: msg.exitCode,
              durationMs: msg.durationMs,
              wasTimeout: msg.wasTimeout,
            });
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendInput = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Send the input line + newline to the container's stdin
    ws.send(JSON.stringify({ type: "stdin", data: inputValue + "\n" }));
    setInputValue("");
  }, [inputValue, wsRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendInput();
      }
    },
    [handleSendInput],
  );

  // Click anywhere on terminal body to focus input
  const handleBodyClick = useCallback(() => {
    if (isRunning && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRunning]);

  return (
    <div className="terminal-panel">
      {/* Header */}
      <div className="terminal-header">
        <Terminal size={14} />
        <span>Terminal</span>

        {isRunning && !exitInfo && (
          <span className="terminal-status running">
            <div className="spinner-small" />
            Running
          </span>
        )}

        {exitInfo && (
          <div className="terminal-meta">
            {exitInfo.wasTimeout ? (
              <span className="badge badge-warning">
                <Clock size={12} /> Timed out
              </span>
            ) : exitInfo.exitCode === 0 ? (
              <span className="badge badge-success">
                <CheckCircle size={12} /> Exit: 0
              </span>
            ) : (
              <span className="badge badge-error">
                <AlertCircle size={12} /> Exit: {exitInfo.exitCode}
              </span>
            )}
            <span className="badge badge-neutral">
              <Clock size={12} /> {exitInfo.durationMs}ms
            </span>
          </div>
        )}
      </div>

      {/* Terminal body */}
      <div className="terminal-body" ref={bodyRef} onClick={handleBodyClick}>
        {!hasRun && (
          <div className="terminal-placeholder">
            Click <strong>Run</strong> to execute your code
          </div>
        )}

        {hasRun && (
          <div className="terminal-output">
            {entries.map((entry, i) => (
              <span
                key={i}
                className={`terminal-text terminal-${entry.type}`}
              >
                {entry.text}
              </span>
            ))}

            {/* Blinking cursor while running and no exit yet */}
            {isRunning && !exitInfo && entries.length > 0 && (
              <span className="terminal-cursor">▋</span>
            )}
          </div>
        )}

        {/* Waiting indicator when running but no output yet */}
        {isRunning && !exitInfo && entries.length === 0 && (
          <div className="terminal-waiting">
            <div className="spinner" />
            <span>Starting...</span>
          </div>
        )}
      </div>

      {/* Input area – visible while program is running */}
      {isRunning && !exitInfo && (
        <div className="terminal-input-bar">
          <span className="terminal-prompt">›</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input"
            placeholder="Type input here and press Enter..."
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="terminal-send-btn"
            onClick={handleSendInput}
            title="Send input (Enter)"
          >
            <CornerDownLeft size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

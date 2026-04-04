import { useRef, useEffect, useCallback, useState } from "react";
import { Terminal, AlertCircle, Clock, CheckCircle, CornerDownLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// InteractiveTerminal Component: Shows program output and lets user send input
// ═══════════════════════════════════════════════════════════════════════════

// Information about when the program finished
interface ExitInfo {
  exitCode: number;   // 0 = success, other = error
  durationMs: number; // How long it ran
  wasTimeout: boolean;// Did it get killed for running too long?
}

interface InteractiveTerminalProps {
  isRunning: boolean;  // Is the program currently executing?
  wsRef: React.MutableRefObject<WebSocket | null>;  // Reference to WebSocket connection
}

// One line of output
interface TerminalEntry {
  type: "output" | "stderr" | "error" | "system";
  text: string;
}

export default function InteractiveTerminal({ isRunning, wsRef }: InteractiveTerminalProps) {
  // State variables
  const [entries, setEntries] = useState<TerminalEntry[]>([]);  // All lines of output so far
  const [inputValue, setInputValue] = useState("");             // Text the user typed to send
  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);  // Info when program finished
  const [hasRun, setHasRun] = useState(false);                  // Has the user clicked Run yet?

  const bodyRef = useRef<HTMLDivElement>(null);  // Reference to the scrollable output area
  const inputRef = useRef<HTMLInputElement>(null);  // Reference to the input text field

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-scroll to bottom when new output arrives
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;  // Jump to bottom
    }
  }, [entries, isRunning, exitInfo]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    // eslint-disable-next-line
    setEntries([]);
    setExitInfo(null);
    setHasRun(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isRunning]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "output":
            // Stdout (print statements, normal output)
            setEntries((prev) => [...prev, { type: "output", text: msg.data }]);
            break;
          case "stderr":
            // Stderr (error messages from the program)
            setEntries((prev) => [...prev, { type: "stderr", text: msg.data }]);
            break;
          case "error":
            // System error messages
            setEntries((prev) => [...prev, { type: "error", text: msg.message }]);
            break;
          case "exit":
            // Program finished! Show exit code and duration
            setExitInfo({
              exitCode: msg.exitCode,
              durationMs: msg.durationMs,
              wasTimeout: msg.wasTimeout,
            });
            break;
        }
      } catch {
        // Ignore malformed messages (parsing failed)
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [isRunning, wsRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // Send user's input to the program via WebSocket
  // ─────────────────────────────────────────────────────────────────────────
  const handleSendInput = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Send the input line with a newline character (so program knows input is complete)
    ws.send(JSON.stringify({ type: "stdin", data: inputValue + "\n" }));
    setInputValue("");  // Clear the input field
  }, [inputValue, wsRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard handler: Send input when user presses Enter
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();  // Don't add a newline to the input field
        handleSendInput();
      }
    },
    [handleSendInput],
  );

  // Click on terminal body to focus the input field
  const handleBodyClick = useCallback(() => {
    if (isRunning && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRunning]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER THE TERMINAL UI
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="terminal-panel">
      {/* ─── Header with title and status info ─── */}
      <div className="terminal-header">
        <Terminal size={14} />
        <span>Terminal</span>

        {/* Show "Running" status while program is executing */}
        {isRunning && !exitInfo && (
          <span className="terminal-status running">
            <div className="spinner-small" />
            Running
          </span>
        )}

        {/* Show exit info when program finishes */}
        {exitInfo && (
          <div className="terminal-meta">
            {exitInfo.wasTimeout ? (
              // Timed out (ran too long)
              <span className="badge badge-warning">
                <Clock size={12} /> Timed out
              </span>
            ) : exitInfo.exitCode === 0 ? (
              // Success (exit code 0)
              <span className="badge badge-success">
                <CheckCircle size={12} /> Exit: 0
              </span>
            ) : (
              // Error (non-zero exit code)
              <span className="badge badge-error">
                <AlertCircle size={12} /> Exit: {exitInfo.exitCode}
              </span>
            )}
            {/* Show how long the program took to run */}
            <span className="badge badge-neutral">
              <Clock size={12} /> {exitInfo.durationMs}ms
            </span>
          </div>
        )}
      </div>

      {/* ─── Output area ─── */}
      <div className="terminal-body" ref={bodyRef} onClick={handleBodyClick}>
        {!hasRun && (
          // No program has run yet - show placeholder
          <div className="terminal-placeholder">
            Click <strong>Run</strong> to execute your code
          </div>
        )}

        {hasRun && (
          // Program has run - show all the output
          <div className="terminal-output">
            {entries.map((entry, i) => (
              <span
                key={i}
                className={`terminal-text terminal-${entry.type}`}
              >
                {entry.text}
              </span>
            ))}

            {/* Blinking cursor while running */}
            {isRunning && !exitInfo && entries.length > 0 && (
              <span className="terminal-cursor">▋</span>
            )}
          </div>
        )}

        {/* Waiting spinner when program started but no output yet */}
        {isRunning && !exitInfo && entries.length === 0 && (
          <div className="terminal-waiting">
            <div className="spinner" />
            <span>Starting...</span>
          </div>
        )}
      </div>

      {/* ─── Input field (only shown while program is running) ─── */}
      {isRunning && !exitInfo && (
        <div className="terminal-input-bar">
          <span className="terminal-prompt">›</span>  {/* Prompt symbol */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}  // Update state as user types
            onKeyDown={handleKeyDown}
            className="terminal-input"
            placeholder="Type input here and press Enter..."
            spellCheck={false}
            autoComplete="off"
          />
          {/* Send button */}
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

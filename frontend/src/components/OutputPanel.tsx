import { Terminal, AlertCircle, Clock, CheckCircle } from "lucide-react";
import type { ExecuteResponse } from "../types";

interface OutputPanelProps {
  result: ExecuteResponse | null;
  error: string | null;
  isRunning: boolean;
}

export default function OutputPanel({ result, error, isRunning }: OutputPanelProps) {
  return (
    <div className="output-panel">
      <div className="output-header">
        <Terminal size={14} />
        <span>Output</span>
        {result && !isRunning && (
          <div className="output-meta">
            {result.wasTimeout ? (
              <span className="badge badge-warning">
                <Clock size={12} /> Timed out
              </span>
            ) : result.exitCode === 0 ? (
              <span className="badge badge-success">
                <CheckCircle size={12} /> Exit: 0
              </span>
            ) : (
              <span className="badge badge-error">
                <AlertCircle size={12} /> Exit: {result.exitCode}
              </span>
            )}
            <span className="badge badge-neutral">
              <Clock size={12} /> {result.durationMs}ms
            </span>
          </div>
        )}
      </div>

      <div className="output-body">
        {isRunning && (
          <div className="output-running">
            <div className="spinner" />
            <span>Running...</span>
          </div>
        )}

        {!isRunning && error && (
          <div className="output-error">
            <AlertCircle size={16} />
            <pre>{error}</pre>
          </div>
        )}

        {!isRunning && !error && !result && (
          <div className="output-placeholder">
            Click <strong>Run</strong> to execute your code
          </div>
        )}

        {!isRunning && result && (
          <>
            {result.stdout && (
              <pre className="output-stdout">{result.stdout}</pre>
            )}
            {result.stderr && (
              <div className="output-stderr-section">
                <span className="stderr-label">stderr</span>
                <pre className="output-stderr">{result.stderr}</pre>
              </div>
            )}
            {!result.stdout && !result.stderr && (
              <div className="output-placeholder">No output</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

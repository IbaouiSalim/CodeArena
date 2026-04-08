import { Share2, Check, Copy, Link } from "lucide-react";
import { useState } from "react";
import type { Language } from "../types";
import { createSnippet } from "../utils/api";

interface ShareButtonProps {
  language: Language;
  code: string;
  stdin: string;
}

export default function ShareButton({ language, code, stdin }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [shareUrl, setShareUrl] = useState("");
  const [showPopover, setShowPopover] = useState(false);

  async function handleShare() {
    if (!code.trim()) return;

    setStatus("loading");
    try {
      const res = await createSnippet({
        language,
        code,
        stdin,
        title: "",
      });

      const url = `${window.location.origin}/s/${res.token}`;
      setShareUrl(url);
      setStatus("done");
      setShowPopover(true);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(shareUrl);
  }

  return (
    <div className="share-wrapper">
      <button
        className="btn btn-ghost"
        onClick={handleShare}
        disabled={status === "loading"}
        title="Share snippet"
        type="button"
      >
        {status === "loading" ? (
          <div className="spinner-small" />
        ) : status === "done" ? (
          <Check size={16} />
        ) : (
          <Share2 size={16} />
        )}
        <span>Share</span>
      </button>

      {showPopover && (
        <div className="share-popover">
          <div className="share-popover-header">
            <Link size={14} />
            <span>Share link created</span>
            <button className="modal-close-sm" onClick={() => setShowPopover(false)} type="button">
              ×
            </button>
          </div>

          <div className="share-url-row">
            <input type="text" value={shareUrl} readOnly className="share-url-input" />
            <button className="btn btn-small" onClick={copyToClipboard} type="button">
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

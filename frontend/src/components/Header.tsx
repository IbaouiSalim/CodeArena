import { Code2 } from "lucide-react";

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-brand">
        <Code2 size={22} strokeWidth={2.5} />
        <h1>CodeArena</h1>
      </div>

      <div className="header-tagline">Run code instantly in your browser</div>

      <div className="header-notice">
        Do not paste secrets, API keys, or passwords — all shared snippets are public.
      </div>
    </header>
  );
}

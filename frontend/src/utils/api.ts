import type { ExecuteRequest, ExecuteResponse, SnippetRequest, SnippetResponse, Snippet } from "../types";

// Get API base URL from environment or use sensible defaults
function getAPIBase(): string {
  // If frontend is on same domain as API, use relative URLs
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "/api";
  }
  
  // Development: use localhost:8080
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:8080/api";
  }
  
  // Fallback
  return "/api";
}

const API_BASE = getAPIBase();

export async function executeCode(req: ExecuteRequest): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Execution failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function createSnippet(req: SnippetRequest): Promise<SnippetResponse> {
  const res = await fetch(`${API_BASE}/snippets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create snippet (${res.status}): ${text}`);
  }

  return res.json();
}

export async function loadSnippet(token: string): Promise<Snippet> {
  const res = await fetch(`${API_BASE}/snippets/${token}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load snippet (${res.status}): ${text}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

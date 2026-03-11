import type { ExecuteRequest, ExecuteResponse, SnippetRequest, SnippetResponse, Snippet } from "../types";

const API_BASE = "http://localhost:8080/api";

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

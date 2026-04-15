export type Language = "go" | "python" | "cpp" | "rust" | "javascript";

export interface ExecuteRequest {
  language: Language;
  code: string;
  stdin: string;
}

export interface ExecuteResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  wasTimeout: boolean;
}

export interface SnippetRequest {
  language: Language;
  code: string;
  title: string;
  stdin?: string;
}

export interface SnippetResponse {
  token: string;
}

export interface Snippet {
  token: string;
  language: Language;
  code: string;
  stdin: string;
  title: string;
  createdAt: string;
}

export interface SnippetExample {
  title: string;
  language: Language;
  code: string;
}

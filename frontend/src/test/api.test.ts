import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCode, createSnippet, loadSnippet, checkHealth } from "../utils/api";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("executeCode", () => {
  it("sends POST request and returns result", async () => {
    const mockResult = {
      stdout: "Hello!",
      stderr: "",
      exitCode: 0,
      durationMs: 50,
      wasTimeout: false,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await executeCode({ language: "python", code: 'print("Hello!")', stdin: "" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/execute",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.stdout).toBe("Hello!");
    expect(result.exitCode).toBe(0);
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"error":"invalid JSON"}'),
    });

    await expect(
      executeCode({ language: "python", code: "", stdin: "" }),
    ).rejects.toThrow("Execution failed");
  });
});

describe("createSnippet", () => {
  it("sends POST and returns token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: "abc123456789" }),
    });

    const result = await createSnippet({
      language: "go",
      code: "package main",
      stdin: "",
      title: "Test",
    });

    expect(result.token).toBe("abc123456789");
  });
});

describe("loadSnippet", () => {
  it("fetches snippet by token", async () => {
    const mockSnippet = {
      token: "abc123456789",
      language: "python",
      code: 'print("hi")',
      stdin: "",
      title: "Hello",
      createdAt: "2026-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSnippet),
    });

    const result = await loadSnippet("abc123456789");
    expect(result.language).toBe("python");
    expect(result.token).toBe("abc123456789");
  });

  it("throws on 404", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('{"error":"not found"}'),
    });

    await expect(loadSnippet("nonexistent")).rejects.toThrow("Failed to load snippet");
  });
});

describe("checkHealth", () => {
  it("returns true when healthy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });

    const result = await checkHealth();
    expect(result).toBe(true);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await checkHealth();
    expect(result).toBe(false);
  });
});

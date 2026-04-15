import { describe, it, expect } from "vitest";
import { snippetExamples } from "../utils/snippets";
import type { Language } from "../types";

describe("snippetExamples", () => {
  it("contains at least one example per required language", () => {
    const requiredLangs: Language[] = ["python", "go", "cpp"];
    for (const lang of requiredLangs) {
      const examples = snippetExamples.filter((s) => s.language === lang);
      expect(examples.length, `expected examples for ${lang}`).toBeGreaterThan(0);
    }
  });

  it("every snippet has required fields", () => {
    for (const snippet of snippetExamples) {
      expect(snippet.title).toBeTruthy();
      expect(snippet.language).toBeTruthy();
      expect(snippet.code).toBeTruthy();
    }
  });

  it("includes Hello World for each language", () => {
    const langs: Language[] = ["python", "go", "cpp", "rust", "javascript"];
    for (const lang of langs) {
      const hw = snippetExamples.find((s) => s.language === lang && s.title === "Hello World");
      expect(hw, `missing Hello World for ${lang}`).toBeDefined();
    }
  });
});

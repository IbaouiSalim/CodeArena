import { test, expect } from "@playwright/test";

test("loads editor with all required UI elements", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("text=CodeArena")).toBeVisible();
  await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".lang-select")).toBeVisible();
  await expect(page.getByRole("button", { name: /Run/i })).toBeVisible();
});

test("runs Python code and displays output", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.type('print("hello world")', { delay: 10 });

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const output = page.locator(".output-panel");
  await expect(output).toContainText("hello world", { timeout: 10_000 });
});

test("runs Go code and displays output", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const langSelector = page.locator(".lang-select");
  await langSelector.selectOption("go");

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  
  const goCode = `package main\nimport "fmt"\nfunc main() {\n  fmt.Println("go executed")\n}`;
  await page.keyboard.type(goCode, { delay: 5 });

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const output = page.locator(".output-panel");
  await expect(output).toContainText("go executed", { timeout: 10_000 });
});

test("runs C++ code and displays output", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const langSelector = page.locator(".lang-select");
  await langSelector.selectOption("cpp");

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  
  const cppCode = `#include <iostream>\nusing namespace std;\nint main() {\n  cout << "cpp executed" << endl;\n  return 0;\n}`;
  await page.keyboard.type(cppCode, { delay: 5 });

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const output = page.locator(".output-panel");
  await expect(output).toContainText("cpp executed", { timeout: 15_000 });
});

test("displays compilation error for invalid code", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.type("invalid python");

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const stderr = page.locator(".stderr");
  await expect(stderr).toBeVisible({ timeout: 10_000 });
});

test("accepts stdin input and displays output", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const langSelector = page.locator(".lang-select");
  await langSelector.selectOption("python");

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.type('name = input("enter name: ")\nprint(f"hello {name}")', { delay: 10 });

  const stdinInput = page.locator(".stdin-input");
  await stdinInput.fill("Alice");

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const output = page.locator(".output-panel");
  await expect(output).toContainText("hello Alice", { timeout: 10_000 });
});

test("shares code and loads shared snippet", async ({ page, context }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.type('print("shared code")', { delay: 10 });

  const shareButton = page.getByRole("button", { name: /Share/i });
  await shareButton.click();

  const shareUrl = await page.locator(".share-url").inputValue();
  const shareToken = shareUrl.split("/").pop();

  const newPage = await context.newPage();
  await newPage.goto(`/${shareToken}`);
  await newPage.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const loadedCode = await newPage.locator(".monaco-editor").textContent();
  await expect(loadedCode).toContain("shared code");
  await newPage.close();
});

test("displays timeout error for infinite loop", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.type("while True:\n    pass", { delay: 10 });

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const timeoutMsg = page.locator(".stderr, .output-panel");
  await expect(timeoutMsg).toContainText(/timeout|timed out/i, { timeout: 15_000 });
});

test("shows exit code for program that exits with error", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.type("import sys\nsys.exit(42)", { delay: 10 });

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const exitCode = page.locator(".exit-code");
  await expect(exitCode).toContainText("42", { timeout: 10_000 });
});

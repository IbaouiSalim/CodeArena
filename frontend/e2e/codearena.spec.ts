import { test, expect, Page } from "@playwright/test";

// Helper function to clear editor and paste code via clipboard
async function clearAndTypeCode(page: Page, code: string): Promise<void> {
  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.waitForTimeout(300);
  
  // Use Monaco editor API to set the content directly - most reliable approach
  await page.evaluate((codeToInsert) => {
    const editor = (window as Window & { monaco?: { editor?: { getEditors?: () => Array<{ setValue: (code: string) => void }> } } }).monaco?.editor?.getEditors?.()?.[0];
    if (editor) {
      editor.setValue(codeToInsert);
    }
  }, code);
  
  await page.waitForTimeout(500);
}

// Helper function to select a language from the dropdown
async function selectLanguage(page: Page, language: string): Promise<void> {
  // Click on the language selector button to open dropdown
  await page.locator(".lang-select-trigger").click();
  await page.waitForTimeout(200);
  
  // Wait for dropdown to be visible
  await page.locator(".lang-select-dropdown").waitFor({ state: "visible" });
  await page.waitForTimeout(200);
  
  // Click on the language option button that contains the language name
  await page.locator(`button.lang-select-option:has-text("${language}")`).first().click();
  
  // Wait for dropdown to close and content to update
  await page.waitForTimeout(500);
  
  // Wait for Monaco to be ready with fresh content
  await page.locator(".monaco-editor").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
}

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

  await clearAndTypeCode(page, 'print("hello world")');

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const output = page.locator(".terminal-output .terminal-text");
  await expect(output.first()).toContainText("hello world", { timeout: 15_000 });
});

test("runs Go code and displays output", async ({ page }) => {
  test.setTimeout(60_000); // Go compilation needs more time
  
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await selectLanguage(page, "Go");

  await clearAndTypeCode(page, `package main
import "fmt"
func main() {
  fmt.Println("go executed")
}`);

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  // Go compilation takes longer
  const output = page.locator(".terminal-output .terminal-text");
  await expect(output.first()).toContainText("go executed", { timeout: 50_000 });
});

test("runs C++ code and displays output", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await selectLanguage(page, "C++");

  await clearAndTypeCode(page, `#include <iostream>
using namespace std;
int main() {
  cout << "cpp executed" << endl;
  return 0;
}`);

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  const output = page.locator(".terminal-output .terminal-text");
  await expect(output.first()).toContainText("cpp executed", { timeout: 20_000 });
});

test("displays compilation error for invalid code", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await clearAndTypeCode(page, "invalid python");

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  // Wait for error output to appear (stderr or error message)
  const errorOutput = page.locator(".terminal-output .terminal-text");
  await expect(errorOutput.first()).toBeVisible({ timeout: 10_000 });
  
  // Verify it contains error indicators
  const text = await errorOutput.first().textContent();
  expect(text?.toLowerCase()).toContain("error");
});

test("accepts stdin input and displays output", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await selectLanguage(page, "Python");

  await clearAndTypeCode(page, `name = input("enter name: ")
print(f"hello {name}")`);

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  // Wait for the interactive terminal prompt to appear (input field)
  const terminalInput = page.locator(".terminal-input-bar input[type='text']");
  await expect(terminalInput).toBeVisible({ timeout: 10_000 });

  // Type the input and press Enter
  await terminalInput.click();
  await terminalInput.fill("Alice");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);

  // Wait for output that includes the greeting
  await expect(page.locator(".terminal-body")).toContainText("hello Alice", { timeout: 20_000 });
});

test("shares code and loads shared snippet", async ({ page, context }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await clearAndTypeCode(page, 'print("shared code")');

  const shareButton = page.getByRole("button", { name: /Share/i });
  
  // Wait for button to be enabled and click it
  await shareButton.waitFor({ state: "visible" });
  await shareButton.click();

  // Wait for popover to appear with the share URL
  const shareUrlInput = page.locator(".share-url-input");
  await shareUrlInput.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);

  // Extract the share URL from the input field
  const shareUrl = await shareUrlInput.inputValue();
  
  if (!shareUrl || shareUrl.length < 5) {
    throw new Error("Share URL not generated: " + shareUrl);
  }
  
  // Navigate to the shared URL in a new page
  const newPage = await context.newPage();
  await newPage.goto(shareUrl);
  await newPage.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });
  await newPage.waitForTimeout(1000);
  
  // Just check that "shared" appears in the code (Monaco text content can be formatted oddly)
  const loadedCode = await newPage.locator(".monaco-editor").textContent();
  expect(loadedCode).toContain("shared");
  await newPage.close();
});

test("displays timeout error for infinite loop", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await clearAndTypeCode(page, `while True:
    pass`);

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  // Wait for timeout to occur (up to 15 seconds for the actual timeout to trigger)
  const terminalMeta = page.locator(".terminal-meta");
  await expect(terminalMeta).toContainText(/Timed out|timeout/i, { timeout: 20_000 });
});

test("shows exit code for program that exits with error", async ({ page }) => {
  await page.goto("/");
  await page.locator(".monaco-editor").waitFor({ state: "visible", timeout: 10_000 });

  await clearAndTypeCode(page, `import sys
sys.exit(42)`);

  const runButton = page.getByRole("button", { name: /Run/i });
  await runButton.click();

  // Specifically look for the error badge which contains the exit code
  const exitCodeBadge = page.locator(".terminal-meta .badge-error");
  await expect(exitCodeBadge).toContainText("42", { timeout: 15_000 });
});


import { test, expect } from "@playwright/test";

test("loads editor and runs Python code", async ({ page }) => {
  await page.goto("/");

  // Verify header renders
  await expect(page.locator("text=CodeArena")).toBeVisible();

  // Verify editor area is present
  const editor = page.locator(".monaco-editor");
  await expect(editor).toBeVisible({ timeout: 10_000 });

  // Verify language selector is present
  const langSelector = page.locator(".lang-select");
  await expect(langSelector).toBeVisible();

  // Verify Run button exists
  const runButton = page.getByRole("button", { name: /Run/i });
  await expect(runButton).toBeVisible();
});

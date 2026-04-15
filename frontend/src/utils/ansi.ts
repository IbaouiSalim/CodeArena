/**
 * Strip ANSI escape codes from a string
 * ANSI codes are used by terminals for colors and formatting, but don't display properly in web environments
 * Example: \x1b[31mRed text\x1b[0m -> "Red text"
 */
export function stripAnsiCodes(text: string): string {
  // Match ANSI escape sequences: ESC[ ... (letter|other)
  // This includes color codes, cursor movements, etc.
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[mKA-Za-z]/g, "");
}

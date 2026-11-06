import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SC-009: nothing in the account screens, messages or emails mentions a password, a streak, a score or an
// internal level name, and there is no way to sign in with a password.

function sourceFiles(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
}

const files = [
  "src/app/(shell)/onboarding",
  "src/app/(shell)/sign-in",
  "src/app/(shell)/settings",
  "src/components/onboarding",
  "src/components/settings",
  "src/components/shell/AccountButton.tsx",
  "src/components/watch/SignInPrompt.tsx",
  "src/lib/onboarding/copy.ts",
  "src/auth.ts",
].flatMap(sourceFiles);

// The design's own sentences that name these words in order to deny them.
const allowed = [/No password to remember\./g, /No streaks, nothing to lose\./g, /there's no score\./g];

const visibleText = (source: string) => allowed.reduce((text, phrase) => text.replace(phrase, ""), source);

describe("account screens", () => {
  it("find the files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)("%s has no password field, credentials provider or banned words", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/type=["']password["']/);
    expect(source).not.toMatch(/\bCredentials\b/);
    const text = visibleText(source);
    // Code that talks about "password" only to deny it is limited to the allowed sentences above.
    expect(text).not.toMatch(/password/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/Superbeginner|Beginner|Intermediate|\bAdvanced\b/);
  });
});

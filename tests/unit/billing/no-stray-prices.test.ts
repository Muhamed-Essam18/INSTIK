import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

// The price config (src/lib/billing/plans.ts) is the only place an amount, a currency symbol next to a number or a
// price placeholder may be written (FR-032, SC-008). Everything else reads from it.

function sourceFiles(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
}

const configFile = join("src", "lib", "billing", "plans.ts");
const files = sourceFiles("src").filter(
  (file) => /\.(ts|tsx)$/.test(file) && !file.includes(`${sep}generated${sep}`) && file !== configFile,
);

describe("one price config", () => {
  it("finds the source files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)("%s has no price typed in it", (file) => {
    const source = readFileSync(file, "utf8");
    // A currency symbol or code right next to a number, as in "€9", "$ 12" or "9 EUR".
    expect(source).not.toMatch(/[€£]\s?\d|(?<![\w$\\{])\$\s?\d(?!\w)|\b\d+([.,]\d+)?\s?(usd|eur|gbp)\b/i);
    expect(source).not.toContain("[PRICE]");
    expect(source).not.toContain("[Save X%]");
  });

  it("the config itself holds the placeholders", () => {
    const config = readFileSync(configFile, "utf8");
    expect(config).toContain("[PRICE]");
    expect(config).toContain("[Save X%]");
  });
});

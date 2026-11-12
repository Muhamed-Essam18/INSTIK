import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { isAvailable, languages } from "../languages";
import { validateLanguageContent, type LanguageContent, type RawContent } from "./validate";

const contentRoot = path.join(process.cwd(), "content");

function readJson(file: string, relative: string): { file: string; data: unknown } {
  try {
    return { file: relative, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    // Unreadable JSON cannot reach schema validation, so report it directly.
    throw new Error(`Invalid content in ${path.relative(process.cwd(), file)}\n${relative}: file: ${(error as Error).message}`);
  }
}

function listFiles(dir: string, extension: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(extension))
        .sort()
    : [];
}

export function readLanguageFolder(slug: string): RawContent | null {
  const dir = path.join(contentRoot, slug);
  if (!existsSync(dir)) return null;
  const glossaryFile = path.join(dir, "glossary.json");
  return {
    videos: listFiles(path.join(dir, "videos"), ".json").map((n) =>
      readJson(path.join(dir, "videos", n), `videos/${n}`),
    ),
    hosts: listFiles(path.join(dir, "hosts"), ".json").map((n) => readJson(path.join(dir, "hosts", n), `hosts/${n}`)),
    transcripts: listFiles(path.join(dir, "videos"), ".vtt").map((n) => ({
      file: `videos/${n}`,
      text: readFileSync(path.join(dir, "videos", n), "utf8"),
    })),
    glossary: existsSync(glossaryFile) ? readJson(glossaryFile, "glossary.json") : undefined,
  };
}

/** Reads and validates every language's content once. Any invalid content throws, which fails `next build`. */
export function loadAllContent(): ReadonlyMap<string, LanguageContent> {
  return new Map(
    languages.map((language) => [
      language.slug,
      validateLanguageContent(language.slug, readLanguageFolder(language.slug), { available: isAvailable(language), transcriptLayers: language.transcriptLayers }),
    ]),
  );
}

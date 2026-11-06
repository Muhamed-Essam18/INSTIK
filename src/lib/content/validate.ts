import type { ZodType } from "zod";
import { glossarySchema, hostSchema, videoSchema, type Glossary, type Host, type Video } from "./schema";
import { buildGlossaryIndex } from "./glossary-link";
import { parseTranscript, type TranscriptLine } from "./transcript";
import { parseVtt } from "./vtt";

/** Files of one language folder, already read from disk. `file` is relative to the language folder. */
export type RawContent = {
  videos: { file: string; data: unknown }[];
  hosts: { file: string; data: unknown }[];
  transcripts: { file: string; text: string }[];
  glossary?: { file: string; data: unknown };
};

export type LanguageContent = {
  videos: Video[];
  hosts: Host[];
  transcripts: Record<string, TranscriptLine[]>;
  glossary: Glossary;
};

const fileSlug = (file: string) => file.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (out, part) =>
      typeof part === "number" ? `${out}[${part}]` : out ? `${out}.${String(part)}` : String(part),
    "",
  );
}

/**
 * Checks one language's content: field rules, then cross-file rules (data-model.md).
 * `raw` is null when the folder does not exist; that is only allowed for a language that is not available.
 * Throws one error listing every problem; the first line names the language folder.
 */
export function validateLanguageContent(
  language: string,
  raw: RawContent | null,
  options: { available: boolean; transcriptLayers: readonly string[] },
): LanguageContent {
  const empty: LanguageContent = { videos: [], hosts: [], transcripts: {}, glossary: { entries: [] } };
  const problems: string[] = [];
  const problem = (file: string, rule: string, message: string) => problems.push(`${file}: ${rule}: ${message}`);

  if (!raw) {
    if (options.available) problem(`content/${language}`, "folder", "is required for an available language");
    else return empty;
  } else {
    const parse = <T>(file: string, schema: ZodType<T>, data: unknown): T | undefined => {
      const result = schema.safeParse(data);
      if (result.success) return result.data;
      for (const issue of result.error.issues) problem(file, formatPath(issue.path) || "file", issue.message);
      return undefined;
    };

    const videos = raw.videos.flatMap(({ file, data }) => {
      const video = parse(file, videoSchema, data);
      if (!video) return [];
      if (video.slug !== fileSlug(file)) problem(file, "slug", `"${video.slug}" must match the file name "${fileSlug(file)}"`);
      return [{ file, video }];
    });
    const hosts = raw.hosts.flatMap(({ file, data }) => {
      const host = parse(file, hostSchema, data);
      if (!host) return [];
      if (host.slug !== fileSlug(file)) problem(file, "slug", `"${host.slug}" must match the file name "${fileSlug(file)}"`);
      return [{ file, host }];
    });

    const duplicates = <T>(items: { file: string; value: T }[], rule: string, label: (v: T) => string) => {
      const seen = new Map<string, string>();
      for (const { file, value } of items) {
        const key = label(value);
        const first = seen.get(key);
        if (first) problem(file, rule, `duplicate ${rule} ${key} (also in ${first})`);
        else seen.set(key, file);
      }
    };
    duplicates(videos.map((v) => ({ file: v.file, value: v.video.slug })), "slug", (s) => `"${s}"`);
    duplicates(hosts.map((h) => ({ file: h.file, value: h.host.slug })), "slug", (s) => `"${s}"`);
    duplicates(hosts.map((h) => ({ file: h.file, value: h.host.order })), "order", (o) => String(o));

    const hostSlugs = new Set(hosts.map((h) => h.host.slug));
    for (const { file, video } of videos) {
      if (!hostSlugs.has(video.host)) problem(file, "host", `unknown host "${video.host}"`);
    }

    // Files that failed their own checks still count as videos here, so one bad file reports one problem.
    const videoSlugs = new Set(raw.videos.map((v) => fileSlug(v.file)));
    const transcripts: Record<string, TranscriptLine[]> = {};
    for (const { file, text } of raw.transcripts) {
      const slug = fileSlug(file);
      if (!videoSlugs.has(slug)) problem(file, "video", `no video "${slug}" for this transcript`);
      const { cues, errors } = parseVtt(text);
      for (const error of errors) problem(file, "transcript", error);
      if (errors.length > 0) continue;
      const parsed = parseTranscript(options.transcriptLayers, cues);
      for (const error of parsed.errors) problem(file, "transcript", error);
      if (parsed.errors.length === 0) transcripts[slug] = parsed.lines;
    }

    let glossary: Glossary = { entries: [] };
    if (!raw.glossary) problem("glossary.json", "file", "is required");
    else {
      const parsed = parse(raw.glossary.file, glossarySchema, raw.glossary.data);
      if (parsed) {
        glossary = parsed;
        for (const error of buildGlossaryIndex(parsed.entries).errors) problem(raw.glossary.file, "word", error);
        duplicates(
          parsed.entries.map((e) => ({ file: raw.glossary!.file, value: e.id })),
          "id",
          (id) => `"${id}"`,
        );
      }
    }

    if (options.available) {
      if (raw.hosts.length === 0) problem(`content/${language}`, "hosts", "an available language needs at least one host");
      if (raw.videos.length === 0) problem(`content/${language}`, "videos", "an available language needs at least one video");
    }

    if (problems.length === 0) {
      return {
        videos: videos.map((v) => v.video),
        hosts: hosts.map((h) => h.host).sort((a, b) => a.order - b.order),
        transcripts,
        glossary,
      };
    }
  }

  throw new Error(`Invalid content in content/${language}\n${problems.join("\n")}`);
}

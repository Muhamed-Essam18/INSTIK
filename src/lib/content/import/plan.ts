// Decides what the content import should do, without touching any database. Pure.
// Rules are in specs/008-roles-invites-content-db/contracts/import-report.md.

import type { ZodType } from "zod";
import { buildGlossaryIndex } from "../glossary-link";
import { glossarySchema, hostSchema, videoSchema, type GlossaryEntry, type Host, type Video } from "../schema";
import { parseTranscript, type TranscriptLine } from "../transcript";
import type { RawContent } from "../validate";
import { parseVtt } from "../vtt";

export type ImportGroup = "hosts" | "videos" | "glossary";

/** What the database already holds for one language. Existing rows are never changed. */
export type ExistingState = {
  hostSlugs: ReadonlySet<string>;
  glossaryKeys: ReadonlySet<string>;
  /** Videos by slug. `incompleteDraft` is true for a Draft this import left because its transcript was invalid. */
  videos: ReadonlyMap<string, { incompleteDraft: boolean }>;
};

export const emptyExisting = (): ExistingState => ({
  hostSlugs: new Set(),
  glossaryKeys: new Set(),
  videos: new Map(),
});

export type PlanItem =
  | { kind: "create-host"; item: string; host: Host }
  | { kind: "create-glossary"; item: string; entry: GlossaryEntry }
  | { kind: "create-video"; item: string; video: Video; segments: TranscriptLine[] }
  | { kind: "create-video-draft"; item: string; video: Video; reason: string }
  | { kind: "complete-draft"; item: string; slug: string; segments: TranscriptLine[] }
  | { kind: "still-incomplete"; item: string; reason: string }
  | { kind: "skip-present"; group: ImportGroup; item: string }
  | { kind: "fail"; group: ImportGroup; item: string; reason: string };

export type PlanLanguage = { slug: string; available: boolean; transcriptLayers: readonly string[] };

const fileSlug = (file: string) => file.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (out, part) => (typeof part === "number" ? `${out}[${part}]` : out ? `${out}.${String(part)}` : String(part)),
    "",
  );
}

function parse<T>(schema: ZodType<T>, data: unknown): { ok: true; value: T } | { ok: false; reason: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  const reason = result.error.issues
    .map((issue) => {
      const where = formatPath(issue.path);
      return where ? `${where}: ${issue.message}` : issue.message;
    })
    .join("; ");
  return { ok: false, reason };
}

type TranscriptState =
  | { state: "none" }
  | { state: "valid"; lines: TranscriptLine[] }
  | { state: "invalid"; reason: string };

function readTranscript(text: string | undefined, layers: readonly string[]): TranscriptState {
  if (text === undefined) return { state: "none" };
  const { cues, errors } = parseVtt(text);
  if (errors.length > 0) return { state: "invalid", reason: errors.join("; ") };
  if (cues.length === 0) return { state: "invalid", reason: "the transcript file has no cues" };
  const parsed = parseTranscript(layers, cues);
  if (parsed.errors.length > 0) return { state: "invalid", reason: parsed.errors.join("; ") };
  return { state: "valid", lines: parsed.lines };
}

/** Plans the import of one language folder. `raw` is null when the folder does not exist. */
export function planImport(input: {
  language: PlanLanguage;
  raw: RawContent | null;
  existing: ExistingState;
}): PlanItem[] {
  const { language, raw, existing } = input;
  const plan: PlanItem[] = [];

  if (!raw) {
    if (language.available) {
      plan.push({
        kind: "fail",
        group: "videos",
        item: `content/${language.slug}`,
        reason: "the folder is required for an available language",
      });
    }
    return plan;
  }

  // Hosts. A host that is already stored counts as present; a failed host makes its videos fail with that reason.
  const goodHosts = new Set<string>(existing.hostSlugs);
  const failedHosts = new Map<string, string>();
  const seenHostSlugs = new Set<string>();
  for (const { file, data } of raw.hosts) {
    const item = `hosts/${fileSlug(file)}.json`;
    const parsed = parse(hostSchema, data);
    if (!parsed.ok) {
      failedHosts.set(fileSlug(file), parsed.reason);
      plan.push({ kind: "fail", group: "hosts", item, reason: parsed.reason });
      continue;
    }
    const host = parsed.value;
    if (host.slug !== fileSlug(file)) {
      const reason = `slug: "${host.slug}" must match the file name "${fileSlug(file)}"`;
      failedHosts.set(fileSlug(file), reason);
      plan.push({ kind: "fail", group: "hosts", item, reason });
      continue;
    }
    if (seenHostSlugs.has(host.slug)) {
      plan.push({ kind: "fail", group: "hosts", item, reason: `duplicate slug "${host.slug}"` });
      continue;
    }
    seenHostSlugs.add(host.slug);
    if (existing.hostSlugs.has(host.slug)) {
      plan.push({ kind: "skip-present", group: "hosts", item });
      continue;
    }
    goodHosts.add(host.slug);
    plan.push({ kind: "create-host", item, host });
  }

  // Videos.
  const transcriptByVideo = new Map(raw.transcripts.map((t) => [fileSlug(t.file), t.text] as const));
  const videoFileSlugs = new Set(raw.videos.map((v) => fileSlug(v.file)));
  const seenVideoSlugs = new Set<string>();
  for (const { file, data } of raw.videos) {
    const slug = fileSlug(file);
    const item = `videos/${slug}.json`;
    const parsed = parse(videoSchema, data);
    if (!parsed.ok) {
      plan.push({ kind: "fail", group: "videos", item, reason: parsed.reason });
      continue;
    }
    const video = parsed.value;
    if (video.slug !== slug) {
      plan.push({
        kind: "fail",
        group: "videos",
        item,
        reason: `slug: "${video.slug}" must match the file name "${slug}"`,
      });
      continue;
    }
    if (seenVideoSlugs.has(video.slug)) {
      plan.push({ kind: "fail", group: "videos", item, reason: `duplicate slug "${video.slug}"` });
      continue;
    }
    seenVideoSlugs.add(video.slug);

    const present = existing.videos.get(video.slug);
    const transcript = readTranscript(transcriptByVideo.get(slug), language.transcriptLayers);

    if (present) {
      // Only a draft this import left behind is ever touched, and only to finish it.
      if (present.incompleteDraft && transcript.state !== "invalid") {
        plan.push({
          kind: "complete-draft",
          item,
          slug: video.slug,
          segments: transcript.state === "valid" ? transcript.lines : [],
        });
      } else if (present.incompleteDraft && transcript.state === "invalid") {
        // Still waiting for a fixed source: keep reporting it so the run does not look clean.
        plan.push({ kind: "still-incomplete", item, reason: transcript.reason });
      } else {
        plan.push({ kind: "skip-present", group: "videos", item });
      }
      continue;
    }

    if (failedHosts.has(video.host)) {
      plan.push({
        kind: "fail",
        group: "videos",
        item,
        reason: `host "${video.host}" could not be imported: ${failedHosts.get(video.host)}`,
      });
      continue;
    }
    if (!goodHosts.has(video.host)) {
      plan.push({ kind: "fail", group: "videos", item, reason: `unknown host "${video.host}"` });
      continue;
    }

    if (transcript.state === "invalid") {
      plan.push({ kind: "create-video-draft", item, video, reason: transcript.reason });
    } else {
      plan.push({
        kind: "create-video",
        item,
        video,
        segments: transcript.state === "valid" ? transcript.lines : [],
      });
    }
  }

  // A transcript with no video file belongs to nothing.
  for (const { file } of raw.transcripts) {
    const slug = fileSlug(file);
    if (!videoFileSlugs.has(slug) && !existing.videos.has(slug)) {
      plan.push({ kind: "fail", group: "videos", item: `videos/${slug}.vtt`, reason: `no video "${slug}" for this transcript` });
    }
  }

  // Glossary.
  if (!raw.glossary) {
    if (language.available) plan.push({ kind: "fail", group: "glossary", item: "glossary.json", reason: "the file is required" });
  } else {
    const parsed = parse(glossarySchema, raw.glossary.data);
    if (!parsed.ok) {
      plan.push({ kind: "fail", group: "glossary", item: "glossary.json", reason: parsed.reason });
    } else {
      const accepted: GlossaryEntry[] = [];
      const seenIds = new Set<string>();
      for (const entry of parsed.value.entries) {
        const item = `glossary.json#${entry.id}`;
        if (seenIds.has(entry.id)) {
          plan.push({ kind: "fail", group: "glossary", item, reason: `duplicate id "${entry.id}"` });
          continue;
        }
        const { errors } = buildGlossaryIndex([...accepted, entry]);
        if (errors.length > 0) {
          plan.push({ kind: "fail", group: "glossary", item, reason: errors[0] });
          continue;
        }
        seenIds.add(entry.id);
        accepted.push(entry);
        if (existing.glossaryKeys.has(entry.id)) plan.push({ kind: "skip-present", group: "glossary", item });
        else plan.push({ kind: "create-glossary", item, entry });
      }
    }
  }

  return plan;
}

// Applies an import plan through a store and builds the report (contracts/import-report.md).
// The import writes only through its own ImportStore and never calls the status change service:
// it is the one place allowed to create a video directly as Approved.

import type { Host, Video } from "../schema";
import type { TranscriptLine } from "../transcript";
import type { RawContent } from "../validate";
import { planImport, type ExistingState, type PlanItem, type PlanLanguage } from "./plan";

export const IMPORT_ACTOR = "import";
export const NOTE_IMPORTED = "Imported from content files";
export const NOTE_INCOMPLETE_PREFIX = "Import incomplete:";
export const NOTE_COMPLETED = "Import completed: transcript added";

export type ImportLanguage = PlanLanguage & { code: string };

/** The first history entry of an imported video, or the one that finishes an import draft. */
export type ImportEvent = {
  fromStatus: "DRAFT" | null;
  toStatus: "APPROVED" | "DRAFT";
  actorLabel: typeof IMPORT_ACTOR;
  note: string;
};

/** The database side of the import. Each video, with its segments and event, is one transaction. */
export interface ImportStore {
  loadExisting(languageCode: string): Promise<ExistingState>;
  createHost(languageCode: string, host: Host): Promise<void>;
  createGlossaryEntry(languageCode: string, entry: { id: string; word: string; base: string; transliteration: string; english: string; audio?: string }): Promise<void>;
  createVideo(input: { languageCode: string; video: Video; segments: TranscriptLine[]; status: "APPROVED" | "DRAFT"; event: ImportEvent }): Promise<void>;
  completeDraft(input: { languageCode: string; slug: string; segments: TranscriptLine[]; event: ImportEvent }): Promise<void>;
}

type Problem = { item: string; reason: string };

export type LanguageReport = {
  language: string;
  hosts: { imported: number; alreadyPresent: number; failed: Problem[] };
  videos: { imported: number; alreadyPresent: number; incomplete: Problem[]; failed: Problem[] };
  transcripts: { imported: number };
  glossary: { imported: number; alreadyPresent: number; failed: Problem[] };
};

export type ImportReport = { dryRun: boolean; languages: LanguageReport[]; ok: boolean };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function applyLanguage(
  language: ImportLanguage,
  plan: PlanItem[],
  store: ImportStore,
  dryRun: boolean,
): Promise<LanguageReport> {
  const report: LanguageReport = {
    language: language.slug,
    hosts: { imported: 0, alreadyPresent: 0, failed: [] },
    videos: { imported: 0, alreadyPresent: 0, incomplete: [], failed: [] },
    transcripts: { imported: 0 },
    glossary: { imported: 0, alreadyPresent: 0, failed: [] },
  };
  const code = language.code;

  // Hosts and glossary first, so videos can refer to them.
  const order = (item: PlanItem) => (item.kind === "create-host" ? 0 : item.kind === "create-glossary" ? 1 : 2);
  for (const step of [...plan].sort((a, b) => order(a) - order(b))) {
    try {
      switch (step.kind) {
        case "skip-present":
          report[step.group].alreadyPresent += 1;
          break;
        case "fail":
          report[step.group].failed.push({ item: step.item, reason: step.reason });
          break;
        case "still-incomplete":
          report.videos.incomplete.push({ item: step.item, reason: step.reason });
          break;
        case "create-host":
          if (!dryRun) await store.createHost(code, step.host);
          report.hosts.imported += 1;
          break;
        case "create-glossary":
          if (!dryRun) await store.createGlossaryEntry(code, step.entry);
          report.glossary.imported += 1;
          break;
        case "create-video":
          if (!dryRun) {
            await store.createVideo({
              languageCode: code,
              video: step.video,
              segments: step.segments,
              status: "APPROVED",
              event: { fromStatus: null, toStatus: "APPROVED", actorLabel: IMPORT_ACTOR, note: NOTE_IMPORTED },
            });
          }
          report.videos.imported += 1;
          if (step.segments.length > 0) report.transcripts.imported += 1;
          break;
        case "create-video-draft":
          if (!dryRun) {
            await store.createVideo({
              languageCode: code,
              video: step.video,
              segments: [],
              status: "DRAFT",
              event: {
                fromStatus: null,
                toStatus: "DRAFT",
                actorLabel: IMPORT_ACTOR,
                note: `${NOTE_INCOMPLETE_PREFIX} ${step.reason}`,
              },
            });
          }
          report.videos.incomplete.push({ item: step.item, reason: step.reason });
          break;
        case "complete-draft":
          if (!dryRun) {
            await store.completeDraft({
              languageCode: code,
              slug: step.slug,
              segments: step.segments,
              event: { fromStatus: "DRAFT", toStatus: "APPROVED", actorLabel: IMPORT_ACTOR, note: NOTE_COMPLETED },
            });
          }
          report.videos.imported += 1;
          if (step.segments.length > 0) report.transcripts.imported += 1;
          break;
      }
    } catch (error) {
      // One item failing never stops the run: name it and go on.
      const group = step.kind === "create-host" ? "hosts" : step.kind === "create-glossary" ? "glossary" : "videos";
      report[group].failed.push({ item: step.item, reason: message(error) });
    }
  }
  return report;
}

/** Runs the import for every language. Safe to run again: existing rows are never changed. */
export async function runImport(input: {
  languages: readonly ImportLanguage[];
  readRaw: (languageSlug: string) => RawContent | null;
  store: ImportStore;
  dryRun?: boolean;
}): Promise<ImportReport> {
  const dryRun = input.dryRun ?? false;
  const languages: LanguageReport[] = [];
  for (const language of input.languages) {
    const raw = input.readRaw(language.slug);
    // A language with no folder and not available has nothing to import.
    if (!raw && !language.available) continue;
    const existing = await input.store.loadExisting(language.code);
    const plan = planImport({ language, raw, existing });
    languages.push(await applyLanguage(language, plan, input.store, dryRun));
  }
  const ok = languages.every(
    (l) => l.hosts.failed.length + l.videos.failed.length + l.videos.incomplete.length + l.glossary.failed.length === 0,
  );
  return { dryRun, languages, ok };
}

/** The report as plain text for the terminal. */
export function formatReport(report: ImportReport): string {
  const lines: string[] = [];
  if (report.dryRun) lines.push("Dry run: nothing was written.");
  let attention = 0;
  for (const l of report.languages) {
    lines.push(`${l.language}`);
    lines.push(`  hosts:       ${l.hosts.imported} imported, ${l.hosts.alreadyPresent} already present, ${l.hosts.failed.length} failed`);
    lines.push(
      `  videos:      ${l.videos.imported} imported, ${l.videos.alreadyPresent} already present, ${l.videos.incomplete.length} incomplete, ${l.videos.failed.length} failed`,
    );
    lines.push(`  transcripts: ${l.transcripts.imported} imported`);
    lines.push(`  glossary:    ${l.glossary.imported} imported, ${l.glossary.alreadyPresent} already present, ${l.glossary.failed.length} failed`);
    const groups: [string, Problem[]][] = [
      ["incomplete", l.videos.incomplete],
      ["failed", [...l.hosts.failed, ...l.videos.failed, ...l.glossary.failed]],
    ];
    for (const [label, items] of groups) {
      for (const p of items) {
        attention += 1;
        lines.push(`    ${label}: ${p.item}: ${p.reason}`);
      }
    }
  }
  lines.push(attention === 0 ? "Done: all content is in the database." : `Needs attention: ${attention} items.`);
  return lines.join("\n");
}

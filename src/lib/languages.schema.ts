import { z } from "zod";

const fontToken = z.enum(["display", "sans", "arabic", "naskh"], {
  error: "unknown font token",
});

const layer = z.enum(["script", "tashkeel", "transliteration", "english"]);

const estimateStage = z.enum(["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT"], {
  error: 'expected "HEAR_IT", "FOLLOW_IT" or "UNDERSTAND_IT"',
});

const ESTIMATE_ORDER = ["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT"] as const;

/**
 * Hour estimates for the roadmap stages. `provisional` must be present: while the numbers are placeholders
 * the file says so, and a final number cannot slip in unflagged. Join in has no estimate.
 */
const roadmapSchema = z
  .object({
    provisional: z.boolean({ error: "must say whether the estimates are provisional" }),
    note: z.string().min(1, "must not be empty"),
    stages: z
      .array(z.object({ stage: estimateStage, upToHours: z.number().positive("must be above 0") }))
      .min(1, "must not be empty"),
  })
  .superRefine((roadmap, ctx) => {
    let previousIndex = -1;
    let previousHours = 0;
    for (const [i, entry] of roadmap.stages.entries()) {
      const index = ESTIMATE_ORDER.indexOf(entry.stage);
      if (index <= previousIndex) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "stage"],
          message: `"${entry.stage}" is repeated or out of order (expected Hear it, Follow it, Understand it)`,
        });
      }
      if (entry.upToHours <= previousHours) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "upToHours"],
          message: "must be greater than the stage before it",
        });
      }
      previousIndex = Math.max(previousIndex, index);
      previousHours = Math.max(previousHours, entry.upToHours);
    }
  });

const languageSchema = z.object({
  code: z.string().min(1),
  slug: z.string().refine((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s), {
    error: (issue) => `"${String(issue.input)}" is not a valid slug`,
  }),
  name: z.string().min(1),
  variety: z.string().min(1).optional(),
  nativeName: z.string().min(1),
  /** One line shown under the language name when choosing a language (onboarding). */
  description: z.string().min(1).optional(),
  /** The learner-facing "Did you follow this one?" word in the target language (for example فاهم؟); optional. */
  understoodWord: z.string().min(1).optional(),
  script: z.enum(["arabic", "latin"], { error: 'expected "arabic" or "latin"' }),
  direction: z.enum(["rtl", "ltr"], { error: 'expected "rtl" or "ltr"' }),
  status: z.enum(["available", "coming-soon"], {
    error: 'expected "available" or "coming-soon"',
  }),
  fonts: z.object({ ui: fontToken, transcript: fontToken }),
  /** Provisional hour estimates per stage; absent means the roadmap shows no "more hours" line. */
  roadmap: roadmapSchema.optional(),
  transcriptLayers: z
    .array(layer)
    .min(1, "must not be empty")
    .superRefine((layers, ctx) => {
      const seen = new Set<string>();
      for (const l of layers) {
        if (seen.has(l)) {
          ctx.addIssue({ code: "custom", message: `duplicate "${l}"` });
        }
        seen.add(l);
      }
    }),
});

export const languagesFileSchema = z
  .object({
    languages: z
      .array(languageSchema, { error: 'expected a non-empty "languages" array' })
      .min(1, 'expected a non-empty "languages" array'),
  })
  .superRefine(({ languages }, ctx) => {
    for (const key of ["slug", "code"] as const) {
      const seen = new Set<string>();
      for (const language of languages) {
        const value = language[key];
        if (seen.has(value)) {
          ctx.addIssue({
            code: "custom",
            path: ["languages"],
            message: `duplicate ${key} "${value}"`,
          });
        }
        seen.add(value);
      }
    }
    if (!languages.some((l) => l.status === "available")) {
      ctx.addIssue({
        code: "custom",
        path: ["languages"],
        message: "at least one language must be available",
      });
    }
  });

export type Language = z.infer<typeof languageSchema>;
export type RoadmapEstimates = NonNullable<Language["roadmap"]>;
export type FontToken = z.infer<typeof fontToken>;

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (out, part) =>
      typeof part === "number" ? `${out}[${part}]` : out ? `${out}.${String(part)}` : String(part),
    "",
  );
}

function valueAt(data: unknown, path: PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (v, key) => (v && typeof v === "object" ? (v as Record<PropertyKey, unknown>)[key] : undefined),
    data,
  );
}

/** Validates the parsed JSON of `content/languages.json`; throws one readable error listing every problem. */
export function parseLanguagesFile(data: unknown): Language[] {
  const result = languagesFileSchema.safeParse(data);
  if (result.success) return result.data.languages;

  const lines = result.error.issues.map((issue) => {
    const path = formatPath(issue.path);
    if (issue.path.length > 1 && valueAt(data, issue.path) === undefined) {
      return `${path.replace(/\.[^.]+$/, "")}: "${String(issue.path.at(-1))}" is required`;
    }
    return path ? `${path}: ${issue.message}` : `languages.json: ${issue.message}`;
  });
  throw new Error(`Invalid content/languages.json\n${lines.join("\n")}`);
}

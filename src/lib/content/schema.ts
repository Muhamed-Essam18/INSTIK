import { z } from "zod";
import { stageSlugs, topicSlugs } from "./taxonomy";

const slug = z.string().refine((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s), {
  error: (issue) => `"${String(issue.input)}" is not a valid slug`,
});
const text = z.string().min(1, "must not be empty");

export const videoSchema = z.strictObject({
  sample: z.boolean().optional(),
  title: text,
  titleArabic: text.optional(),
  slug,
  stage: z.enum(stageSlugs),
  topic: z.enum(topicSlugs),
  host: slug,
  durationSeconds: z.int().min(1, "must be at least 1 second"),
  access: z.enum(["free", "full"]),
  playbackId: text.optional(),
});

export const hostSchema = z.strictObject({
  sample: z.boolean().optional(),
  slug,
  name: text,
  nameArabic: text,
  story: text,
  topics: z.array(text).min(1, "needs at least 1 topic").max(6, "at most 6 topics"),
  photo: z.string().min(1).nullable().optional(),
  order: z.int(),
});

export const glossaryEntrySchema = z.strictObject({
  id: text,
  word: text,
  base: text,
  transliteration: text,
  english: text,
  audio: text.optional(),
});

export const glossarySchema = z.strictObject({
  sample: z.boolean().optional(),
  entries: z.array(glossaryEntrySchema),
});

export type Video = z.infer<typeof videoSchema>;
export type Host = z.infer<typeof hostSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type Glossary = z.infer<typeof glossarySchema>;

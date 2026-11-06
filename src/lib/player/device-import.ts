import {
  layersKey,
  listStoredKeys,
  parseStored,
  readRaw,
  removeStoredWhere,
  layersSchema,
  understoodKey,
  understoodSchema,
  type Layers,
  type Understood,
} from "@/lib/player/preferences";

// Before accounts, transcript layers and فاهم؟ answers were kept on the device under
// `instik:v1:<language slug>:layers` and `instik:v1:<language slug>:understood:<video slug>`.
// Autoplay keys are not matched. This module reads them once so they can move to the account, and removes them.
const DEVICE_CHOICE_KEY = /^instik:v1:([^:]+):(layers|understood:(.+))$/;

type LanguageRef = { slug: string; code: string };

/** Choices found on this device, keyed by language code. Values are as stored; the merge validates them. */
export type DeviceChoices = {
  layers: Record<string, Record<string, boolean>>;
  answers: Record<string, Record<string, Understood>>;
};

/** Reads the old device keys for the given languages. Corrupt values and unknown languages are skipped. */
export function collectDeviceChoices(languages: readonly LanguageRef[]): DeviceChoices {
  const found: DeviceChoices = { layers: {}, answers: {} };
  const codeBySlug = new Map(languages.map((l) => [l.slug, l.code]));
  for (const key of listStoredKeys()) {
    const match = DEVICE_CHOICE_KEY.exec(key);
    const code = match && codeBySlug.get(match[1]);
    if (!match || !code) continue;
    if (match[2] === "layers") {
      const layers = parseStored(readRaw(key), layersSchema);
      if (layers) found.layers[code] = { ...layers };
    } else {
      const answer = parseStored(readRaw(key), understoodSchema);
      if (answer) (found.answers[code] ??= {})[match[3]] = answer;
    }
  }
  return found;
}

export type MergeInput = {
  device: { layers: Record<string, Record<string, unknown>>; answers: Record<string, Record<string, unknown>> };
  /** Language codes the learner has a profile for. */
  profiles: readonly string[];
  /** Language codes the account already has transcript layers for. */
  accountLayers: ReadonlySet<string>;
  /** `<language code>:<video slug>` for every answer the account already has. */
  accountAnswers: ReadonlySet<string>;
  /** Each language's layer names and video slugs. */
  languages: Record<string, { layers: readonly string[]; videos: readonly string[] }>;
};

type AnswerRef = { languageCode: string; videoSlug: string };

export type MergeResult = {
  /** What to write to the account. */
  save: {
    layers: Record<string, Partial<Layers>>;
    answers: (AnswerRef & { answer: Understood })[];
  };
  /** Safe to delete from the device: moved, already on the account, or not valid. */
  remove: { layers: string[]; answers: AnswerRef[] };
  /** Valid but not movable yet (the language has no profile): stays on the device until sign-out. */
  keep: { layers: string[]; answers: AnswerRef[] };
};

/**
 * Decides what moves from the device to the account. Where the account already has a choice it wins, and nothing
 * on the account is ever deleted. Pure and idempotent.
 */
export function mergeDeviceChoices({ device, profiles, accountLayers, accountAnswers, languages }: MergeInput): MergeResult {
  const result: MergeResult = {
    save: { layers: {}, answers: [] },
    remove: { layers: [], answers: [] },
    keep: { layers: [], answers: [] },
  };

  for (const [code, stored] of Object.entries(device.layers)) {
    const language = languages[code];
    if (!language) {
      result.remove.layers.push(code);
      continue;
    }
    const valid = Object.fromEntries(
      Object.entries(stored).filter(([name, value]) => language.layers.includes(name) && typeof value === "boolean"),
    ) as Partial<Layers>;
    if (Object.keys(valid).length === 0) {
      result.remove.layers.push(code);
    } else if (!profiles.includes(code)) {
      result.keep.layers.push(code);
    } else {
      if (!accountLayers.has(code)) result.save.layers[code] = valid;
      result.remove.layers.push(code);
    }
  }

  for (const [code, byVideo] of Object.entries(device.answers)) {
    const language = languages[code];
    for (const [videoSlug, value] of Object.entries(byVideo)) {
      const ref = { languageCode: code, videoSlug };
      const answer = understoodSchema.safeParse(value);
      if (!language || !language.videos.includes(videoSlug) || !answer.success) {
        result.remove.answers.push(ref);
      } else if (!profiles.includes(code)) {
        result.keep.answers.push(ref);
      } else {
        if (!accountAnswers.has(`${code}:${videoSlug}`)) result.save.answers.push({ ...ref, answer: answer.data });
        result.remove.answers.push(ref);
      }
    }
  }
  return result;
}

/** Deletes the named device keys (after the account has them, or when they are not valid). */
export function removeDeviceKeys(
  languages: readonly LanguageRef[],
  remove: { layers: readonly string[]; answers: readonly AnswerRef[] },
): void {
  const slugByCode = new Map(languages.map((l) => [l.code, l.slug]));
  const keys = new Set<string>();
  for (const code of remove.layers) {
    const slug = slugByCode.get(code);
    if (slug) keys.add(layersKey(slug));
  }
  for (const { languageCode, videoSlug } of remove.answers) {
    const slug = slugByCode.get(languageCode);
    if (slug) keys.add(understoodKey(slug, videoSlug));
  }
  removeStoredWhere((key) => keys.has(key));
}

/**
 * Removes every transcript choice and check answer kept on this device, including any that could not be moved
 * to an account yet. Run on sign-out so another person on the same device can never receive them.
 */
export function clearDeviceChoices(): void {
  removeStoredWhere((key) => DEVICE_CHOICE_KEY.test(key));
}

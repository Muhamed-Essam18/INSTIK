import type { Language } from "@/lib/languages.schema";

export const OTHER_CODE = "other";

export type WaitlistOption = { code: string; name: string };

/** The languages a visitor can ask for: those not yet available, in data order, then "Other". */
export function waitlistOptions(languages: readonly Language[]): WaitlistOption[] {
  return [
    ...languages.filter((l) => l.status === "coming-soon").map((l) => ({ code: l.code, name: l.name })),
    { code: OTHER_CODE, name: "Other" },
  ];
}

export function isWaitlistCode(code: unknown, languages: readonly Language[]): code is string {
  return typeof code === "string" && waitlistOptions(languages).some((o) => o.code === code);
}

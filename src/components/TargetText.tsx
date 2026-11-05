import type { FontToken, Language } from "@/lib/languages.schema";

const fontClass: Record<FontToken, string> = {
  display: "font-display",
  sans: "font-sans",
  arabic: "font-arabic",
  naskh: "font-naskh",
};

type Props = {
  language: Language;
  children: string;
  variant?: "ui" | "transcript";
  /** Replaces the default size classes, for places where the design sets its own size. */
  sizeClass?: string;
};

/** Renders target-language text with its own direction, language code, font and size. Text is never altered. */
export function TargetText({ language, children, variant = "ui", sizeClass }: Props) {
  const font = fontClass[language.fonts[variant]];
  const size =
    sizeClass ??
    (language.script === "arabic" ? (variant === "transcript" ? "text-transcript" : "text-arabic-ui") : "text-body");
  return (
    <span dir={language.direction} lang={language.code} style={{ unicodeBidi: "isolate" }} className={`${font} ${size}`}>
      {children}
    </span>
  );
}

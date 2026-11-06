import { useId } from "react";
import type { Language } from "@/lib/languages.schema";
import type { Layers } from "@/lib/player/preferences";

type Props = {
  language: Language;
  layers: Layers;
  onChange: (layers: Layers) => void;
};

type LayerKey = keyof Layers;

const chip = "min-h-11 cursor-pointer rounded-pill border px-4 text-label disabled:cursor-not-allowed disabled:opacity-60";

/** One toggle per layer the language has; the script layer is named after the language (for example "Arabic"). */
export function LayerToggles({ language, layers, onChange }: Props) {
  const noteId = useId();
  const labels: Record<LayerKey, string> = {
    script: language.name,
    tashkeel: "Tashkeel",
    transliteration: "Transliteration",
    english: "English",
  };
  const available = (["script", "tashkeel", "transliteration", "english"] as const).filter((key) =>
    language.transcriptLayers.includes(key),
  );

  return (
    <div role="group" aria-label="Show in transcript" className="flex flex-wrap gap-space-2">
      {available.map((key) => {
        const on = layers[key];
        const blocked = key === "tashkeel" && !layers.script;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            disabled={blocked}
            aria-describedby={blocked ? noteId : undefined}
            onClick={() => onChange({ ...layers, [key]: !on })}
            className={`${chip} ${on ? "border-ink bg-ink text-cream" : "border-slate bg-paper text-ink"}`}
          >
            {labels[key]}
          </button>
        );
      })}
      {!layers.script && available.includes("tashkeel") ? (
        <span id={noteId} className="sr-only">
          Tashkeel needs {labels.script} switched on.
        </span>
      ) : null}
    </div>
  );
}

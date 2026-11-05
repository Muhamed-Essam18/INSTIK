import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TargetText } from "@/components/TargetText";
import { getLanguageBySlug } from "@/lib/languages";
import type { Language } from "@/lib/languages.schema";

afterEach(cleanup);

const arabic = getLanguageBySlug("arabic-egyptian")!;
const spanish = getLanguageBySlug("spanish")!;
const sample = "إزَّيَّك؟ عامل إيه النهارده؟";

function el(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

describe("TargetText", () => {
  it("sets dir and lang for Egyptian Arabic", () => {
    const { container } = render(<TargetText language={arabic}>{sample}</TargetText>);
    expect(el(container).getAttribute("dir")).toBe("rtl");
    expect(el(container).getAttribute("lang")).toBe("arz");
    expect(el(container).className).toContain("font-arabic");
  });

  it("uses the Naskh class for the transcript variant", () => {
    const { container } = render(
      <TargetText language={arabic} variant="transcript">
        {sample}
      </TargetText>,
    );
    expect(el(container).className).toContain("font-naskh");
    expect(el(container).className).toContain("text-transcript");
  });

  it("renders Spanish left to right", () => {
    const { container } = render(<TargetText language={spanish}>Hola</TargetText>);
    expect(el(container).getAttribute("dir")).toBe("ltr");
    expect(el(container).getAttribute("lang")).toBe("es");
  });

  it("passes text through unchanged, tashkeel included", () => {
    const { container } = render(<TargetText language={arabic}>{sample}</TargetText>);
    expect(el(container).textContent).toBe(sample);
  });

  it("works for a synthetic ltr language", () => {
    const synthetic: Language = { ...spanish, code: "xx", direction: "ltr" };
    const { container } = render(<TargetText language={synthetic}>abc</TargetText>);
    expect(el(container).getAttribute("dir")).toBe("ltr");
    expect(el(container).getAttribute("lang")).toBe("xx");
  });
});

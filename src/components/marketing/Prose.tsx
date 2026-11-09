import type { ReactNode } from "react";
import { Wrap } from "./Wrap";

/** A readable single column for About and Privacy: one h1, then sections built with `ProseSection`. */
export function Prose({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Wrap max="max-w-[760px]" className="flex flex-col gap-10 pt-12 pb-24">
      <h1 className="font-display text-[36px] leading-[42px] font-extrabold md:text-[48px] md:leading-[54px]">{title}</h1>
      {children}
    </Wrap>
  );
}

export function ProseSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-[17px] leading-[27px]">
      <h2 className="font-display text-[28px] leading-[34px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

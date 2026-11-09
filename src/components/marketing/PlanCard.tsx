import type { ReactNode } from "react";

type Props = {
  name: string;
  /** The big price line: price and period. */
  price: ReactNode;
  items: readonly string[];
  /** Colour of the check marks. */
  tick: string;
  cta: ReactNode;
  badge?: ReactNode;
  dark?: boolean;
};

const check = (stroke: string) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="mt-0.5 shrink-0"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** One plan: Free (white) or Full access (ink). The button is passed in, so the card does not know where it goes. */
export function PlanCard({ name, price, items, tick, cta, badge, dark = false }: Props) {
  return (
    <section
      className={`flex flex-col gap-5 rounded-lg p-6 sm:p-9 ${dark ? "bg-ink text-cream" : "bg-paper"}`}
    >
      <div className="flex items-center gap-3">
        <h2 className="grow font-display text-[28px] leading-[34px] font-extrabold">{name}</h2>
        {badge}
      </div>
      <p className="flex items-baseline gap-1.5">{price}</p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            {check(tick)}
            {item}
          </li>
        ))}
      </ul>
      <div className="grow" />
      {cta}
    </section>
  );
}

import type { ReactNode } from "react";

/** The marketing page width (1240px as in the designs) and side padding. */
export function Wrap({
  children,
  className = "",
  max = "max-w-[1240px]",
}: {
  children: ReactNode;
  className?: string;
  max?: string;
}) {
  return <div className={`mx-auto w-full ${max} px-4 md:px-8 ${className}`}>{children}</div>;
}

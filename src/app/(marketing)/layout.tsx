import type { ReactNode } from "react";
import { MarketingFrame } from "@/components/marketing/MarketingFrame";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingFrame>{children}</MarketingFrame>;
}

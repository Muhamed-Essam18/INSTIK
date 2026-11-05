import type { ReactNode } from "react";
import { ShellFrame } from "@/components/shell/ShellFrame";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <ShellFrame>{children}</ShellFrame>;
}

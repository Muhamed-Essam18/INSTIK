import { Suspense, type ReactNode } from "react";
import { OwnerNav, OwnerNavFallback } from "@/components/owner/OwnerNav";

/** The owner area: its navigation above the page. Every page behind it checks the owner role itself. */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<OwnerNavFallback />}>
        <OwnerNav />
      </Suspense>
      {children}
    </>
  );
}

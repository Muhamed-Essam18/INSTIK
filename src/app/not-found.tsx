import type { Metadata } from "next";
import Link from "next/link";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { landingPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Page not found · Instik" };

export default function NotFound() {
  return (
    <ShellFrame>
      <div className="flex flex-col gap-space-4">
        <h1 className="font-display text-title text-ink">We can&apos;t find that page</h1>
        <p className="text-body-lg text-ink">It may have moved, or it may never have been here.</p>
        <Link href={landingPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
          Back to the start
        </Link>
      </div>
    </ShellFrame>
  );
}

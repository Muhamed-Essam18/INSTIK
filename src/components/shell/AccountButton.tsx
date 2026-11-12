"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import type { PanelLink } from "@/lib/roles/panels";
import { clearDraft } from "@/lib/onboarding/draft-storage";
import { clearDeviceChoices } from "@/lib/player/device-import";
import { settingsPath } from "@/lib/routes";

const itemClass =
  "flex min-h-11 w-full items-center rounded-sm px-space-3 text-left text-body text-ink no-underline hover:bg-coral-tint hover:text-ink focus-visible:bg-coral-tint";

/** The account button and its small menu: the panels for the person's role, Settings and Sign out. */
export function AccountButton({ initial, panels = [] }: { initial: string; panels?: PanelLink[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      list.at(-1)?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  async function signOut(event: React.FormEvent) {
    event.preventDefault();
    // Forget this device's choices first so the next person who signs in here can never receive them.
    try {
      clearDraft();
      clearDeviceChoices();
    } catch {
      // Clearing is best effort; signing out must still happen.
    }
    await signOutAction();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Your account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-pill bg-ink text-body font-semibold text-cream"
      >
        <span aria-hidden="true">{initial}</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Your account"
          onKeyDown={onMenuKeyDown}
          className="absolute top-full right-0 z-50 mt-space-2 flex w-56 max-w-[calc(100vw-32px)] flex-col gap-1 rounded-md bg-paper p-space-2 shadow-md"
        >
          {panels.map((panel) => (
            <Link key={panel.href} href={panel.href} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              {panel.label}
            </Link>
          ))}
          <Link href={settingsPath()} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            Settings
          </Link>
          <form onSubmit={signOut}>
            <button type="submit" role="menuitem" className={itemClass}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

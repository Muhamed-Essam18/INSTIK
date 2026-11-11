"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const REFRESH_EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 30_000;

type Notice = { text: string; tone?: "calm" };

/** What each known `?checkout=` (pricing) and `?billing=` (settings) value says. Anything else says nothing. */
const messages: Record<string, string> = {
  "checkout:cancelled": "No payment was taken. You can try again whenever you like.",
  "checkout:unavailable": "We couldn't reach the payment page. Please try again in a moment.",
  "billing:success": "You have Full access. Enjoy every video.",
  "billing:pending": "Setting things up. This usually takes a few seconds.",
  "billing:unavailable": "We couldn't reach the payment page. Please try again in a moment.",
};
const TAKING_LONGER =
  "This is taking a little longer than usual. You will have access as soon as the payment clears.";

function Pending() {
  const router = useRouter();
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  // The server swaps `?billing=pending` for `?billing=success` once access is on. Until then, look again every
  // couple of seconds, and after half a minute stop and say so kindly.
  useEffect(() => {
    const refresh = setInterval(() => router.refresh(), REFRESH_EVERY_MS);
    const giveUp = setTimeout(() => {
      clearInterval(refresh);
      setWaitedTooLong(true);
    }, GIVE_UP_AFTER_MS);
    return () => {
      clearInterval(refresh);
      clearTimeout(giveUp);
    };
  }, [router]);

  return <>{waitedTooLong ? TAKING_LONGER : messages["billing:pending"]}</>;
}

function NoticeBody() {
  const params = useSearchParams();
  const checkout = params.get("checkout");
  const billing = params.get("billing");
  const key = billing ? `billing:${billing}` : checkout ? `checkout:${checkout}` : null;
  if (!key || !(key in messages)) return null;

  const notice: Notice = { text: messages[key] };
  return (
    <p
      role="status"
      aria-live="polite"
      className="m-0 rounded-md bg-paper px-space-4 py-space-3 text-center text-body text-ink"
    >
      {key === "billing:pending" ? <Pending /> : notice.text}
    </p>
  );
}

/** A calm line at the top of pricing or settings after Checkout. Reads the query inside Suspense so the page stays static. */
export function BillingNotice() {
  return (
    <Suspense fallback={null}>
      <NoticeBody />
    </Suspense>
  );
}

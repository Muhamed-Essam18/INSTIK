import { vi } from "vitest";

/** Shared stand-in for next/navigation: `vi.mock("next/navigation", () => import("../helpers/next-navigation"))`. */
export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
export const pathname = { value: "/" };
export const useRouter = () => router;
export const usePathname = () => pathname.value;

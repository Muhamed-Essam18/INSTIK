import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { gateRedirect, hasSessionCookie, isProtectedPath } from "@/lib/auth/gate";

// An optimistic check only: it looks for a session cookie and nothing else. Whether the session is valid
// and what the learner may see is decided in the Data Access Layer (`src/lib/session.ts`), not here.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname) && !hasSessionCookie(request.cookies.getAll())) {
    return NextResponse.redirect(new URL(gateRedirect(pathname, search), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/learn/:language/watch/:video+",
    "/learn/:language/roadmap",
    "/learn/:language/done",
    "/settings/:path*",
  ],
};

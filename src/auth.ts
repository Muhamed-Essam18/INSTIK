import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const LINK_LIFETIME_SECONDS = 60 * 60; // a sign-in link works once and lasts an hour
const DAY = 24 * 60 * 60;

/** The sign-in email: short, warm, plain English. */
async function sendSignInEmail({ identifier, url }: { identifier: string; url: string }) {
  const { AUTH_RESEND_KEY, EMAIL_FROM } = env();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: identifier,
      subject: "Your Instik sign-in link",
      text: `Here is your sign-in link:\n\n${url}\n\nIt works once and lasts an hour. If you didn't ask for it, you can ignore this email.\n\nInstik`,
      html: `<p>Here is your sign-in link:</p><p><a href="${url}">Sign in to Instik</a></p><p>It works once and lasts an hour. If you didn't ask for it, you can ignore this email.</p><p>Instik</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend responded ${response.status}`);
}

// The config is a function so nothing reads the environment or opens a database connection at import time.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const e = env();
  return {
    // The generated client has a custom output path, so its type is not the one the adapter names.
    adapter: PrismaAdapter(db() as unknown as Parameters<typeof PrismaAdapter>[0]),
    session: { strategy: "database", maxAge: 30 * DAY, updateAge: DAY },
    providers: [
      Google({
        clientId: e.AUTH_GOOGLE_ID,
        clientSecret: e.AUTH_GOOGLE_SECRET,
        // Safe here: Google only returns verified addresses and an email link proves control of the address,
        // so Google and email-link sign-ins for one address reach one account (never use this with a provider
        // that does not verify the address).
        allowDangerousEmailAccountLinking: true,
      }),
      Resend({
        apiKey: e.AUTH_RESEND_KEY,
        from: e.EMAIL_FROM,
        maxAge: LINK_LIFETIME_SECONDS,
        sendVerificationRequest: sendSignInEmail,
      }),
    ],
    pages: { signIn: "/sign-in", verifyRequest: "/sign-in/check-email", error: "/sign-in/error" },
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
      // Only same-site addresses are ever followed after signing in.
      redirect({ url, baseUrl }) {
        if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return `${baseUrl}${url}`;
        try {
          return new URL(url).origin === baseUrl ? url : baseUrl;
        } catch {
          return baseUrl;
        }
      },
    },
  };
});

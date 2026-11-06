# Contract: Environment variables

Parsed by `src/lib/env.ts` (zod, `server-only`). Names only are ever reported in an error. `.env.example` lists every variable below with a comment and **no values**; real values live in `.env.local` (git-ignored) and in the host's settings. No `NEXT_PUBLIC_` variable is added by this feature.

| Variable | Required | Used for | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | App connection | Neon **pooled** connection string; must start with `postgres://` or `postgresql://` |
| `DIRECT_URL` | yes | Migrations (`prisma.config.ts`) | Neon **direct** (non-pooled) string |
| `AUTH_SECRET` | yes | Auth.js signing and encryption | At least 32 characters; generate with `npx auth secret` |
| `AUTH_URL` | production only | Auth.js base URL | Optional locally; Vercel provides the host |
| `AUTH_GOOGLE_ID` | yes | Google sign-in | From the Google Cloud OAuth client |
| `AUTH_GOOGLE_SECRET` | yes | Google sign-in | Same |
| `AUTH_RESEND_KEY` | yes | Sending email links | Resend API key |
| `EMAIL_FROM` | yes | Sender of sign-in emails | A sender on a verified Resend domain; development may use Resend's shared test sender |
| `IP_HASH_SALT` | yes | Hashing visitor addresses for the send limit | Random string, at least 16 characters |

## Behaviour

- **First use** of `env()` parses once and caches the result; a failure throws `Missing or invalid environment variables: A, B (see .env.example)`.
- **Server start**: `src/instrumentation.ts` calls it in `register()` for the Node.js runtime, so a misconfigured deployment fails when it starts, not when the first learner signs in.
- **Build and tests** do not need secrets: nothing parses the environment at import time, and tests pass their own object to the parsing function.
- **Client**: `env.ts` starts with `import "server-only"`; importing it from a client component is a build error.
- **Rotation**: changing `AUTH_SECRET` signs everyone out; changing `IP_HASH_SALT` resets the send limits. Neither loses learner data.

# Contract: routes, links and metadata

## Pages

| Path | Page | In sitemap | Indexed | Title (after `· Instik` template) |
|---|---|---|---|---|
| `/` | Landing | Yes | Yes | "Instik — Your scroll time, but it counts." (default, no template) |
| `/pricing` | Pricing | Yes | Yes | "Pricing" |
| `/about` | About | Yes | Yes | "About" |
| `/privacy` | Privacy | Yes | Yes | "Privacy" |
| `/sign-in`, `/onboarding`, `/settings/*` | Existing utility pages | No | No (`noindex`, robots disallow) | unchanged |
| `/learn/*` | Library, player and so on | No | Disallowed for now | unchanged |
| `/api/*` | Auth endpoints | No | Disallowed | n/a |

Each marketing page has its own description (140 to 160 characters), one `h1`, and inherits the share image.

## Share image

`src/app/opengraph-image.tsx`: 1200×630, `image/png`, alt text "Instik: Your scroll time, but it counts." Cream background, ink wordmark in Nunito, tagline, coral accent fill. Used as both Open Graph and Twitter image (large summary card).

## Links

| From | To |
|---|---|
| Any "Start watching free" or "Get full access" | `/onboarding` when signed out; `/learn/<default-slug>` when signed in |
| Header "Log in" (signed out only) | `/sign-in` |
| Header "How it works" | `/#how-it-works` |
| Header and footer "Hosts", pillar "Meet the hosts" | `/learn/<default-slug>/hosts` |
| Header and footer "Pricing" | `/pricing` |
| Footer "About", "Privacy" | `/about`, `/privacy` |
| Hero "Join the waitlist for yours" | `/#waitlist` |
| Waitlist note | `/privacy` |
| Onboarding and Add a language "Join the waitlist" | `/?language=<code>#waitlist` (`other` for "Something else") |
| Pricing FAQ "Which languages are coming?" | answer text links to `/#waitlist` |

## Anchors

`#how-it-works` (How it works section), `#waitlist` (waitlist card). Both have `scroll-margin-top` so the header does not cover them.

## `robots.txt`

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /sign-in
Disallow: /onboarding
Disallow: /settings
Disallow: /learn
Sitemap: <site url>/sitemap.xml
```

## Site URL

Taken from `SITE_URL` when set, otherwise the Vercel production URL, otherwise `http://localhost:3000`. It is a public value, read without the secret-bearing server environment, so `next build` needs no secrets.

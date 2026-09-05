# CLAUDE.md

## Commands

```bash
npm run dev      # dev server at http://localhost:4321
npm run build    # production build to dist/
npm run preview  # preview the production build locally

npm run covers            # downscale/reformat medialog cover art as needed, in place
npm run covers -- --check # report only; exits 1 if any cover needs optimizing
```

Run `npm run covers` after adding cover art. It is idempotent, so running it when everything is
already optimized is a harmless no-op. It is deliberately **not** wired into `build` — the build
runs on Cloudflare where mutating tracked files would be pointless.

As of Astro 7, `astro dev` runs as a **detached background daemon** — it prints a pid and
returns instead of holding the terminal. Manage it with:

```bash
npx astro dev status   # is it running, and on what pid
npx astro dev logs     # tail the server log
npx astro dev stop     # shut it down
```

No linter or test suite is configured.

## Architecture

Astro 7 static site deployed to Cloudflare Pages. Content is authored by dropping `.md`/`.mdx`
files into `src/content/posts/`, editing JSON directly for the medialog, or through the Sveltia
CMS at `/admin` for posts and microposts. Server-side code is two Cloudflare Pages Functions:
`functions/auth.js` for the CMS's GitHub OAuth login (see CMS (Sveltia) below) and
`functions/api/contact.js` for the contact form (see Contact form below). Nothing else here runs
server-side — Astro itself outputs a fully static site, no adapter, no other routes.

### Content collections

Defined in `src/content.config.ts`.

Files live in `src/content/posts/`. The directory is currently empty (kept by `.gitkeep`), so
`getCollection('posts')` returns `[]` and the build logs a harmless "collection is empty" notice
on `/blog`, `/rss.xml`, and during route generation. That notice disappears once a post is added.

`heroImage` is a plain `z.string().optional()` — a path under `public/` (e.g. `/blog/foo.jpg`),
rendered with a bare `<img>` in `BlogPost.astro` and `blog/index.astro`. It deliberately does not
use Astro's `image()` schema helper: nothing else on this site goes through Astro's image
pipeline (see Media below), and `image()` needs a Vite-resolvable relative import, which doesn't
match how the Sveltia CMS's media widget writes plain public-folder paths.

Earlier `links` and `photos` collections were removed along with their pages and layouts; don't
reintroduce them without also adding routes.

### Medialog

`/medialog` is not a content collection. It reads JSON straight from `src/data/medialog/*.json`
via `import.meta.glob(..., { eager: true })`, so **adding a new year file requires no code
changes** — drop in e.g. `2027.json` and it is picked up and merged automatically.

**Cover art must be downscaled to 400px wide before being committed.** Cards render at 100px
max (75px on mobile), so 400px is already ~4x for retina; anything larger is pure waste. These
files sit in `public/`, so Astro's image pipeline never touches them — nothing else will shrink
them for you. Source art from Apple Music / TMDB arrives at 2000–2560px and ~500KB each; left
alone, 90 entries came to 46MB of eagerly-loaded images. **`npm run covers` does this for you** —
see `scripts/optimize-covers.mjs`. It took that same set to 3.7MB.

The script also normalizes format: TMDB poster art sometimes arrives as an opaque PNG, which
runs 2-3x the size of an equivalent-quality JPEG for a photograph with no transparency to lose.
`npm run covers` converts any opaque PNG to `.jpg` and rewrites the one `cover` reference to it
in `src/data/medialog/*.json` — a PNG with real alpha (e.g. a logo-style cover) is left alone
since JPEG has nothing to convert that channel into.

**`year` is the work's release year**, not when it was consumed — there is deliberately no
"date finished" field. Where a work has more than one candidate year, use the **general/home
release, not a festival premiere**. For example *The Witch* is 2016 (wide release) rather than
its 2015 Sundance premiere, and *Vulgar* is 2002 (Lions Gate) rather than its 2000 Toronto
premiere.

Entries render grouped by type as card grids, sorted **alphabetically by title** within each
group, library-style:

- A leading article (`the`, `a`, `an`) is dropped from the sort key, so "The Batman" files
  under B. The full title still displays. See `sortTitle()` in `medialog.astro`.
- The regex requires whitespace after the article (`/^(the|an|a)\s+/i`). That matters — it
  keeps a title like "A.M G.O.D" intact instead of filing it under M.
- `localeCompare` with `numeric: true` so "10 Things…" sorts sensibly against letters, and
  `sensitivity: 'base'` for case-insensitivity.

The JSON file itself is kept grouped by type and sorted by the same rule for readability, but
that is cosmetic — the page sorts at render time regardless of file order.

Card layout is built so every card in a section is the same height, which keeps the star
ratings aligned across a grid row as the library grows. Three things do that together, and
removing any one re-introduces the ragged edge: `.card-title` is clamped to two lines *and*
carries a matching `min-height` (so a one-line title still occupies two), `.card-sub` is a
single ellipsised line, and `.card-meta` uses `margin-top: auto` to pin the stars to the
bottom regardless of what's above them.

Each type section is a `<details>` element, and **all of them start closed** — every cover uses
`loading="lazy"`, with no eager exception, because a plain `<img>` without `loading="lazy"`
fetches at parse time regardless of visibility; if any section started `open`, that'd be fine,
but an eager cover *inside a closed section* would still download despite being hidden, which
defeats the point. A closed `<details>` has no layout box, so a lazy `<img>` inside one never
intersects the viewport and never fetches until the section is opened — that's what keeps the
initial payload at zero covers instead of the whole library (12MB+ and growing) loading as you
scroll. Note `.cover` already reserves space via `aspect-ratio`, so there is no layout shift and
no need for `width`/`height` attributes on the `<img>`.

The disclosure triangle is a custom `::before` on `.section-title` (now a `<summary>`), not the
browser default — `list-style: none` plus hiding `::marker`/`::-webkit-details-marker` clears
the built-in one first. The jump-nav links at the top (`#music`, `#movies`, etc.) point straight
at each `<details>`'s `id`, so `src/scripts/medialog-sections.ts` force-opens the target section
on click and on any direct `#hash` page load — plain anchor scrolling has no way to expand a
`<details>` on its own, and a scroll into a still-collapsed section would land on nothing.

### Styling

Single global stylesheet at `src/styles/global.css`, imported once via `BaseHead.astro`.

Fonts are served by **Astro's built-in font pipeline** using the Bunny provider, configured in
the `fonts` array in `astro.config.mjs` and emitted by the `<Font>` components in
`BaseHead.astro`. Three families, referenced in CSS by their `cssVariable`:

- `--font-cormorant` — Cormorant Garamond
- `--font-inter` — Inter
- `--font-mono` — IBM Plex Mono

There is no Google Fonts link tag and no `--font-geist`; fonts are self-hosted at build time.

### Response headers

`public/_headers` is read by Cloudflare Pages at deploy time — it is not an Astro feature and has
no effect in `astro dev`. It sets the site-wide security headers (`X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy`) and forces the correct
`application/rss+xml` content type on `/rss.xml`. Verify changes on a deployed preview, not
locally.

Every route's CSP sets `script-src 'self'` with no `'unsafe-inline'`. Vite's default
`assetsInlineLimit` (4096 bytes) inlines small `<script>` bundles directly into the HTML as
`<script type="module">...</script>` with no `src`, which that CSP then silently blocks — the
mark stays visually styled (CSS isn't affected) but its JS never runs. `astro.config.mjs` sets
`vite.build.assetsInlineLimit: 0` to force every script to build as an external same-origin file
instead, which `'self'` already covers. This applies sitewide (not just to the homepage's
lightning-effect script — `BaseHead.astro`'s theme-reset script was being silently blocked on
every route), so don't remove it without re-checking `dist/*/index.html` for bare
`<script type="module">` tags with no `src`.

### Favicons

Two files, both the "viii" gothic wordmark:

- `public/favicon.svg` — the tab icon. Cropped tight to the glyphs, and its fill tracks the
  viewer's colour scheme via `prefers-color-scheme` to match `--accent` (`#1c1c1c` light,
  `#e4e8f0` dark). Built as an embedded base64 PNG used as a luminance `<mask>` over a
  coloured `<rect>`, which is what makes recolouring possible from a raster source.
- `public/favicon.png` — 512×512, opaque. Serves triple duty: fallback icon for browsers that
  don't accept SVG icons, `apple-touch-icon` (iOS composites transparency onto black, so this
  one must stay opaque), and the default OG/Twitter share image.

To regenerate the SVG after changing the PNG, note that **sharp applies operations in a fixed
internal order, not call order** — `extend` runs before `negate`, so padding added in the same
pipeline gets inverted. Negate first, then extend a fresh `sharp()` instance.

### Media

All site images live in `public/` and are served as-is — there is no `src/assets/` directory and
nothing goes through Astro's image pipeline. That is why medialog covers must be downscaled
before committing; see the Medialog section and `npm run covers`.

### CMS (Sveltia)

`/admin` is [Sveltia CMS](https://github.com/sveltia/sveltia-cms), loaded from a CDN script in
`public/admin/index.html`; its config lives in `public/admin/config.yml`. It edits posts and
microposts only — see "Medialog and the CMS" below for why the medialog isn't wired in.

Two collections both point at `src/content/posts/` and are split by the schema's `type` field
using Decap-style `filter` (`{ field: type, value: post }` / `{ field: type, value: micro }`),
with `type` itself set via a hidden field default. This is the same one-folder-two-shapes split
`content.config.ts`'s zod `.refine()` enforces at build time.

Auth is a self-hosted, Decap/Netlify-compatible GitHub OAuth flow — `config.yml` sets
`base_url: https://phreq.blog` and `auth_endpoint: auth`, and `functions/auth.js` is the single
Cloudflare Pages Function that handles it: no `code` param means "start the flow" (redirect to
GitHub), a `code` param means "GitHub just called back" (exchange it for a token, hand it to the
CMS popup via `postMessage`). It needs `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` set in the
Cloudflare Pages project's environment variables, matching a GitHub OAuth App whose callback URL
is `https://phreq.blog/auth`.

CMS-uploaded images go to `public/blog/` (`media_folder`/`public_folder` in `config.yml`), which
is why `heroImage` had to stop using Astro's `image()` helper — see Content collections above.

**Medialog and the CMS.** Each `src/data/medialog/*.json` file is a flat array of many entries,
not one-file-per-entry — the shape Decap-style "folder"/"files" collections expect. Sveltia has
no top-level-array field type, so the medialog isn't editable from `/admin` without restructuring
that data (e.g. wrapping each year's array as `{ entries: [...] }`), which hasn't been done. Until
then, keep editing `src/data/medialog/*.json` directly.

### Contact form

`/contact` (`src/pages/contact.astro`) posts to `/api/contact` (`functions/api/contact.js`), a
second Cloudflare Pages Function. It's deliberately at `/api/contact` rather than `/contact`
itself — a Function and a static Astro page at the same path would leave Pages to arbitrate which
one serves a GET, so the form and the endpoint just don't share a route.

Spam defense is layered: a hidden `website` field is a honeypot (real visitors never see or fill
it; a filled one gets a fake-success response with no email sent, so bots get no signal to adapt
against), and Cloudflare Turnstile gates everything else, verified server-side against
`https://challenges.cloudflare.com/turnstile/v0/siteverify` — the client-side widget alone proves
nothing. Mail goes out through Resend's API rather than hand-built SMTP/MIME, which is what makes
this immune to header injection: there's no raw header string for a crafted name/email to break
out of.

Needs three Cloudflare Pages environment variables to work: `TURNSTILE_SECRET_KEY`,
`RESEND_API_KEY`, and `CONTACT_TO_EMAIL` (kept as an env var rather than hardcoded specifically so
the address isn't sitting in source — the whole point of routing contact through a form instead of
a `mailto:` link). `CONTACT_FROM_EMAIL` is the Resend-verified sending address (e.g. `Contact Form
<contact@phreq.blog>`); it isn't secret but lives in an env var anyway so it can change without a
redeploy. The client-side Turnstile site key is `PUBLIC_TURNSTILE_SITE_KEY` — an Astro `PUBLIC_`
env var, inlined into the static HTML at build time, so it must also be set wherever the site is
built (Cloudflare's build environment variables, not just the Pages Function's runtime ones).
Until `PUBLIC_TURNSTILE_SITE_KEY` is set, the page renders without a Turnstile widget and the
Function fails closed (no token, so no verification, so no mail) rather than silently skipping the
check.

`/contact*` carries its own `Content-Security-Policy` line in `public/_headers`, relaxed just
enough (`script-src`/`connect-src`/`frame-src` add `https://challenges.cloudflare.com`) for
Turnstile's script and challenge iframe to load — every other route stays on the strict default.
Turnstile's loader also injects two small inline bootstrap scripts, which `script-src` allowlists
by `sha256-` hash (pulled from the CSP violation Turnstile logs to the console when they're
blocked) rather than adding `'unsafe-inline'`. **`_headers` has no effect in `astro dev`** (see
Gotchas), so a CSP break here only ever shows up against a real Cloudflare deployment — this one
did, and cost a redeploy to catch.

## Gotchas

- **Stale caches.** If dev throws something that doesn't match your source (the classic is
  `No script at index 0` from `vite-plugin-astro`), delete `.astro/`, `node_modules/.astro/`,
  and `node_modules/.vite/`, then restart. This is almost always the cause.
- **Don't delete `.astro/` while `astro dev` is still running.** A running dev server keeps its
  content-collection sync state there; wiping it out from under a live server (e.g. a `rm -rf
  .astro` cleanup after a build, done without stopping dev first) makes it report a real,
  populated collection as `does not exist or is empty` until the server is stopped and restarted.
  The content on disk is fine — it's purely a stale in-memory sync issue.
- **`/sitemap-index.xml` 404s in dev.** `@astrojs/sitemap` only runs during `astro build`;
  check it in `dist/` instead.
- **Astro 7 uses a Rust compiler** that is strict about unclosed tags and does not silently
  fix invalid HTML nesting (e.g. a `<div>` inside a `<p>`). Malformed markup that previously
  built will now error or render differently.
- **`pubDate` and time zones.** `z.coerce.date()` parses a date-only string (`2026-09-01`) as
  UTC midnight, but a date-*time* string with no offset (`2026-09-01T21:00:00`) as local time
  on whatever machine does the parsing — dev (your machine) and the Cloudflare build (UTC)
  will disagree, and the displayed date can shift by a day between them. `FormattedDate`
  renders in UTC, so plain date-only frontmatter is always safe; if you add a time, always
  append `Z` (or an explicit offset).

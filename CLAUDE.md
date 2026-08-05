# CLAUDE.md

## Commands

```bash
npm run dev      # dev server at http://localhost:4321
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

As of Astro 7, `astro dev` runs as a **detached background daemon** — it prints a pid and
returns instead of holding the terminal. Manage it with:

```bash
npx astro dev status   # is it running, and on what pid
npx astro dev logs     # tail the server log
npx astro dev stop     # shut it down
```

No linter or test suite is configured.

## Architecture

Astro 7 static site deployed to Cloudflare Pages. Content is authored via Decap CMS (`/admin`),
by dropping `.md`/`.mdx` files into `src/content/posts/`, or — for the medialog — by editing
JSON directly.

### Content collections

Defined in `src/content.config.ts`. One collection:

- **posts** — blog articles. Fields: `title`, `description?`, `pubDate`, `updatedDate?`, `heroImage?`

Files live in `src/content/posts/`. The directory is currently empty (kept by `.gitkeep`), so
`getCollection('posts')` returns `[]` and the build logs a harmless "collection is empty" notice
on `/blog`, `/rss.xml`, and during route generation. That notice disappears once a post is added.

Earlier `links` and `photos` collections were removed along with their pages and layouts; don't
reintroduce them without also adding routes.

### Medialog

`/medialog` is not a content collection. It reads JSON straight from `src/data/medialog/*.json`
via `import.meta.glob(..., { eager: true })`, so **adding a new year file requires no code
changes** — drop in e.g. `2027.json` and it is picked up and merged automatically.

Each entry: `type` (`tv` | `movie` | `book` | `music` | `comic`), `title`, `artist?`, `year`,
`rating?` (1–5), `notes?`, `cover?`. `artist` doubles as the author for books and comics.
`cover` is a bare filename resolved against `public/medialog/`; cover art is ~600px tall JPEG.

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

### Routes → layout wiring

| Route | Layout |
|---|---|
| `/` | none — standalone splash page showing `public/logo.webp` |
| `/blog` | none — index listing the `posts` collection |
| `/blog/[...slug]` | `BlogPost.astro` |
| `/about` | `BlogPost.astro` |
| `/medialog` | none — self-contained, reads `src/data/medialog/` |
| `/rss.xml` | `@astrojs/rss`, fed by the `posts` collection |

`BlogPost.astro` is the only layout.

### Styling

Single global stylesheet at `src/styles/global.css`, imported once via `BaseHead.astro`.

Fonts are served by **Astro's built-in font pipeline** using the Bunny provider, configured in
the `fonts` array in `astro.config.mjs` and emitted by the `<Font>` components in
`BaseHead.astro`. Three families, referenced in CSS by their `cssVariable`:

- `--font-cormorant` — Cormorant Garamond
- `--font-inter` — Inter
- `--font-mono` — IBM Plex Mono

There is no Google Fonts link tag and no `--font-geist`; fonts are self-hosted at build time.

### Decap CMS / auth

`/admin` is a static Decap CMS page (`public/admin/`). GitHub OAuth is handled by a Cloudflare
Pages Function at `functions/api/auth.js`. Requires two env vars set in the Cloudflare dashboard:
`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The `base_url` in `public/admin/config.yml` must
match the deployed Pages URL.

### Global site metadata

`src/consts.ts` exports `SITE_TITLE` and `SITE_DESCRIPTION`, used in `BaseHead.astro` and the
RSS feed. `BaseHead.astro` also sets the OG/Twitter share image, defaulting to `/favicon.png`.

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

### Media uploads

Decap CMS writes uploaded media to `src/assets/uploads/`, which Astro's image pipeline optimises
at build time. Medialog cover art is the exception — it lives in `public/medialog/` and is served
unoptimised.

## Gotchas

- **Stale caches.** If dev throws something that doesn't match your source (the classic is
  `No script at index 0` from `vite-plugin-astro`), delete `.astro/`, `node_modules/.astro/`,
  and `node_modules/.vite/`, then restart. This is almost always the cause.
- **`/sitemap-index.xml` 404s in dev.** `@astrojs/sitemap` only runs during `astro build`;
  check it in `dist/` instead.
- **Astro 7 uses a Rust compiler** that is strict about unclosed tags and does not silently
  fix invalid HTML nesting (e.g. a `<div>` inside a `<p>`). Malformed markup that previously
  built will now error or render differently.

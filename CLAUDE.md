# CLAUDE.md

## Commands

```bash
npm run dev      # dev server at http://localhost:4321
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

No linter or test suite is configured.

## Architecture

Astro 6 static site deployed to Cloudflare Pages. Content is authored via Decap CMS (`/admin`) or by dropping `.md`/`.mdx` files directly into the content directories.

### Content collections

Defined in `src/content.config.ts`. Three collections, each with its own schema:

- **posts** — articles and short notes. Fields: `title`, `description?`, `pubDate`, `updatedDate?`, `heroImage?`
- **links** — shared links with commentary. Fields: `title`, `url`, `description?`, `pubDate`
- **photos** — photo posts. Fields: `title?`, `description?`, `pubDate`, `heroImage` (required)

Content files live in `src/content/{posts,links,photos}/`.

### Layout → page wiring

| Layout | Used by |
|---|---|
| `BlogPost.astro` | `/posts/[...slug]` and `/about` |
| `LinkPost.astro` | `/links/[...slug]` — external URL prominent, hostname badge |
| `PhotoPost.astro` | `/photos/[...slug]` — image-first layout |

### Home feed

`src/pages/index.astro` loads all three collections, merges them into a single reverse-chrono feed with type badges (post / link / photo).

### Styling

Single global stylesheet at `src/styles/global.css`, imported once via `BaseHead.astro`. Colours are standard CSS variables from the Astro blog template (light mode). Font is Geist via Google Fonts, referenced as `var(--font-geist)`.

### Decap CMS / auth

`/admin` is a static Decap CMS page (`public/admin/`). GitHub OAuth is handled by a Cloudflare Pages Function at `functions/api/auth.js`. Requires two env vars set in the Cloudflare dashboard: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The `base_url` in `public/admin/config.yml` must match the deployed Pages URL.

### Global site metadata

`src/consts.ts` exports `SITE_TITLE` and `SITE_DESCRIPTION`, used in `BaseHead.astro` and the RSS feed.

### Media uploads

Decap CMS is configured to write uploaded media to `src/assets/uploads/`, which Astro's image pipeline optimises at build time.

/**
 * Downscale medialog cover art in place.
 *
 * Covers live in `public/`, so Astro's image pipeline never touches them —
 * nothing else in the build will shrink them. Source art from Apple Music /
 * TMDB arrives at 2000–2560px and ~500KB each; left alone, 90 entries came to
 * 46MB of images on one page.
 *
 * Cards render at 125px wide (85px on mobile), so 400px is already ~3x for
 * retina. Anything larger is pure waste.
 *
 *   npm run covers          resize anything oversized
 *   npm run covers -- --check   report only, exit 1 if work is needed
 *
 * Idempotent: re-running after a clean pass does nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const TARGET_W = 400;
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'medialog');

const checkOnly = process.argv.includes('--check');
const kb = (n) => `${Math.round(n / 1024)}KB`;

const files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
let before = 0;
let after = 0;
const changed = [];

for (const file of files) {
	const src = path.join(DIR, file);
	const bytesBefore = fs.statSync(src).size;
	before += bytesBefore;

	const { width } = await sharp(src).metadata();
	if (width <= TARGET_W) {
		after += bytesBefore;
		continue;
	}

	if (checkOnly) {
		changed.push(`${file} — ${width}px wide, ${kb(bytesBefore)}`);
		after += bytesBefore;
		continue;
	}

	const pipeline = sharp(src).resize({ width: TARGET_W, withoutEnlargement: true });
	const buf = /\.png$/i.test(file)
		? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
		: await pipeline.jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer();

	// Guard against a "resize" that lands bigger than the original.
	if (buf.length >= bytesBefore) {
		after += bytesBefore;
		continue;
	}

	// buf is fully in memory, so overwriting the source we read from is safe.
	fs.writeFileSync(src, buf);
	changed.push(`${file} — ${width}px ${kb(bytesBefore)} -> ${TARGET_W}px ${kb(buf.length)}`);
	after += buf.length;
}

if (!changed.length) {
	console.log(`${files.length} covers, all within ${TARGET_W}px — nothing to do.`);
	process.exit(0);
}

console.log(changed.map((l) => `  ${l}`).join('\n'));

if (checkOnly) {
	console.error(`\n${changed.length} cover(s) exceed ${TARGET_W}px. Run: npm run covers`);
	process.exit(1);
}

const saved = Math.round((1 - after / before) * 100);
console.log(`\n${changed.length} resized — ${kb(before)} -> ${kb(after)} (${saved}% smaller)`);

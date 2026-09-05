/**
 * Downscale and reformat medialog cover art in place.
 *
 * Covers live in `public/`, so Astro's image pipeline never touches them —
 * nothing else in the build will shrink them. Source art from Apple Music /
 * TMDB arrives at 2000–2560px and ~500KB each; left alone, 90 entries came to
 * 46MB of images on one page.
 *
 * Cards render at 125px wide (85px on mobile), so 400px is already ~3x for
 * retina. Anything larger is pure waste.
 *
 * TMDB poster art sometimes arrives as PNG despite being fully opaque —
 * lossless PNG on a photograph runs 2-3x the size of an equivalent-quality
 * JPEG for no visual benefit. Opaque PNGs get converted to JPEG (renaming
 * the file and updating the one `src/data/medialog/*.json` entry that
 * references it); a PNG with real transparency is left alone, since JPEG
 * has no alpha channel to convert into.
 *
 *   npm run covers          resize/reformat anything that needs it
 *   npm run covers -- --check   report only, exit 1 if work is needed
 *
 * Idempotent: re-running after a clean pass does nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const TARGET_W = 400;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'medialog');
const DATA_DIR = path.join(ROOT, 'src', 'data', 'medialog');

const checkOnly = process.argv.includes('--check');
const kb = (n) => `${Math.round(n / 1024)}KB`;

// The medialog JSON files reference covers by filename only. Renaming a
// cover on disk (PNG -> JPEG) means fixing up the one entry that points to
// it, everywhere it might live.
function renameCoverReferences(oldName, newName) {
	const needle = `"cover": "${oldName}"`;
	const replacement = `"cover": "${newName}"`;
	for (const file of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
		const jsonPath = path.join(DATA_DIR, file);
		const text = fs.readFileSync(jsonPath, 'utf8');
		if (text.includes(needle)) {
			fs.writeFileSync(jsonPath, text.replaceAll(needle, replacement));
		}
	}
}

const files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
let before = 0;
let after = 0;
const changed = [];

for (const file of files) {
	const src = path.join(DIR, file);
	const bytesBefore = fs.statSync(src).size;
	before += bytesBefore;

	const meta = await sharp(src).metadata();
	const needsResize = meta.width > TARGET_W;
	const needsReformat = /\.png$/i.test(file) && !meta.hasAlpha;

	if (!needsResize && !needsReformat) {
		after += bytesBefore;
		continue;
	}

	if (checkOnly) {
		const reasons = [
			needsResize && `${meta.width}px wide`,
			needsReformat && 'opaque PNG',
		].filter(Boolean).join(', ');
		changed.push(`${file} — ${reasons}, ${kb(bytesBefore)}`);
		after += bytesBefore;
		continue;
	}

	const pipeline = needsResize
		? sharp(src).resize({ width: TARGET_W, withoutEnlargement: true })
		: sharp(src);
	const buf = needsReformat || !/\.png$/i.test(file)
		? await pipeline.jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer()
		: await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();

	// Guard against a "resize" or "reformat" that lands bigger than the original.
	if (buf.length >= bytesBefore) {
		after += bytesBefore;
		continue;
	}

	if (needsReformat) {
		const newFile = file.replace(/\.png$/i, '.jpg');
		fs.writeFileSync(path.join(DIR, newFile), buf);
		fs.unlinkSync(src);
		renameCoverReferences(file, newFile);
		changed.push(`${file} -> ${newFile} — ${kb(bytesBefore)} -> ${kb(buf.length)}`);
	} else {
		// buf is fully in memory, so overwriting the source we read from is safe.
		fs.writeFileSync(src, buf);
		changed.push(`${file} — ${meta.width}px ${kb(bytesBefore)} -> ${TARGET_W}px ${kb(buf.length)}`);
	}
	after += buf.length;
}

if (!changed.length) {
	console.log(`${files.length} covers, all already optimized — nothing to do.`);
	process.exit(0);
}

console.log(changed.map((l) => `  ${l}`).join('\n'));

if (checkOnly) {
	console.error(`\n${changed.length} cover(s) need optimizing. Run: npm run covers`);
	process.exit(1);
}

const saved = Math.round((1 - after / before) * 100);
console.log(`\n${changed.length} optimized — ${kb(before)} -> ${kb(after)} (${saved}% smaller)`);

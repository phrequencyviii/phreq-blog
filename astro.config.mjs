// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://phreq.blog',
	integrations: [mdx(), sitemap()],
	// script-src in public/_headers is 'self' with no 'unsafe-inline' — Vite's
	// default assetsInlineLimit (4096 bytes) inlines small <script> bundles
	// directly into the HTML, which the CSP then blocks. Disabling it keeps
	// every script as an external same-origin file instead.
	vite: {
		build: {
			assetsInlineLimit: 0,
		},
	},
	fonts: [
		{
			provider: fontProviders.bunny(),
			name: 'Cormorant Garamond',
			cssVariable: '--font-cormorant',
			fallbacks: ['Georgia', 'serif'],
		},
		{
			provider: fontProviders.bunny(),
			name: 'Inter',
			cssVariable: '--font-inter',
			fallbacks: ['sans-serif'],
		},
		{
			provider: fontProviders.bunny(),
			name: 'IBM Plex Mono',
			cssVariable: '--font-mono',
			fallbacks: ['monospace'],
		},
	],
});

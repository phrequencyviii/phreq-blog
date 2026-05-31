// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://phreq.blog',
	integrations: [mdx(), sitemap()],
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

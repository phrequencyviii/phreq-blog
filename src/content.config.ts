import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

const links = defineCollection({
	loader: glob({ base: './src/content/links', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		url: z.string().url(),
		description: z.string().optional(),
		pubDate: z.coerce.date(),
	}),
});

const photos = defineCollection({
	loader: glob({ base: './src/content/photos', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string().optional(),
			description: z.string().optional(),
			pubDate: z.coerce.date(),
			heroImage: image(),
		}),
});

export const collections = { posts, links, photos };

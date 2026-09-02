import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: () =>
		z
			.object({
				// 'post' is a full article and requires a title; 'micro' is a
				// short, Twitter-style entry rendered inline in the blog feed.
				type: z.enum(['post', 'micro']).default('post'),
				title: z.string().optional(),
				description: z.string().optional(),
				pubDate: z.coerce.date(),
				updatedDate: z.coerce.date().optional(),
				// A path under public/, like every other image on this site —
				// not Astro's image() pipeline, which nothing else here uses.
				heroImage: z.string().optional(),
			})
			.refine((data) => data.type !== 'post' || !!data.title, {
				message: 'title is required when type is "post"',
				path: ['title'],
			}),
});

export const collections = { posts };

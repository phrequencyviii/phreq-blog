import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = await getCollection('posts');

	const items = posts
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
		.map((p) => ({
			// Microposts have no title — fall back to the raw body (feed
			// readers show this as the item's label when there's no title).
			title: p.data.title ?? p.body?.replace(/\s+/g, ' ').trim(),
			description: p.data.description,
			pubDate: p.data.pubDate,
			link: `/blog/${p.id}/`,
			categories: [p.data.type, ...(p.data.tags ?? [])],
		}));

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items,
	});
}

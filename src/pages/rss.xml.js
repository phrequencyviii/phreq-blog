import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = await getCollection('posts');
	const links = await getCollection('links');
	const photos = await getCollection('photos');

	const items = [
		...posts.map((p) => ({ ...p.data, link: `/posts/${p.id}/` })),
		...links.map((l) => ({ ...l.data, link: `/links/${l.id}/` })),
		...photos.map((ph) => ({ ...ph.data, title: ph.data.title ?? 'Photo', link: `/photos/${ph.id}/` })),
	].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items,
	});
}

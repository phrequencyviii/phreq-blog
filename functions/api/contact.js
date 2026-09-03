// Handles submissions from /contact. Kept at /api/contact rather than /contact
// itself so this Function can't collide with the static page Astro builds at
// that path — Pages would otherwise have to arbitrate which one wins.
//
// Spam defense is layered: a hidden honeypot field catches unsophisticated
// bots for free, and Cloudflare Turnstile (verified server-side against
// Cloudflare's own siteverify endpoint) gates everything else. Mail is sent
// through Resend's API rather than hand-built SMTP/MIME, which is what
// keeps this immune to header injection — there's no raw header string for
// a crafted "name" or "email" value to break out of.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body, status) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function onRequestPost(context) {
	const { request, env } = context;

	let data;
	try {
		data = await request.json();
	} catch {
		return jsonResponse({ error: 'Malformed request.' }, 400);
	}

	const name = typeof data.name === 'string' ? data.name.trim() : '';
	const email = typeof data.email === 'string' ? data.email.trim() : '';
	const message = typeof data.message === 'string' ? data.message.trim() : '';
	const website = typeof data.website === 'string' ? data.website.trim() : '';
	const turnstileToken = typeof data.turnstileToken === 'string' ? data.turnstileToken : '';

	// Honeypot: real visitors never see or fill this field. Report success
	// without sending anything, so bots have no signal to adapt against.
	if (website) {
		return jsonResponse({ success: true }, 200);
	}

	if (!name || name.length > 100) {
		return jsonResponse({ error: 'Please enter your name.' }, 400);
	}
	if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
		return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
	}
	if (!message || message.length > 5000) {
		return jsonResponse({ error: 'Please enter a message (up to 5000 characters).' }, 400);
	}
	if (!turnstileToken) {
		return jsonResponse({ error: 'Verification failed. Please try again.' }, 400);
	}

	const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			secret: env.TURNSTILE_SECRET_KEY,
			response: turnstileToken,
			remoteip: request.headers.get('CF-Connecting-IP') ?? '',
		}),
	});
	const verify = await verifyRes.json();
	if (!verify.success) {
		return jsonResponse({ error: 'Verification failed. Please try again.' }, 400);
	}

	const sendRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: env.CONTACT_FROM_EMAIL,
			to: [env.CONTACT_TO_EMAIL],
			reply_to: email,
			subject: `New message from ${name} via phreq.blog`,
			text: `${message}\n\n—\n${name} <${email}>`,
		}),
	});

	if (!sendRes.ok) {
		return jsonResponse({ error: 'Could not send your message. Please try again later.' }, 502);
	}

	return jsonResponse({ success: true }, 200);
}

export async function onRequest(context) {
	const { request, env } = context;
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const provider = 'github';

	if (!code) {
		const params = new URLSearchParams({
			client_id: env.GITHUB_CLIENT_ID,
			redirect_uri: `${url.origin}/api/auth`,
			scope: 'repo,user',
		});
		return Response.redirect(
			`https://github.com/login/oauth/authorize?${params}`,
			302
		);
	}

	let token, error;
	try {
		const res = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
				redirect_uri: `${url.origin}/api/auth`,
			}),
		});
		const data = await res.json();
		token = data.access_token;
		if (!token) error = data.error_description || 'No token received';
	} catch (e) {
		error = e.message;
	}

	const status = error ? 'error' : 'success';
	const payload = JSON.stringify(error ? { error } : { token, provider });

	return new Response(
		`<!doctype html>
<html>
<body>
<script>
  (function () {
    const provider = ${JSON.stringify(provider)};
    const status = ${JSON.stringify(status)};
    const payload = ${payload};
    function receiveMessage(e) {
      window.opener.postMessage(
        'authorization:' + provider + ':' + status + ':' + JSON.stringify(payload),
        e.origin
      );
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:' + provider, '*');
  })();
<\/script>
</body>
</html>`,
		{ headers: { 'Content-Type': 'text/html' } }
	);
}

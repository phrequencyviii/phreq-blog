// Media sections are <details> elements, collapsed by default so their
// covers (loading="lazy") never fetch until opened. A jump-nav link or a
// direct #hash visit still needs to land on an *open* section rather than
// a collapsed one, so force that here — native anchor scrolling doesn't
// know how to expand a <details> on its own.
(function () {
	function openTarget(id: string) {
		if (!id) return;
		var el = document.getElementById(id);
		if (el instanceof HTMLDetailsElement) el.open = true;
	}

	document.querySelectorAll<HTMLAnchorElement>('.jump-nav a[href^="#"]').forEach(function (a) {
		a.addEventListener('click', function () {
			openTarget(a.getAttribute('href')!.slice(1));
		});
	});

	window.addEventListener('hashchange', function () {
		openTarget(location.hash.slice(1));
	});

	openTarget(location.hash.slice(1));
})();

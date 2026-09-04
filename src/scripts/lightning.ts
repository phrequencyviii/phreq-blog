(function () {
	var stage = document.getElementById('stage')!;
	var canvas = document.getElementById('fx') as HTMLCanvasElement;
	var ctx = canvas.getContext('2d')!;
	var markWrap = document.getElementById('markWrap')!;
	var mark = document.getElementById('mark') as HTMLImageElement;
	var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	var dpr = Math.min(window.devicePixelRatio || 1, 2);
	function resize() {
		var r = stage.getBoundingClientRect();
		canvas.width = r.width * dpr;
		canvas.height = r.height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();
	window.addEventListener('resize', resize);

	var pointer = { x: null as number | null, y: null as number | null, active: false, vx: 0, vy: 0, lastX: 0, lastY: 0 };
	var tilt = { x: 0, y: 0 };
	var bolts: { path: { x: number; y: number }[]; life: number; decay: number; hue: string; width: number }[] = [];
	var lastSpawn = 0;

	function stageCenter() {
		var r = stage.getBoundingClientRect();
		var m = mark.getBoundingClientRect();
		return {
			x: m.left - r.left + m.width / 2,
			y: m.top - r.top + m.height / 2,
			halfW: m.width / 2,
			halfH: m.height / 2,
		};
	}

	function jaggedPath(x0: number, y0: number, x1: number, y1: number, displace: number) {
		var pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
		var passes = 4;
		for (var p = 0; p < passes; p++) {
			var next = [pts[0]];
			for (var i = 0; i < pts.length - 1; i++) {
				var a = pts[i], b = pts[i + 1];
				var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
				var dx = b.x - a.x, dy = b.y - a.y;
				var len = Math.sqrt(dx * dx + dy * dy) || 1;
				var nx = -dy / len, ny = dx / len;
				var amt = (Math.random() - 0.5) * displace * Math.pow(0.55, p);
				next.push({ x: mx + nx * amt, y: my + ny * amt });
				next.push(b);
			}
			pts = next;
		}
		return pts;
	}

	function spawnBolt(fromPointer: boolean) {
		var c = stageCenter();
		var angle = Math.random() * Math.PI * 2;
		var edgeX = c.x + Math.cos(angle) * c.halfW * 0.9;
		var edgeY = c.y + Math.sin(angle) * c.halfH * 0.9;
		var targetX = fromPointer && pointer.x !== null ? pointer.x : c.x + (Math.random() - 0.5) * c.halfW * 2;
		var targetY = fromPointer && pointer.y !== null ? pointer.y : c.y + (Math.random() - 0.5) * c.halfH * 2;
		var dist = Math.hypot(targetX - edgeX, targetY - edgeY);
		bolts.push({
			path: jaggedPath(edgeX, edgeY, targetX, targetY, Math.max(18, dist * 0.18)),
			life: 1,
			decay: 0.06 + Math.random() * 0.05,
			hue: Math.random() > 0.35 ? '--bolt-a' : '--bolt-b',
			width: 1.2 + Math.random() * 1.4,
		});
	}

	function burst(n: number) {
		for (var i = 0; i < n; i++) spawnBolt(true);
		flashMark();
	}

	function flashMark() {
		mark.classList.add('charged');
		window.clearTimeout((mark as any)._t);
		(mark as any)._t = window.setTimeout(function () {
			mark.classList.remove('charged');
		}, 260);
	}

	function drawBolt(b: (typeof bolts)[number]) {
		var pts = b.path;
		ctx.save();
		ctx.globalAlpha = Math.max(b.life, 0);
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';

		var glowColor = getComputedStyle(document.documentElement).getPropertyValue(b.hue).trim() || '#8b7cff';
		ctx.strokeStyle = glowColor;
		ctx.shadowColor = glowColor;
		ctx.shadowBlur = 14;
		ctx.lineWidth = b.width * 2.2;
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
		ctx.stroke();

		var coreColor = getComputedStyle(document.documentElement).getPropertyValue('--bolt-core').trim() || '#f5f3ff';
		ctx.shadowBlur = 0;
		ctx.strokeStyle = coreColor;
		ctx.lineWidth = Math.max(0.6, b.width * 0.5);
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
		ctx.stroke();
		ctx.restore();
	}

	function frame() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (var i = bolts.length - 1; i >= 0; i--) {
			bolts[i].life -= bolts[i].decay;
			if (bolts[i].life <= 0) { bolts.splice(i, 1); continue; }
			drawBolt(bolts[i]);
		}

		if (pointer.active && pointer.x !== null && pointer.y !== null) {
			var c = stageCenter();
			var dx = pointer.x - c.x, dy = pointer.y - c.y;
			var dist = Math.hypot(dx, dy);
			var influence = Math.max(0, 1 - dist / 340);
			var targetTiltX = (dy / (dist || 1)) * influence * 8;
			var targetTiltY = -(dx / (dist || 1)) * influence * 8;
			tilt.x += (targetTiltX - tilt.x) * 0.12;
			tilt.y += (targetTiltY - tilt.y) * 0.12;
			var pushX = -(dx / (dist || 1)) * influence * 10;
			var pushY = -(dy / (dist || 1)) * influence * 10;
			(markWrap as HTMLElement).style.transform =
				'translate(' + pushX.toFixed(2) + 'px,' + pushY.toFixed(2) + 'px) ' +
				'rotateX(' + tilt.x.toFixed(2) + 'deg) rotateY(' + tilt.y.toFixed(2) + 'deg)';

			if (influence > 0.15 && !reduced) {
				var now = performance.now();
				var speed = Math.hypot(pointer.vx, pointer.vy);
				var chance = influence * 0.05 + Math.min(speed / 4000, 0.08);
				if (now - lastSpawn > 90 && Math.random() < chance) {
					spawnBolt(true);
					lastSpawn = now;
				}
			}
		} else {
			tilt.x += (0 - tilt.x) * 0.08;
			tilt.y += (0 - tilt.y) * 0.08;
			(markWrap as HTMLElement).style.transform = 'rotateX(' + tilt.x.toFixed(2) + 'deg) rotateY(' + tilt.y.toFixed(2) + 'deg)';
			if (!reduced && Math.random() < 0.004) spawnBolt(false);
		}

		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	function setPointer(x: number, y: number) {
		var r = stage.getBoundingClientRect();
		var nx = x - r.left, ny = y - r.top;
		pointer.vx = nx - pointer.lastX;
		pointer.vy = ny - pointer.lastY;
		pointer.lastX = nx;
		pointer.lastY = ny;
		pointer.x = nx;
		pointer.y = ny;
		pointer.active = true;
	}

	function deactivate() {
		pointer.active = false;
	}

	stage.addEventListener('pointermove', function (e) { setPointer(e.clientX, e.clientY); });
	stage.addEventListener('pointerleave', deactivate);
	stage.addEventListener('pointerup', deactivate);
	stage.addEventListener('pointercancel', deactivate);
	stage.addEventListener('pointerdown', function (e) {
		setPointer(e.clientX, e.clientY);
		burst(3 + Math.floor(Math.random() * 2));
	});
})();

    // Sphere de particules qui reagit au son du micro (Web Audio + canvas 2D).
    // Utilisation : Orb.connect(stream) au demarrage, Orb.disconnect() a l'arret.
    (function () {
    const canvas = document.getElementById('orb');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const COUNT = 2800;                    // nombre de particules
    const BIN_LOW = 2, BIN_HIGH = 42;      // plage de frequences utilisee (la voix)
    const levels = new Float32Array(BIN_HIGH + 1);
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Points repartis regulierement sur une sphere (spirale de Fibonacci).
    // Haut de la sphere = aigus (bleu), bas = graves (orange).
    const points = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
        const y = -1 + (2 * i) / (COUNT - 1);
        const ring = Math.sqrt(1 - y * y);
        const theta = golden * i;
        const u = (y + 1) / 2;
        points.push({
        x: Math.cos(theta) * ring,
        y,
        z: Math.sin(theta) * ring,
        hue: (205 + u * 175) % 360,
        band: BIN_LOW + Math.round((1 - u) * (BIN_HIGH - BIN_LOW)),
        seed: Math.random(),
        seed2: Math.random(),
        });
    }

    let audioCtx = null, source = null, analyser = null, freq = null;
    let width = 1, height = 1, dpr = 1;
    let rotation = 0, tiltX = 0, tiltY = 0, targetX = 0, targetY = 0, energy = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        width = canvas.width = Math.max(1, Math.round(rect.width * dpr));
        height = canvas.height = Math.max(1, Math.round(rect.height * dpr));
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    resize();

    // Interactif : la sphere s'incline vers le curseur / le doigt.
    window.addEventListener('pointermove', (e) => {
        targetY = (e.clientX / window.innerWidth - 0.5) * 1.2;
        targetX = (e.clientY / window.innerHeight - 0.5) * 0.8;
    });

    function connect(stream) {
        disconnect();
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        if (audioCtx.resume) audioCtx.resume();
        source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);            // pas relie aux haut-parleurs : pas d'echo
        freq = new Uint8Array(analyser.frequencyBinCount);
    }

    function disconnect() {
        if (source) source.disconnect();
        if (audioCtx) audioCtx.close();
        audioCtx = source = analyser = freq = null;
    }

    function readAudio() {
        let sum = 0;
        if (analyser) analyser.getByteFrequencyData(freq);
        for (let b = BIN_LOW; b <= BIN_HIGH; b++) {
        const target = analyser ? Math.min(1, (freq[b] / 255) * 1.5) : 0;
        // attaque rapide, retombee douce : la sphere "claque" puis se calme
        levels[b] += (target - levels[b]) * (target > levels[b] ? 0.55 : 0.1);
        sum += levels[b];
        }
        energy = sum / (BIN_HIGH - BIN_LOW + 1);
    }

    function draw(time) {
        const t = time * 0.001;
        readAudio();

        tiltX += (targetX - tiltX) * 0.05;
        tiltY += (targetY - tiltY) * 0.05;
        rotation += (calm ? 0.0004 : 0.0025) + energy * (calm ? 0.004 : 0.03);

        const cosA = Math.cos(rotation + tiltY), sinA = Math.sin(rotation + tiltY);
        const cosX = Math.cos(tiltX + 0.2), sinX = Math.sin(tiltX + 0.2);
        const cx = width / 2, cy = height / 2;
        const R = Math.min(width, height) * 0.3 * (1 + energy * 0.12);

        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';      // les points qui se croisent brillent

        for (let i = 0; i < COUNT; i++) {
        const p = points[i];
        const level = levels[p.band];
        const wobble = 0.5 + 0.5 * Math.sin(t * 2.2 + p.seed * 6.283 + p.y * 4);

        // rayon : respiration au repos + gonflement selon la frequence de ce point
        let r = 1 + 0.025 * Math.sin(t * 0.9 + p.y * 3 + p.x * 2) + level * (0.07 + 0.15 * wobble);
        // une partie des particules s'echappe : bord effiloche
        if (p.seed > 0.72) r += level * p.seed2 * 0.3 + (p.seed2 - 0.5) * 0.03;

        const x = p.x * r, y = p.y * r, z = p.z * r;
        const x1 = x * cosA + z * sinA;
        const z1 = -x * sinA + z * cosA;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const persp = 1 / (1 - z2 * 0.18);
        const sx = cx + x1 * R * persp;
        const sy = cy + y2 * R * persp;

        // plus un point est au bord de la sphere, plus il est lumineux
        const rim = 1 - Math.min(1, Math.abs(z2) / r);
        const alpha = Math.min(1, 0.12 + 0.85 * Math.pow(rim, 2.2) + level * 0.4);
        const size = (0.5 + rim * 1.0 + level * 1.1) * dpr * persp;
        const light = 50 + rim * 18 + level * 25;

        ctx.fillStyle = 'hsla(' + p.hue.toFixed(0) + ',88%,' + light.toFixed(0) + '%,' + alpha.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, size / 2, 0, 6.2832);
        ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    window.Orb = { connect, disconnect };
    })();
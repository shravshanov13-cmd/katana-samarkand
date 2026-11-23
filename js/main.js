/* =========================================================
   KATANA · Samarkand — one continuous shot
   GSAP 3 + ScrollTrigger. The page is one fixed stage; the
   tall .scroll-track drives a single scrubbed timeline that
   moves the "camera" from dawn (samurai) to night (contacts).

   Rule of thumb so animations never fight each other:
   - scroll timeline  -> GSAP x / y / scale / rotation / autoAlpha
   - intro on load    -> GSAP xPercent / yPercent (separate channel)
   - idle motion      -> CSS keyframes on `rotate` / `scale` / `translate`
   - mouse parallax   -> inline `translate` + 3D `rotate` on wrappers
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // phone / tablet portrait get their own composition (see the @media block in style.css)
  const mobileQuery = window.matchMedia("(max-width: 820px)");
  const isMobile = mobileQuery.matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  // crossing the breakpoint (e.g. rotating a tablet) rebuilds the shot from scratch
  mobileQuery.addEventListener("change", () => window.location.reload());
  const vw = (n) => (window.innerWidth * n) / 100;
  const vh = (n) => (window.innerHeight * n) / 100;

  /* ---------------- i18n ---------------- */
  const I18N = window.KATANA_I18N || {};
  const LINKS = window.KATANA_LINKS || {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  function setLang(lang) {
    const dict = I18N[lang] || I18N.ru;
    $$("[data-i18n]").forEach((el) => {
      const v = dict[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    $$("[data-i18n-alt]").forEach((el) => {
      const v = dict[el.dataset.i18nAlt];
      if (v != null) el.alt = v;
    });
    $$("[data-i18n-aria]").forEach((el) => {
      const v = dict[el.dataset.i18nAria];
      if (v != null) el.setAttribute("aria-label", v);
    });
    if (dict["meta.title"]) document.title = dict["meta.title"];
    root.lang = lang;
    $$(".lang button").forEach((b) => b.classList.toggle("is-on", b.dataset.lang === lang));
    store.set("katana-lang", lang);
  }

  const savedLang = store.get("katana-lang");
  const browserLang = (navigator.language || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
  setLang(savedLang && I18N[savedLang] ? savedLang : browserLang);
  $$(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));

  $$("[data-link]").forEach((a) => {
    const href = LINKS[a.dataset.link];
    if (href) a.href = href;
  });

  /* ---------------- seeded random ---------------- */
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- seigaiha (wave) pattern ---------------- */
  (function buildSeigaiha() {
    const W = 64, H = 32, R = W / 2, S = 2;
    const c = document.createElement("canvas");
    c.width = W * S; c.height = H * S;
    const g = c.getContext("2d");
    g.scale(S, S);
    for (let k = -2; k <= 5; k++) {
      const y = k * (H / 2);
      for (let col = -1; col <= 2; col++) {
        const x = col * W + (k % 2 ? W / 2 : 0);
        [1, 0.78, 0.56, 0.34].forEach((f, i) => {
          g.beginPath();
          g.arc(x, y, R * f, 0, Math.PI * 2);
          if (i === 0) { g.fillStyle = "#f8eee4"; g.fill(); }
          g.strokeStyle = "rgba(200, 38, 46, .55)";
          g.lineWidth = 1;
          g.stroke();
        });
      }
    }
    root.style.setProperty("--seigaiha", `url(${c.toDataURL()})`);
  })();

  /* ---------------- sakura branches ---------------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  const STEMS = [
    ["M612 -12 C560 30 520 52 460 70 C400 90 340 98 280 120 C230 140 190 170 150 202", 11],
    ["M520 52 C502 90 490 122 470 160", 6],
    ["M402 88 C382 60 352 46 320 40", 5],
    ["M340 98 C330 140 312 170 280 198", 5],
    ["M232 140 C212 120 182 110 150 112", 4],
    ["M470 160 C460 190 442 212 420 232", 3],
    ["M150 202 C130 222 110 238 84 246", 4],
  ];
  const PINKS = ["#f9cdd9", "#f4a9bf", "#fbe0e7", "#ef98b2", "#f7bccb"];
  const PETAL_D = "M0 0 C-5.5 -4 -6.5 -12 -2.4 -15.5 L0 -13.6 L2.4 -15.5 C6.5 -12 5.5 -4 0 0 Z";

  function flower(x, y, r, rot, color) {
    const outer = document.createElementNS(SVGNS, "g");
    outer.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    outer.setAttribute("class", "bloom");
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("transform", `rotate(${rot.toFixed(0)}) scale(${(r / 15).toFixed(2)})`);
    for (let i = 0; i < 5; i++) {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", PETAL_D);
      p.setAttribute("transform", `rotate(${i * 72})`);
      p.setAttribute("fill", color);
      g.appendChild(p);
    }
    const c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("r", "2.6");
    c.setAttribute("fill", "#c2456b");
    g.appendChild(c);
    outer.appendChild(g);
    return outer;
  }

  $$("svg.branch").forEach((svg, idx) => {
    const rand = rng(svg.dataset.seed ? Number(svg.dataset.seed) : idx * 97 + 13);
    const stems = document.createElementNS(SVGNS, "g");
    const blooms = document.createElementNS(SVGNS, "g");
    STEMS.forEach(([d, w]) => {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", "stem");
      p.setAttribute("stroke-width", w);
      stems.appendChild(p);
    });
    svg.append(stems, blooms);
    $$("path.stem", stems).forEach((p, si) => {
      const len = p.getTotalLength();
      const step = si === 0 ? 30 : 24;
      for (let l = si === 0 ? 70 : 10; l < len; l += step * (0.7 + rand() * 0.6)) {
        const pt = p.getPointAtLength(l);
        const n = 1 + Math.floor(rand() * 2);
        for (let j = 0; j < n; j++) {
          const ox = (rand() - 0.5) * 34, oy = (rand() - 0.5) * 30;
          if (rand() < 0.18) {
            const b = document.createElementNS(SVGNS, "circle");
            b.setAttribute("cx", pt.x + ox); b.setAttribute("cy", pt.y + oy);
            b.setAttribute("r", 3 + rand() * 2.5);
            b.setAttribute("class", "bud");
            blooms.appendChild(b);
          } else {
            blooms.appendChild(flower(pt.x + ox, pt.y + oy, 9 + rand() * 8, rand() * 72, PINKS[Math.floor(rand() * PINKS.length)]));
          }
        }
      }
    });
  });

  /* ---------------- ambient particles: petals by day, fireflies at night ---------------- */
  const fx = { wind: 0, petals: 1, flies: 0, night: 0, mx: -9999, my: -9999 };
  (function particles() {
    const cvs = $("#petals");
    if (!cvs || reduceMotion) return;
    const ctx = cvs.getContext("2d");
    const shape = new Path2D("M50 118 C20 110 2 82 6 52 C9 27 26 9 42 4 L50 17 L58 4 C74 9 91 27 94 52 C98 82 80 110 50 118 Z");
    const COLORS = ["#f9c4d3", "#f4a9bf", "#fde2ea", "#ee93ad", "#f7b6c7"];
    let W = 0, H = 0, dpr = 1;
    const petals = [], flies = [];

    function resize() {
      dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      W = cvs.clientWidth; H = cvs.clientHeight;
      cvs.width = W * dpr; cvs.height = H * dpr;
    }
    function spawnPetal(p, initial) {
      p.x = Math.random() * W * 1.2 - W * 0.1;
      p.y = initial ? Math.random() * H : -30 - Math.random() * 160;
      p.s = 7 + Math.random() * 12;
      p.vy = 0.22 + Math.random() * 0.5;
      p.vx = 0.08 + Math.random() * 0.35;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 0.02;
      p.flip = Math.random() * Math.PI * 2;
      p.vf = 0.008 + Math.random() * 0.02;
      p.sway = Math.random() * Math.PI * 2;
      p.c = COLORS[Math.floor(Math.random() * COLORS.length)];
      p.a = 0.55 + Math.random() * 0.45;
      p.dx = 0; p.dy = 0;
      return p;
    }
    function spawnFly(f) {
      f.x = Math.random() * W;
      f.y = H * (0.12 + Math.random() * 0.5);
      f.r = 1.2 + Math.random() * 1.8;
      f.ph = Math.random() * Math.PI * 2;
      f.sp = 0.006 + Math.random() * 0.01;
      f.ax = Math.random() * Math.PI * 2;
      f.ay = Math.random() * Math.PI * 2;
      f.blink = 0.6 + Math.random() * 1.4;
      return f;
    }
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < (isMobile ? 22 : 38); i++) petals.push(spawnPetal({}, true));
    for (let i = 0; i < (isMobile ? 20 : 34); i++) flies.push(spawnFly({}));

    // one glowing dot, drawn once and stamped for every firefly
    const SPR = 64, spr = document.createElement("canvas");
    spr.width = spr.height = SPR;
    (() => {
      const c = spr.getContext("2d"), g = c.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
      g.addColorStop(0, "rgba(255, 244, 190, .95)");
      g.addColorStop(0.18, "rgba(255, 214, 110, .5)");
      g.addColorStop(1, "rgba(255, 180, 60, 0)");
      c.fillStyle = g;
      c.fillRect(0, 0, SPR, SPR);
    })();

    let t = 0, dirty = true;
    gsap.ticker.add(() => {
      t += 0.016;
      // nothing to draw (the blade scene): leave the canvas alone
      if (fx.petals <= 0.01 && fx.flies <= 0.01) {
        if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height); dirty = false; }
        return;
      }
      dirty = true;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* petals */
      if (fx.petals > 0.01) {
        const gust = Math.sin(t * 0.3) * 0.22 + fx.wind;
        for (const p of petals) {
          p.sway += 0.014;
          // the cursor pushes petals away, like a breath of wind
          const ddx = p.x - fx.mx, ddy = p.y - fx.my, d2 = ddx * ddx + ddy * ddy;
          if (d2 < 22000) { const k = (1 - d2 / 22000) * 0.9; p.dx += (ddx / Math.sqrt(d2 + 1)) * k; p.dy += (ddy / Math.sqrt(d2 + 1)) * k; }
          p.dx *= 0.94; p.dy *= 0.94;
          p.x += p.vx + gust * 1.1 + Math.sin(p.sway) * 0.3 + p.dx;
          p.y += p.vy + Math.abs(fx.wind) * 0.5 + p.dy;
          p.rot += p.vr + gust * 0.003;
          p.flip += p.vf;
          if (p.y > H + 40 || p.x > W + 60 || p.x < -80) spawnPetal(p, false);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(p.s / 100, (p.s / 100) * Math.cos(p.flip));
          ctx.translate(-50, -60);
          ctx.globalAlpha = p.a * fx.petals * (1 - fx.night * 0.3);
          ctx.fillStyle = p.c;
          ctx.fill(shape);
          ctx.restore();
        }
      }

      /* fireflies */
      if (fx.flies > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        for (const f of flies) {
          f.ax += f.sp; f.ay += f.sp * 1.3;
          f.x += Math.cos(f.ax) * 0.45 + Math.sin(t * 0.2 + f.ph) * 0.15;
          f.y += Math.sin(f.ay) * 0.3 - 0.05;
          if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
          if (f.y < H * 0.08) f.y = H * 0.62; if (f.y > H * 0.66) f.y = H * 0.1;
          const glow = (0.5 + 0.5 * Math.sin(t * f.blink + f.ph)) ** 2;
          const a = glow * fx.flies;
          if (a < 0.02) continue;
          const R = f.r * 9;
          ctx.globalAlpha = a;
          ctx.drawImage(spr, f.x - R, f.y - R, R * 2, R * 2);
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      fx.wind *= 0.95;
    });
  })();

  /* ---------------- GSAP ---------------- */
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  // the shot always starts at the samurai, even after a reload
  ScrollTrigger.clearScrollMemory("manual");
  // the phone address bar showing / hiding must not re-layout the shot
  ScrollTrigger.config({ ignoreMobileResize: true });
  window.scrollTo(0, 0);

  gsap.set(".slash", { scaleX: 0, autoAlpha: 0, transformOrigin: "0% 50%" });
  gsap.set(".slash--1", { rotation: -14 });
  gsap.set(".slash--2", { rotation: 12, transformOrigin: "100% 50%" });

  /* palette for every stop of the shot */
  const LOOK = [
    { // 1 · dawn, paper and red sun
      "--sky-top": "#f7ecdf", "--sky-mid": "#f6e3d8", "--sky-bot": "#f0d2cb",
      "--m-far": "#d8cbd0", "--m-mid": "#c3b0bb", "--m-near": "#9c8592", "--snow": "#fbf6f2",
      "--ui": "#1d1517", "--frame": "#c8262e", "--mist": "rgba(247, 236, 223, 0.85)",
      "--sun-a": "#f0473f", "--sun-b": "#d7262e", "--sun-c": "#b51a24",
    },
    { // 2 · sakura afternoon, the sun starts to set
      "--sky-top": "#fbeeea", "--sky-mid": "#f8dcdc", "--sky-bot": "#f2c0c4",
      "--m-far": "#e2c6cf", "--m-mid": "#d0a4b3", "--m-near": "#a97d92", "--snow": "#fff3f2",
      "--ui": "#1d1517", "--frame": "#c8262e", "--mist": "rgba(245, 212, 216, 0.85)",
      "--sun-a": "#ff8a5a", "--sun-b": "#ec4a35", "--sun-c": "#c8262e",
    },
    { // 3 · sunset, plum and ember
      "--sky-top": "#1a1019", "--sky-mid": "#3a1826", "--sky-bot": "#8a2e2c",
      "--m-far": "#5a2533", "--m-mid": "#3a1823", "--m-near": "#22111a", "--snow": "#6e3240",
      "--ui": "#f4ede6", "--frame": "#e3b15c", "--mist": "rgba(28, 14, 20, 0.9)",
      "--sun-a": "#ff7a3e", "--sun-b": "#d93a26", "--sun-c": "#9e1c1c",
    },
    { // 4 · night, lanterns
      "--sky-top": "#0b0809", "--sky-mid": "#110b0e", "--sky-bot": "#1a0e12",
      "--m-far": "#1b1217", "--m-mid": "#140d11", "--m-near": "#0d090b", "--snow": "#3a2e33",
      "--ui": "#f4ede6", "--frame": "#e3b15c", "--mist": "rgba(10, 8, 9, 0.95)",
      "--sun-a": "#ff7a3e", "--sun-b": "#d93a26", "--sun-c": "#9e1c1c",
    },
    { // 5 · moonlit night
      "--sky-top": "#0c0a14", "--sky-mid": "#141022", "--sky-bot": "#22121f",
      "--m-far": "#2a2236", "--m-mid": "#1d1626", "--m-near": "#110c14", "--snow": "#4a4058",
      "--ui": "#f4ede6", "--frame": "#e3b15c", "--mist": "rgba(12, 9, 14, 0.92)",
      "--sun-a": "#ff7a3e", "--sun-b": "#d93a26", "--sun-c": "#9e1c1c",
    },
  ];
  // the palette lives only on the elements that use it: tweening it on :root
  // restyled the whole page on every frame of the scroll
  // (the first palette is set once on :root as the resting default)
  const PAL = [...$$(".hdr, .progress, .sky, .sun, .land, .mist, .frame")];
  gsap.set(root, LOOK[0]);
  gsap.set(PAL, LOOK[0]);

  /* ---------- calm snapping ----------
     A small scroll returns to the same scene; the shot moves on only
     after roughly a third of the way, and then glides there slowly. */
  let navigating = false;
  let navTarget = 0;
  let restStop = 0;
  function snapToStop(predicted, self) {
    if (navigating) return navTarget;
    // use where the shot really is, not the fling prediction, so one
    // gesture never chains through several scenes
    const value = self ? self.progress : predicted;
    const d = tl.duration();
    const stops = Object.values(tl.labels).map((t) => t / d).sort((a, b) => a - b);
    let near = 0;
    stops.forEach((s, n) => { if (Math.abs(s - value) < Math.abs(stops[near] - value)) near = n; });
    let from = 0;
    stops.forEach((s, n) => { if (Math.abs(s - restStop) < Math.abs(stops[from] - restStop)) from = n; });
    if (near === from) {
      const gap = value - stops[from];
      const seg = 1 / (stops.length - 1);
      if (Math.abs(gap) > seg * 0.3) near = gsap.utils.clamp(0, stops.length - 1, from + Math.sign(gap));
    }
    restStop = stops[near];
    return restStop;
  }

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: "#track",
      start: "top top",
      end: "bottom bottom",
      scrub: 1.8,
      invalidateOnRefresh: true,
      snap: reduceMotion ? false : {
        snapTo: snapToStop,
        duration: { min: 1, max: 2.2 },
        delay: 0.15,
        ease: "sine.inOut",
      },
      onUpdate: onProgress,
    },
  });

  ["s1", "s2", "s3", "s4", "s5"].forEach((l, i) => tl.addLabel(l, i));

  const scenes = [...$$(".scene")];
  let liveKey = "";
  function markLive() {
    const t = tl.time();
    const key = scenes.map((_, n) => (t > n - 0.62 && t < n + 0.52 ? 1 : 0)).join("");
    if (key === liveKey) return;
    liveKey = key;
    scenes.forEach((s, n) => s.classList.toggle("is-live", key[n] === "1"));
  }
  root.classList.add("has-live");
  tl.eventCallback("onUpdate", markLive);
  markLive();

  const IR = { immediateRender: false };

  /* helpers */
  const revealOut = (scene, i) =>
    tl.fromTo(`${scene} .reveal`, { y: 0, autoAlpha: 1 },
      { y: "-6vh", autoAlpha: 0, stagger: 0.025, duration: 0.32, ease: "sine.in", ...IR }, i + 0.03);
  const revealIn = (scene, i, at = 0.5) =>
    tl.fromTo(`${scene} .reveal`, { y: "7vh", autoAlpha: 0 },
      { y: 0, autoAlpha: 1, stagger: 0.035, duration: 0.4, ease: "sine.out", ...IR }, i + at);
  const sceneSwap = (from, to, i) => {
    tl.fromTo(from, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.06, ...IR }, i + 0.47);
    tl.fromTo(to, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06, ...IR }, i + 0.42);
  };
  const look = (i) => tl.to(PAL, { ...LOOK[i + 1], duration: 1, ease: "sine.inOut" }, i);
  const blade = (sel, i) =>
    tl.fromTo(sel, { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, duration: 0.16, ease: "power2.out", ...IR }, i)
      .to(sel, { autoAlpha: 0, duration: 0.16 }, i + 0.18);

  const sun = ".sun-wrap", land = ".land";
  const far = ".range--far", mid = ".range--mid", near = ".range--near";

  /* the sun on scene 2: lower, just above the tip of Fuji, starting to set */
  // the sun is moved relative to where CSS puts it in scene 1 (layout box, ignores transforms)
  const sunEl = $(".sun-wrap");
  const sunCX = () => sunEl.offsetLeft + sunEl.offsetWidth / 2;
  const sunCY = () => sunEl.offsetTop + sunEl.offsetHeight / 2;
  const sunTo = (cx, cy, diameter) => ({
    x: () => cx() - sunCX(),
    y: () => cy() - sunCY(),
    scale: () => diameter() / sunEl.offsetWidth,
  });
  // scene 2: lower, just above the tip of Fuji, starting to set
  const sunS2 = isMobile
    ? sunTo(() => vw(84), () => vh(44), () => vw(15))
    : sunTo(() => vw(49), () => vh(47), () => vh(16.5));
  // scene 3: a big sunset glow (behind the plate on phones)
  const sunS3 = isMobile
    ? sunTo(() => vw(50), () => vh(26), () => vw(90))
    : sunTo(() => vw(36), () => vh(86), () => vh(62.7));

  /* ---------- 1 → 2 : samurai → sakura ---------- */
  let i = 0;
  look(i);
  revealOut(".s1", i);
  tl.fromTo(".v-banner", { y: 0, autoAlpha: 1 }, { y: "-14vh", autoAlpha: 0, duration: 0.35, ...IR }, i + 0.02)
    .fromTo(".samurai-wrap", { x: 0, scale: 1, autoAlpha: 1 }, { x: "24vw", scale: 1.2, autoAlpha: 0, duration: 0.5, ease: "sine.in", ...IR }, i + 0.04)
    .fromTo(".kumo-wrap", { x: 0, autoAlpha: 1 }, { x: "-26vw", autoAlpha: 0, duration: 0.5, ...IR }, i + 0.04)
    .fromTo(".s1 .l1, .s1 .l2", { y: 0 }, { y: "-45vh", duration: 0.45, ease: "sine.in", ...IR }, i)
    .fromTo(".branch-wrap--s1", { x: 0, y: 0 }, { x: "-6vw", y: "4vh", duration: 1, ...IR }, i)
    .to(sun, { ...sunS2, duration: 1, ease: "sine.inOut" }, i)
    .to(".seigaiha", { opacity: 0.22, duration: 1 }, i)
    .to(land, { y: "5vh", duration: 1, ease: "sine.inOut" }, i)
    .to(far, { y: "1vh", x: "-1vw", duration: 1, ease: "sine.inOut" }, i)
    .to(mid, { y: "4vh", x: "-3vw", duration: 1, ease: "sine.inOut" }, i)
    .to(near, { y: "8vh", x: "-6vw", duration: 1, ease: "sine.inOut" }, i);
  sceneSwap(".s1", ".s2", i);
  tl.fromTo(".window-wrap", { y: "18vh", scale: 0.86, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.55, ease: "sine.out", ...IR }, i + 0.42)
    .fromTo(".s2-kanji", { y: "12vh", autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: "sine.out", ...IR }, i + 0.45)
    // the left branch grows in from the edge of the screen and blossoms
    .fromTo(".branch-wrap--s2a", { x: "-30vw", y: "-6vh", rotation: -10 }, { x: 0, y: 0, rotation: 0, duration: 0.55, ease: "sine.out", ...IR }, i + 0.4)
    .fromTo(".branch-wrap--s2a .bloom", { scale: 0 }, { scale: 1, transformOrigin: "50% 50%", stagger: { amount: 0.35 }, duration: 0.18, ease: "back.out(2)", ...IR }, i + 0.55)
    .fromTo(".branch-wrap--s2b", { x: "8vh", y: "10vh", autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 0.5, ease: "sine.out", ...IR }, i + 0.5)
    .fromTo(".branch-wrap--s2b .bloom", { scale: 0 }, { scale: 1, transformOrigin: "50% 50%", stagger: { amount: 0.3 }, duration: 0.16, ease: "back.out(2)", ...IR }, i + 0.6);
  revealIn(".s2", i);

  /* ---------- 2 → 3 : sakura → sushi (sunset) ---------- */
  i = 1;
  look(i);
  revealOut(".s2", i);
  tl.fromTo(".window-wrap", { x: 0, scale: 1, autoAlpha: 1 }, { x: "16vw", scale: 1.14, autoAlpha: 0, duration: 0.45, ease: "sine.in", ...IR }, i + 0.04)
    .fromTo(".s2-kanji", { y: 0, autoAlpha: 1 }, { y: "-14vh", autoAlpha: 0, duration: 0.4, ...IR }, i + 0.04)
    .fromTo(".branch-wrap--s1", { autoAlpha: 1 }, { x: "14vw", y: "-16vh", autoAlpha: 0, duration: 0.45, ease: "sine.in", ...IR }, i + 0.02)
    .fromTo(".branch-wrap--s2a", { x: 0, autoAlpha: 1 }, { x: "-20vw", autoAlpha: 0, duration: 0.42, ease: "sine.in", ...IR }, i + 0.03)
    .to(sun, { ...sunS3, duration: 1, ease: "sine.inOut" }, i)
    .to(".seigaiha", { opacity: 0, duration: 0.6 }, i)
    .to(".haze", { opacity: 0, duration: 0.6 }, i)
    .to(".torii", { opacity: 0.25, duration: 0.8 }, i)
    .to(land, { y: "0vh", scale: 1.06, duration: 1, ease: "sine.inOut" }, i)
    .to(far, { y: "0vh", x: "2vw", duration: 1, ease: "sine.inOut" }, i)
    .to(mid, { y: "2vh", x: "3vw", duration: 1, ease: "sine.inOut" }, i)
    .to(near, { y: "4vh", x: "5vw", duration: 1, ease: "sine.inOut" }, i);
  sceneSwap(".s2", ".s3", i);
  tl.fromTo(".plate-wrap", { x: "-18vw", rotation: -40, scale: 0.8, autoAlpha: 0 }, { x: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.58, ease: "sine.out", ...IR }, i + 0.42)
    .fromTo(".s3-kanji", { y: "14vh", autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: "sine.out", ...IR }, i + 0.45);
  revealIn(".s3", i);

  /* ---------- 3 → 4 : sushi → the blade (night) ---------- */
  i = 2;
  look(i);
  revealOut(".s3", i);
  tl.fromTo(".plate-wrap", { x: 0, rotation: 0, scale: 1, autoAlpha: 1 }, { x: "-12vw", rotation: 35, scale: 1.18, autoAlpha: 0, duration: 0.45, ease: "sine.in", ...IR }, i + 0.04)
    .fromTo(".s3-kanji", { y: 0, autoAlpha: 1 }, { y: "-16vh", autoAlpha: 0, duration: 0.4, ...IR }, i + 0.04)
    .to(sun, { y: "100vh", duration: 0.8, ease: "sine.in" }, i)
    .to(".stars", { opacity: 0.55, duration: 1 }, i)
    .to(fx, { petals: 0, duration: 0.4 }, i + 0.3)
    .to(land, { y: "46vh", scale: 1.1, duration: 1, ease: "sine.inOut" }, i)
    .to(far, { y: "6vh", duration: 1, ease: "sine.inOut" }, i)
    .to(mid, { y: "14vh", duration: 1, ease: "sine.inOut" }, i)
    .to(near, { y: "24vh", duration: 1, ease: "sine.inOut" }, i);
  sceneSwap(".s3", ".s4", i);
  // the night closes in, the cut runs across the screen and the blade rises out of the dark
  tl.fromTo(".s4-night", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ...IR }, i + 0.35)
    .fromTo(".sword-slide", { yPercent: 75, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "power2.out", ...IR }, i + 0.42)
    .fromTo(".saya-slide", { yPercent: 85, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "power2.out", ...IR }, i + 0.48)
    .fromTo(".gl", { y: "8vh", autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.05, duration: 0.4, ease: "sine.out", ...IR }, i + 0.5)
    .fromTo(".s4-kanji", { scale: 1.4 }, { scale: 1, duration: 0.5, ease: "sine.out", ...IR }, i + 0.5);
  blade(".slash--1", i + 0.5);
  revealIn(".s4", i);

  /* ---------- 4 → 5 : the blade → contacts (moonlight) ---------- */
  i = 3;
  look(i);
  revealOut(".s4", i);
  tl.fromTo(".sword-slide", { yPercent: 0, autoAlpha: 1 }, { yPercent: -80, autoAlpha: 0, duration: 0.45, ease: "sine.in", ...IR }, i + 0.04)
    .fromTo(".saya-slide", { yPercent: 0, autoAlpha: 1 }, { yPercent: -80, autoAlpha: 0, duration: 0.45, ease: "sine.in", ...IR }, i + 0.08)
    .fromTo(".gl", { y: 0, autoAlpha: 1 }, { y: "-8vh", autoAlpha: 0, stagger: 0.03, duration: 0.35, ease: "sine.in", ...IR }, i + 0.04)
    .to(".stars", { opacity: 1, duration: 1 }, i)
    .to(fx, { flies: 1, duration: 0.5 }, i + 0.45)
    .to(".torii", { opacity: 0.12, duration: 1 }, i)
    .to(land, { y: "4vh", scale: 1.02, duration: 1, ease: "sine.inOut" }, i)
    .to(far, { y: "0vh", x: "0vw", duration: 1, ease: "sine.inOut" }, i)
    .to(mid, { y: "2vh", x: "0vw", duration: 1, ease: "sine.inOut" }, i)
    .to(near, { y: "4vh", x: "0vw", duration: 1, ease: "sine.inOut" }, i)
    .fromTo(".moon-wrap", { y: "16vh", autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "sine.out", ...IR }, i + 0.3);
  blade(".slash--2", i + 0.44);
  sceneSwap(".s4", ".s5", i);
  tl.fromTo(".garland", { y: "-40vh" }, { y: 0, duration: 0.55, ease: "sine.out", ...IR }, i + 0.42)
    .fromTo(".far-lanterns", { y: "20vh", autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "sine.out", ...IR }, i + 0.45)
    .fromTo(".panel", { y: "24vh", autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "sine.out", ...IR }, i + 0.45)
    .fromTo(".s5-vertical", { y: "8vh", autoAlpha: 0 }, { y: 0, autoAlpha: 0.8, duration: 0.5, ...IR }, i + 0.55);
  revealIn(".s5", i);
  // the last stop sits where the final scene has fully settled
  tl.addLabel("s5", tl.duration());

  /* ---------------- the petal that passes the camera ----------------
     Played in real time (not tied to scroll speed), slow and soft,
     and each time from a different side of the screen. */
  const PATHS = [ // start, middle, end (top-left of a 62vh × 74vh petal, in vw / vh) + rotations
    { a: [-55, 62], b: [26, 14], c: [104, -82], r: [-50, 10, 70] },    // bottom-left  → top-right
    { a: [104, -18], b: [42, 22], c: [-62, 76], r: [120, 60, -20] },   // top-right    → bottom-left
    { a: [28, -96], b: [38, 14], c: [46, 116], r: [15, 50, 95] },      // top          → bottom
    { a: [-78, 22], b: [24, 6], c: [110, -4], r: [-35, 25, 85] },      // left         → right
    { a: [110, 28], b: [34, 12], c: [-74, 8], r: [40, -10, -70] },     // right        → left
    { a: [40, 112], b: [30, 12], c: [18, -102], r: [160, 110, 40] },   // bottom       → top
    { a: [-56, -84], b: [22, 10], c: [100, 112], r: [-20, 40, 110] },  // top-left     → bottom-right
    { a: [104, 100], b: [30, 18], c: [-60, -86], r: [200, 140, 80] },  // bottom-right → top-left
  ];
  const bp1 = $(".bigpetal:not(.bigpetal--2)"), bp2 = $(".bigpetal--2");
  let lastPath = -1, lastFly = 0;
  const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

  function fly(el, p, dur, delay, shift) {
    const o = { t: 0 };
    gsap.killTweensOf(el);
    gsap.set(el, { autoAlpha: 0 });
    gsap.to(o, {
      t: 1, duration: dur, delay, ease: "sine.inOut",
      onStart: () => gsap.set(el, { autoAlpha: 1 }),
      onUpdate: () => gsap.set(el, {
        x: vw(bez(p.a[0], p.b[0] + shift, p.c[0], o.t)),
        y: vh(bez(p.a[1], p.b[1] + shift, p.c[1], o.t)),
        rotation: bez(p.r[0], p.r[1], p.r[2], o.t),
      }),
      onComplete: () => gsap.set(el, { autoAlpha: 0 }),
    });
  }
  function petalPass() {
    if (reduceMotion || !bp1) return;
    const now = performance.now();
    if (now - lastFly < 1400) return;
    lastFly = now;
    let n;
    do { n = Math.floor(Math.random() * PATHS.length); } while (n === lastPath);
    lastPath = n;
    fly(bp1, PATHS[n], 3.2, 0, 0);
    fly(bp2, PATHS[(n + 3) % PATHS.length], 3.6, 0.35, 14);
  }

  /* ---------------- header nav, progress ---------------- */
  const NUM = ["一", "二", "三", "四", "五"];
  const navLinks = $$(".nav a, .mnav-links a");
  const fill = $(".progress-fill");
  const num = $(".progress-num");
  let current = -1;
  const snav = $(".snav"), snavNum = $(".snav-num");
  document.body.classList.add("is-start");
  let prevTime = 0;

  function onProgress(self) {
    const p = self.progress;
    const anim = self.animation;
    if (fill) fill.style.transform = `scaleY(${p})`;
    const idx = Math.min(4, Math.round(p * anim.duration()));
    if (idx !== current) {
      current = idx;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.go === `s${idx + 1}`));
      if (num) num.textContent = NUM[idx];
      // on the contacts scene the phones are on screen, so the floating call button steps aside
      document.body.classList.toggle("is-end", idx === 4);
      document.body.classList.toggle("is-start", idx === 0);
      if (snavNum) snavNum.textContent = NUM[idx];
      // once the guest has moved on, the "next" hint has done its job
      if (idx > 0 && snav) snav.classList.remove("snav--hint");
    }
    fx.night = gsap.utils.clamp(0, 1, p * 2 - 0.9);
    fx.wind = gsap.utils.clamp(-2, 2, fx.wind + self.getVelocity() / 6000);

    // launch the petal when the shot leaves a scene (either direction)
    const t = anim.time();
    for (let s = 0; s < 4; s++) {
      if ((prevTime < s + 0.1 && t >= s + 0.1) || (prevTime > s + 0.9 && t <= s + 0.9)) { petalPass(); break; }
    }
    prevTime = t;
  }

  /* mobile menu */
  const burger = $(".burger"), mnav = $("#mnav");
  let menuOpen = false;
  function setMenu(open) {
    if (!burger || !mnav || open === menuOpen) return;
    menuOpen = open;
    document.body.classList.toggle("is-menu", open);
    burger.setAttribute("aria-expanded", String(open));
    mnav.setAttribute("aria-hidden", String(!open));
    gsap.killTweensOf(mnav);
    if (open) {
      gsap.set(mnav, { visibility: "visible" });
      gsap.to(mnav, { clipPath: "circle(150% at calc(100% - 38px) 32px)", duration: 0.9, ease: "power3.inOut" });
      gsap.fromTo(".mnav-links a, .mnav-foot", { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.6, delay: 0.3, ease: "power3.out" });
    } else {
      gsap.to(mnav, { clipPath: "circle(0% at calc(100% - 38px) 32px)", duration: 0.7, ease: "power3.inOut", onComplete: () => gsap.set(mnav, { visibility: "hidden" }) });
    }
  }
  if (burger) burger.addEventListener("click", () => setMenu(!menuOpen));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* glide the shot to a scene (menu links and the phone step buttons) */
  const LABELS = ["s1", "s2", "s3", "s4", "s5"];
  let goIdx = 0;
  function goTo(label) {
    const st = tl.scrollTrigger;
    navigating = true;
    navTarget = tl.labels[label] / tl.duration();
    restStop = navTarget;
    goIdx = LABELS.indexOf(label);
    let done = false;
    const release = () => { if (!done) { done = true; setTimeout(() => { navigating = false; }, 700); } };
    window.addEventListener("scrollend", release, { once: true });
    setTimeout(release, 2600);
    window.scrollTo({ top: Math.round(st.labelToScroll(label)), behavior: "smooth" });
  }
  $$("[data-go]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setMenu(false);
      goTo(a.dataset.go);
    });
  });

  // phone: one tap = one scene; quick taps keep counting from where the shot is heading
  if (snav) {
    const step = (d) => {
      // where the page really is (the animation may still be catching up)
      const st = tl.scrollTrigger, y = st.scroll();
      let near = 0;
      LABELS.forEach((l, n) => { if (Math.abs(st.labelToScroll(l) - y) < Math.abs(st.labelToScroll(LABELS[near]) - y)) near = n; });
      const base = navigating ? goIdx : near;
      const n = gsap.utils.clamp(0, LABELS.length - 1, base + d);
      snav.classList.remove("snav--hint");
      if (n !== base) goTo(LABELS[n]);
    };
    $(".snav-up").addEventListener("click", () => step(-1));
    $(".snav-down").addEventListener("click", () => step(1));
  }

  /* ---------------- the logo: a hanko seal that stamps itself ---------------- */
  if (!reduceMotion) {
    gsap.timeline({ repeat: -1, repeatDelay: 5, delay: 2.4 })
      .to(".hanko", { scale: 1.14, rotation: -9, y: -3, duration: 0.35, ease: "sine.out" })
      .to(".hanko", { scale: 0.92, rotation: 0, y: 1, duration: 0.16, ease: "power3.in" })
      .to(".hanko", { scale: 1, y: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" })
      .fromTo(".hanko-sheen", { xPercent: -110 }, { xPercent: 110, duration: 0.9, ease: "sine.inOut" }, "-=0.5")
      .to(".brand-word", { letterSpacing: "0.5em", duration: 0.8, ease: "sine.inOut" }, "<")
      .to(".brand-word", { letterSpacing: "0.42em", duration: 1.2, ease: "sine.inOut" });
  }

  /* ---------------- intro on load ---------------- */
  if (!reduceMotion) {
    const intro = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.15 });
    intro
      .from(".sun", { scale: 0.55, autoAlpha: 0, duration: 1.8 }, 0)
      .from(".range", { yPercent: 18, stagger: 0.12, duration: 1.6 }, 0)
      .from(".haze", { autoAlpha: 0, duration: 2 }, 0.2)
      .from(".samurai", { xPercent: 14, autoAlpha: 0, duration: 1.7 }, 0.35)
      .from(".s1 .l1, .s1 .l2", { yPercent: -120, duration: 1.8, ease: "elastic.out(1, 0.55)", stagger: 0.15 }, 0.4)
      .from(".branch-wrap--s1 .branch", { xPercent: 22, yPercent: -10, autoAlpha: 0, duration: 1.8 }, 0.4)
      .from(".kumo", { xPercent: -40, autoAlpha: 0, duration: 1.6 }, 0.6)
      .from(".v-banner > *", { yPercent: -40, autoAlpha: 0, stagger: 0.1, duration: 1 }, 0.6)
      .from(".s1 .reveal", { yPercent: 60, autoAlpha: 0, stagger: 0.09, duration: 1.1 }, 0.55)
      .from(".hdr, .progress", { autoAlpha: 0, duration: 1 }, 0.9)
      .from(".frame .corner", { autoAlpha: 0, scale: 0.6, stagger: 0.08, duration: 0.9 }, 1);
  }

  /* ---------------- mouse: depth + 3D tilt ---------------- */
  if (!reduceMotion) {
    // [selector, shift in px, tilt in degrees]
    const layers = [
      [".samurai-wrap", 26, 7], [".sun-wrap", -12, 0], [".s1-text", 9, 4], [".kumo-wrap", -20, 0], [".branch-wrap--s1", 16, 0],
      [".window-wrap", 20, 9], [".s2-text", 9, 4], [".s2-kanji", -16, 0], [".branch-wrap--s2a", 14, 0],
      [".plate-wrap", 22, 10], [".s3-text", 9, 4], [".s3-kanji", -14, 0],
      [".s4-text", 10, 0], [".sword-slide", 20, 0], [".saya-slide", 15, 0], [".s4-glyphs", -14, 0], [".moon-wrap", -10, 0], [".panel", 5, 2], [".far-lanterns", -12, 0], [".garland", 6, 0],
      [".range--far", 5, 0], [".range--mid", 12, 0], [".range--near", 22, 0],
    ].map(([s, d, r]) => ({ el: $(s), d: isMobile ? d * 0.5 : d, r: isMobile ? r * 0.6 : r })).filter((l) => l.el)
      .map((l) => ({ ...l, scene: l.el.closest(".scene") }));
    const target = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
    if (!isTouch) {
      window.addEventListener("pointermove", (e) => {
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = (e.clientY / window.innerHeight) * 2 - 1;
        fx.mx = e.clientX; fx.my = e.clientY;
      });
      document.addEventListener("pointerleave", () => { fx.mx = fx.my = -9999; target.x = target.y = 0; });
    }
    let drift = 0;
    gsap.ticker.add(() => {
      // phones have no cursor: the depth layers drift by themselves, slowly
      if (isTouch) {
        drift += 0.006;
        target.x = Math.sin(drift) * 0.7;
        target.y = Math.sin(drift * 0.73 + 1.2) * 0.5;
      }
      pos.x += (target.x - pos.x) * 0.06;
      pos.y += (target.y - pos.y) * 0.06;
      const mag = Math.min(1, Math.hypot(pos.x, pos.y));
      for (const l of layers) {
        if (l.scene && !l.scene.classList.contains("is-live")) continue;
        l.el.style.translate = `${(-pos.x * l.d).toFixed(2)}px ${(-pos.y * l.d * 0.6).toFixed(2)}px`;
        if (l.r) l.el.style.rotate = `${(-pos.y).toFixed(3)} ${pos.x.toFixed(3)} 0 ${(mag * l.r).toFixed(2)}deg`;
      }
    });
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();

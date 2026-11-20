(function () {
  "use strict";

  var dict = window.KATANA_I18N || {};
  var LANGS = ["ru", "uz", "en"];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Language ---------- */
  function storedLang() {
    try { return localStorage.getItem("katana-lang"); } catch (e) { return null; }
  }
  function saveLang(l) {
    try { localStorage.setItem("katana-lang", l); } catch (e) { /* ignore */ }
  }
  function detectLang() {
    var fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.indexOf(fromUrl) > -1) return fromUrl;
    var saved = storedLang();
    if (LANGS.indexOf(saved) > -1) return saved;
    var nav = (navigator.language || "ru").slice(0, 2).toLowerCase();
    if (nav === "uz") return "uz";
    if (nav === "en") return "en";
    return "ru";
  }

  function applyLang(lang) {
    var t = dict[lang];
    if (!t) return;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (t[key] != null) el.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      if (t[key] != null) el.setAttribute("alt", t[key]);
    });
    if (t["meta.title"]) document.title = t["meta.title"];
    document.querySelectorAll(".lang button").forEach(function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    saveLang(lang);
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
  });
  applyLang(detectLang());

  /* ---------- Header / menu ---------- */
  var header = document.getElementById("header");
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  var fab = document.querySelector(".fab");

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle("is-scrolled", y > 40);
    if (fab) fab.classList.toggle("is-visible", y > window.innerHeight * 0.6);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    nav.classList.toggle("is-open", open);
    header.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }
  burger.addEventListener("click", function () {
    setMenu(burger.getAttribute("aria-expanded") !== "true");
  });
  nav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (el, i) {
      // stagger siblings a little
      var parent = el.parentElement;
      var idx = Array.prototype.indexOf.call(parent.children, el);
      el.style.transitionDelay = Math.min(idx, 5) * 80 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Hero parallax (desktop pointer) ---------- */
  var heroImg = document.getElementById("heroImg");
  var hero = document.getElementById("hero");
  if (heroImg && hero && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * -18;
      ty = ((e.clientY - r.top) / r.height - 0.5) * -12;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    function tick() {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      heroImg.style.translate = cx.toFixed(2) + "px " + cy.toFixed(2) + "px";
      raf = Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(tick) : null;
    }
  }

  /* ---------- Sakura petals ---------- */
  var canvas = document.getElementById("petals");
  if (canvas && canvas.getContext && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var petals = [];
    var W = 0, H = 0, dpr = 1, running = true;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.round(Math.min(38, Math.max(14, W / 40)));
      while (petals.length < target) petals.push(makePetal(true));
      petals.length = target;
    }
    function makePetal(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -20,
        s: 5 + Math.random() * 8,
        vy: 0.35 + Math.random() * 0.8,
        vx: 0.2 + Math.random() * 0.6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.04,
        sway: Math.random() * Math.PI * 2,
        a: 0.45 + Math.random() * 0.45,
        hue: Math.random() < 0.8 ? "244,169,191" : "255,214,226"
      };
    }
    function drawPetal(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.62 + 0.38 * Math.sin(p.sway * 1.6));
      ctx.fillStyle = "rgba(" + p.hue + "," + p.a + ")";
      ctx.beginPath();
      ctx.moveTo(0, -p.s);
      ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.6, p.s * 0.7, p.s * 0.6, 0, p.s);
      ctx.bezierCurveTo(-p.s * 0.7, p.s * 0.6, -p.s * 0.9, -p.s * 0.6, 0, -p.s);
      ctx.fill();
      ctx.restore();
    }
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.sway += 0.02;
        p.x += p.vx + Math.sin(p.sway) * 0.6;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H + 20 || p.x > W + 20) { petals[i] = makePetal(false); petals[i].x = Math.random() * W * 0.9 - W * 0.1; }
        drawPetal(p);
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);

    // pause when hero is off-screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        var vis = en[0].isIntersecting;
        if (vis && !running) { running = true; requestAnimationFrame(frame); }
        else if (!vis) running = false;
      }).observe(canvas);
    }
  }

  /* ---------- Year ---------- */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

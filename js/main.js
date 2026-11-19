/* ═══════════════════════════════════════════════════════════════════════
   main.js — boots the page.

   Two modes:
     • 3D mode   (WebGL available, motion allowed): Lenis smooth scroll + the
                 Three.js scene from scene.js, driven by scroll position.
     • Static mode (no WebGL, prefers-reduced-motion, or anything fails): the
                 same HTML over a pastel CSS backdrop with simple fade-ins.
   Everything the visitor needs to read is plain HTML in both modes.
   ═══════════════════════════════════════════════════════════════════════ */

window.__booted = true;   // tells the inline safety net in index.html that modules work
const root = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── Capability checks ─────────────────────────────────────────────── */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
})();
// "Lite" = phones / weak laptops: fewer particles, cheaper materials, lower DPR, no AA.
const lite = (() => {
  const smallTouch = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const saveData = navigator.connection && navigator.connection.saveData;
  return smallTouch || weak || !!saveData;
})();

/* ── Loader ────────────────────────────────────────────────────────── */
const loader = $('#loader'), fill = $('#loaderFill'), pct = $('#loaderPct');
let shown = 0;
function setProgress(p) {
  shown = Math.max(shown, Math.min(1, p));          // never go backwards
  fill.style.transform = `scaleX(${shown})`;
  pct.textContent = Math.round(shown * 100) + '%';
}
function hideLoader() {
  setProgress(1);
  setTimeout(() => { loader.classList.add('done'); loader.setAttribute('aria-hidden', 'true'); }, 350);
}

/* ── Things both modes share ───────────────────────────────────────── */
const nav = $('#nav'), menuBtn = $('#menuBtn'), navLinks = $('#navLinks');
menuBtn.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) { navLinks.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') navLinks.classList.remove('open'); });

const stops = $$('[data-stop]');                      // order matches scene.js: hero, about, skills, projects…, experience, contact
const timelineItems = $$('.tl-item');
const sectionLinks = $$('#navLinks a');

// Experience: light up timeline items (and 3D milestones) once they pass ~62% down the screen.
let onMilestones = () => {};
function updateTimeline() {
  const line = innerHeight * 0.62;
  let count = 0;
  timelineItems.forEach((el) => {
    const on = el.getBoundingClientRect().top < line;
    el.classList.toggle('lit', on);
    if (on) count++;
  });
  onMilestones(count);
}

function setActiveNav(stopIndex) {
  const sec = stops[stopIndex] && stops[stopIndex].closest('section');
  const id = sec ? '#' + sec.id : '';
  sectionLinks.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === id ? 'true' : 'false'));
}

// Contact form (Formspree, unchanged endpoint)
const form = $('#contactForm'), note = $('#formNote');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('button[type=submit]', form), label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Sending…';
  note.className = 'form-note';
  try {
    const res = await fetch('https://formspree.io/f/mqenqeda', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('failed');
    form.reset();
    note.textContent = 'Thanks — your message is on its way. I typically respond within 24 hours.';
    note.classList.add('good');
  } catch {
    note.textContent = 'Something went wrong. Please try again, or email me directly.';
    note.classList.add('err');
  } finally {
    btn.disabled = false; btn.innerHTML = label;
  }
});

/* Card tilt on hover (pure CSS transform; the 3D card tilts in scene.js). */
function initCardTilt() {
  if (matchMedia('(hover: none)').matches || reduceMotion) return;
  $$('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ═══ STATIC MODE ═════════════════════════════════════════════════════ */
function startStatic() {
  root.classList.remove('has-3d');
  root.classList.add('static', 'js-reveal');
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.12 });
  $$('[data-reveal], [data-hero]').forEach((el) => io.observe(el));
  const sectionIO = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) setActiveNav(stops.indexOf(en.target)); }), { threshold: 0.5 });
  stops.forEach((s) => sectionIO.observe(s));
  addEventListener('scroll', () => { nav.classList.toggle('scrolled', scrollY > 40); updateTimeline(); }, { passive: true });
  updateTimeline();
  initCardTilt();
  hideLoader();
}

/* ═══ 3D MODE ═════════════════════════════════════════════════════════ */
async function start3D() {
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Lenis = window.Lenis;
  if (!gsap || !ScrollTrigger || !Lenis) throw new Error('animation libs missing');
  gsap.registerPlugin(ScrollTrigger);
  setProgress(0.12);

  // Lazy-load Three.js only now, after the page has already painted.
  const { createScene } = await import('./scene.js');
  setProgress(0.3);

  const canvas = $('#scene');
  const projects = $$('.project[data-stop]').map((el) => ({
    motif: el.dataset.motif, color: el.dataset.color, image: el.dataset.image || null, url: el.dataset.url,
  }));
  const orbLabels = $$('.skill').map((el) => $('h3', el).textContent.trim());

  const label = $('#orbLabel');
  let hover = null, lastTarget = null;

  const scene = await createScene({
    canvas, lite, projects, orbLabels,
    onProgress: (p) => setProgress(0.3 + p * 0.6),
    onLost: () => { console.warn('WebGL context lost; switching to static mode'); teardown(); startStatic(); },
    onHover: (h) => {
      hover = h;
      canvas.style.cursor = h ? 'pointer' : '';
      if (h && h.kind === 'orb') {
        label.textContent = h.label;
        label.style.left = h.x + 'px'; label.style.top = h.y + 'px';
        label.classList.add('on');
      } else label.classList.remove('on');
      $$('.skill').forEach((s, i) => s.classList.toggle('on', !!h && h.kind === 'orb' && h.index === i));
    },
  });
  if (scene.stopCount !== stops.length) throw new Error('stop count mismatch: ' + scene.stopCount + ' vs ' + stops.length);
  root.classList.add('has-3d', 'js-reveal');
  onMilestones = (n) => scene.setMilestones(n);

  /* Smooth scrolling. Touch devices keep native momentum scrolling (Lenis default). */
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time) => { lenis.raf(time * 1000); scene.frame(); };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  /* ── Scroll → fractional stop index `f` ────────────────────────────
     For every stop we compute a "hold" band where the camera rests on it,
     then glide (smoothstep eased) to the next. Tall stops hold for longer. */
  let keys = [], vh = innerHeight;
  function computeKeys() {
    vh = innerHeight; keys = [];
    stops.forEach((el, i) => {
      const r = el.getBoundingClientRect(), top = r.top + scrollY, h = r.height, c = top + h / 2;
      keys.push([Math.min(c, top + vh * 0.3), i], [Math.max(c, top + h - vh * 0.3), i]);
    });
  }
  function fFromScroll(y) {
    const yc = y + vh / 2;
    if (yc <= keys[0][0]) return 0;
    for (let k = 0; k < keys.length - 1; k++) {
      const [ya, ia] = keys[k], [yb, ib] = keys[k + 1];
      if (yc <= yb) { if (ia === ib) return ia; const t = (yc - ya) / (yb - ya); return ia + t * t * (3 - 2 * t); }
    }
    return keys[keys.length - 1][1];
  }

  const railFill = $('#railFill');
  function onScroll() {
    const y = lenis.scroll;
    const f = fFromScroll(y);
    scene.setScroll(f);
    setActiveNav(Math.round(f));
    nav.classList.toggle('scrolled', y > 40);
    const max = document.documentElement.scrollHeight - vh;
    railFill.style.transform = `scaleY(${max > 0 ? Math.min(1, y / max) : 0})`;
    updateTimeline();
  }
  lenis.on('scroll', onScroll);

  /* ── Reveals: fade/slide in as they enter, and back out as they leave
        (so scrolling up reverses everything). ── */
  $$('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { autoAlpha: 0, y: 26 }, {
      autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', end: 'bottom 8%', toggleActions: 'play reverse play reverse' },
    });
  });
  $$('.project .wrap').forEach((el) => {
    gsap.fromTo(el, { autoAlpha: 0, y: 40 }, {
      autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 15%', toggleActions: 'play reverse play reverse' },
    });
  });

  /* ── Pointer: parallax + 3D hover ── */
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    lastTarget = e.target;
    scene.setPointerEnabled(e.target === canvas || e.target === document.body || e.target === root);
    scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1), e.clientX, e.clientY);
  }, { passive: true });
  addEventListener('click', (e) => {
    if (hover && hover.kind === 'project' && e.target === canvas && hover.url) window.open(hover.url, '_blank', 'noopener');
  });

  // HTML → 3D hover sync
  $$('.skill').forEach((el) => {
    const i = +el.dataset.orb;
    el.addEventListener('pointerenter', () => scene.hoverOrb(i));
    el.addEventListener('pointerleave', () => scene.hoverOrb(-1));
    el.addEventListener('focus', () => scene.hoverOrb(i));
    el.addEventListener('blur', () => scene.hoverOrb(-1));
  });
  $$('.project .card').forEach((el, i) => {
    el.addEventListener('pointerenter', () => scene.hoverProject(i));
    el.addEventListener('pointerleave', () => scene.hoverProject(-1));
    el.addEventListener('focusin', () => scene.hoverProject(i));
    el.addEventListener('focusout', () => scene.hoverProject(-1));
  });
  initCardTilt();

  /* ── Nav jumps ── */
  $$('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const r = target.getBoundingClientRect(), top = r.top + lenis.scroll;
    // Centre short stops in the viewport; tall ones align to their top.
    const y = target.hasAttribute('data-stop') ? top - Math.max(0, (vh - r.height) / 2) : top;
    lenis.scrollTo(Math.max(0, y), { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  }));

  /* ── Resize / layout changes ── */
  let rz;
  function relayout() {
    scene.resize(); computeKeys(); ScrollTrigger.refresh(); onScroll();
  }
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(relayout, 120); });
  new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { computeKeys(); onScroll(); }, 120); }).observe(document.body);

  // Fonts change text metrics (and so section heights); wait for them, but not forever.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  computeKeys();
  // If the page was reloaded part-way down, start the camera there instead of flying in.
  scene.jump(fFromScroll(scrollY));
  onScroll();

  function teardown() { gsap.ticker.remove(tick); lenis.destroy(); }

  hideLoader();
  // Intro: hero copy rises in once the loader is gone.
  setTimeout(() => gsap.fromTo('[data-hero]', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out' }), 250);
}

/* ═══ Boot ════════════════════════════════════════════════════════════ */
(async function boot() {
  // Safety net: never leave a visitor stuck behind the loader.
  setTimeout(() => { if (!loader.classList.contains('done')) hideLoader(); }, 12000);

  if (reduceMotion || !hasWebGL) { startStatic(); return; }
  try {
    await start3D();
  } catch (err) {
    console.warn('3D mode unavailable, using static version:', err);
    startStatic();
  }
})();

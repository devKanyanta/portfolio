/* ═══════════════════════════════════════════════════════════════════════
   scene.js — the 3D world.

   HOW THE JOURNEY WORKS (read this first)
   ───────────────────────────────────────
   • The world is a straight-ish corridor. Every "stop" (hero, about, skills,
     each project, experience, contact) has an ANCHOR point, STEP units apart
     along -Z. The object(s) for that stop are built at its anchor.
   • main.js turns page scroll into one number, `f`, the *fractional stop
     index* (0 = hero, 1 = about, 2.5 = halfway between skills and project 1…).
   • Camera position and look-at are CatmullRom splines through per-stop
     points; we sample them at u = f / (N-1). Because the camera is a pure
     function of `f`, scrolling back up reverses everything for free.
   • To put an object on one side of the screen while the HTML text sits on the
     other, we don't move the object — we aim the camera slightly past it
     (see `offsetFor`). `ox` > 0 means "object appears on the right".

   THE OBJECTS are all procedural "dev" props (laptop, chip, server, database,
   phone, terminal, browser, gear, </> brackets, git branch, neural net). They
   are built from primitives, so there are no model files to download.
   Builders are in the "PROP BUILDERS" section; add a new one to `PROPS` to make
   it available as a data-motif for project cards.
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// Same palette as css/styles.css (cool "concrete & steel").
const C = {
  bg: 0xE8EBEE, ink: 0x10151C, navy: 0x24364D, steel: 0x8DA2B8, mist: 0xC3CDD8,
  teal: 0x4FA39A, sand: 0xCDBE9F, copper: 0xC47A45, white: 0xFFFFFF, deck: 0x14202E,
};
const HEX = (n) => '#' + n.toString(16).padStart(6, '0');
const FOG_NEAR = 0.026;     // thick enough that the next stop's props stay hazy until you arrive
const STEP = 13;            // distance between stops along -Z
const PARTICLE_COLORS = [C.steel, C.teal, C.copper, C.mist, C.navy];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export async function createScene({ canvas, lite, projects, orbLabels, onProgress, onHover, onLost }) {
  /* ── Renderer ─────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
  // Cap pixel ratio: the single biggest GPU saver on retina / phone screens.
  const maxDpr = lite ? 1.25 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.FogExp2(C.bg, FOG_NEAR);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  scene.add(camera);

  /* ── Lights (hemisphere + ambient + 1 directional, parented to the camera
        so shading stays consistent as we travel) ─────────────────────── */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ea, 1.5), new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(3, 5, 4);
  sun.target.position.set(0, 0, -10);
  camera.add(sun, sun.target);

  // Lambert is much cheaper than Standard on weak GPUs; near-identical for matte props.
  const mat = (color, extra = {}) => lite
    ? new THREE.MeshLambertMaterial({ color, ...extra })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
  const flat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });   // "emissive" screens / LEDs

  /* ── Layout of stops ──────────────────────────────────────────────── */
  const P = projects.length;
  const HERO = 0, ABOUT = 1, SKILLS = 2, PROJ0 = 3, EXP = 3 + P, CONTACT = 4 + P;
  const N = CONTACT + 1;

  const anchors = [];
  for (let i = 0; i < N; i++) {
    // A gentle S-curve so the path feels organic rather than ruler-straight.
    anchors.push(new THREE.Vector3(Math.sin(i * 0.8) * 2.5, Math.sin(i * 0.55) * 1.1, -i * STEP));
  }
  const place = (obj, i) => { obj.position.copy(anchors[i]); scene.add(obj); return obj; };

  /* ── Loading (textures for project cards that have an image) ──────── */
  const manager = new THREE.LoadingManager();
  const loaded = new Promise((res) => { manager.onLoad = res; });
  manager.onProgress = (_u, done, total) => onProgress && onProgress(total ? done / total : 1);
  const texLoader = new THREE.TextureLoader(manager);
  let anyTexture = false;

  /* ═══════════════════════════ PROP BUILDERS ═══════════════════════════ */

  // Draw a little fake UI/code screen on a canvas. Procedural: no image files.
  const texCache = {};
  function screenTex(kind) {
    if (texCache[kind]) return texCache[kind];
    const W = 512, H = 320, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    let seed = kind.length * 7919;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const dots = (y) => [C.copper, C.sand, C.teal].forEach((col, i) => { g.fillStyle = HEX(col); g.beginPath(); g.arc(18 + i * 18, y, 5, 0, 7); g.fill(); });
    if (kind === 'code') {                                   // syntax-highlighted code lines
      g.fillStyle = HEX(C.deck); g.fillRect(0, 0, W, H);
      g.fillStyle = '#0d1722'; g.fillRect(0, 0, W, 30); dots(15);
      const cols = [C.teal, C.copper, C.steel, C.mist, C.sand];
      for (let y = 52, row = 0; y < H - 14; y += 24, row++) {
        let x = 26 + [0, 1, 1, 2, 0, 2, 1][row % 7] * 30;
        g.fillStyle = '#3b4d63'; g.fillRect(8, y, 8, 9);                  // line number
        for (let n = 0; n < 4 && x < W - 60; n++) {
          const w = 24 + rnd() * 90;
          g.fillStyle = HEX(cols[Math.floor(rnd() * cols.length)]);
          g.fillRect(x, y, w, 9); x += w + 10;
        }
      }
    } else if (kind === 'terminal') {
      g.fillStyle = '#0b1118'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#16212d'; g.fillRect(0, 0, W, 30); dots(15);
      g.font = '600 21px monospace';
      const lines = [['$ ', 'git commit -m "ship it"'], ['✓ ', 'tests passed (42)'], ['$ ', 'npm run build'], ['✓ ', 'compiled in 1.8s'], ['$ ', 'docker compose up -d'], ['> ', 'listening on :8080']];
      lines.forEach(([a, b], i) => { g.fillStyle = HEX(i % 2 ? C.teal : C.copper); g.fillText(a, 18, 66 + i * 38); g.fillStyle = '#c9d3dd'; g.fillText(b, 18 + g.measureText(a).width, 66 + i * 38); });
    } else if (kind === 'browser') {
      g.fillStyle = '#F3F5F7'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#D5DCE3'; g.fillRect(0, 0, W, 34); dots(17);
      g.fillStyle = '#fff'; g.fillRect(90, 8, 330, 18);
      g.fillStyle = HEX(C.steel); g.fillRect(24, 56, W - 48, 110);          // hero block
      g.fillStyle = HEX(C.navy); g.fillRect(40, 78, 190, 16); g.fillStyle = '#fff'; g.fillRect(40, 108, 130, 9); g.fillRect(40, 126, 100, 9);
      [C.teal, C.sand, C.copper].forEach((col, i) => { g.fillStyle = HEX(col); g.fillRect(24 + i * 160, 188, 144, 100); });
    } else if (kind === 'app') {                                          // phone UI (drawn tall)
      c.width = 256; c.height = 512;
      g.fillStyle = '#F3F5F7'; g.fillRect(0, 0, 256, 512);
      g.fillStyle = HEX(C.navy); g.fillRect(0, 0, 256, 80); g.fillStyle = '#fff'; g.fillRect(20, 34, 110, 14);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#fff'; g.fillRect(14, 100 + i * 66, 228, 54); g.fillStyle = HEX([C.teal, C.copper, C.steel, C.sand, C.teal, C.copper][i]); g.fillRect(24, 112 + i * 66, 30, 30); g.fillStyle = '#9aa7b4'; g.fillRect(68, 114 + i * 66, 120, 9); g.fillRect(68, 130 + i * 66, 80, 9); }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (texCache[kind] = t);
  }

  const roundedRect = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const slabOf = (w, h, r, depth) => { const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 5 }); g.center(); return g; };
  const screen = (w, h, tex, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat(0xffffff, { map: tex })); m.position.z = z; return m; };

  // A bar between two points (box or cylinder), used for brackets, git lines, etc.
  const _up = new THREE.Vector3(0, 1, 0);
  function bar(a, b, thick, color, round = false) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const m = new THREE.Mesh(round ? new THREE.CylinderGeometry(thick / 2, thick / 2, len, 10) : new THREE.BoxGeometry(thick, len, thick), mat(color));
    m.position.copy(A.add(B).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(_up, d.normalize());
    return m;
  }
  // Scale a prop so its largest side == size, centred on its own origin.
  const _box = new THREE.Box3(), _sz = new THREE.Vector3(), _ct = new THREE.Vector3();
  function fit(obj, size) {
    _box.setFromObject(obj); _box.getSize(_sz); _box.getCenter(_ct);
    obj.position.sub(_ct);
    const w = new THREE.Group(); w.add(obj);
    w.scale.setScalar(size / Math.max(_sz.x, _sz.y, _sz.z));
    return w;
  }

  const PROPS = {
    laptop() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 2), mat(C.navy)));
      const keys = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.15), mat(0x1a2b40)); keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.052, -0.2); g.add(keys);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), mat(0x2c4259)); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.053, 0.62); g.add(pad);
      const lid = new THREE.Group(); lid.position.set(0, 0.05, -1); lid.rotation.x = -0.3; g.add(lid);
      const shell = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.08), mat(C.navy)); shell.position.y = 1; lid.add(shell);
      const scr = screen(2.78, 1.78, screenTex('code'), 0.045); scr.position.y = 1; lid.add(scr);
      return g;
    },
    chip() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.14, 1), mat(C.navy)));
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), mat(C.steel)); die.position.y = 0.09; g.add(die);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), flat(C.teal)); led.position.set(-0.36, 0.08, -0.36); g.add(led);
      const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.04, 0.06), mat(C.mist), 32), d = new THREE.Object3D();
      let k = 0;
      for (let s = 0; s < 4; s++) for (let i = 0; i < 8; i++) {
        d.rotation.set(0, s * Math.PI / 2, 0);
        d.position.set(0.55, 0, -0.4 + i * 0.115).applyAxisAngle(_up, s * Math.PI / 2);
        d.updateMatrix(); pins.setMatrixAt(k++, d.matrix);
      }
      g.add(pins);
      return g;
    },
    database() {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const y = i * 0.4;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 32), mat(i === 1 ? C.steel : C.navy)); body.position.y = y; g.add(body);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.615, 0.615, 0.04, 32), flat(i === 1 ? C.copper : C.teal)); ring.position.y = y + 0.04; g.add(ring);
      }
      return g;
    },
    server() {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const y = i * 0.4;
        const u = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 1), mat(i === 1 ? C.steel : C.navy)); u.position.y = y; g.add(u);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.02), flat(C.mist)); slot.position.set(-0.25, y, 0.51); g.add(slot);
        [0, 1].forEach((j) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), flat(j ? C.copper : C.teal)); l.position.set(0.5 + j * 0.15, y, 0.51); g.add(l); });
      }
      return g;
    },
    phone() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(slabOf(0.78, 1.5, 0.14, 0.07), mat(C.navy)));
      g.add(screen(0.66, 1.32, screenTex('app'), 0.075));
      return g;
    },
    terminal() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(slabOf(1.8, 1.15, 0.08, 0.08), mat(C.navy)));
      g.add(screen(1.7, 1.06, screenTex('terminal'), 0.08));
      return g;
    },
    browser() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(slabOf(1.8, 1.2, 0.08, 0.08), mat(C.steel)));
      g.add(screen(1.7, 1.1, screenTex('browser'), 0.08));
      return g;
    },
    gear() {
      const g = new THREE.Group(), sh = new THREE.Shape(), T = 10, ri = 0.5, ro = 0.67, st = Math.PI * 2 / T;
      for (let i = 0; i < T; i++) {
        const a = i * st;
        [[ri, a], [ro, a + 0.12 * st], [ro, a + 0.38 * st], [ri, a + 0.5 * st]].forEach(([r, an], k) => {
          const x = Math.cos(an) * r, y = Math.sin(an) * r;
          if (i === 0 && k === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
        });
      }
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.2, 0, Math.PI * 2, true); sh.holes.push(hole);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }), mat(C.copper)); m.position.z = -0.1; g.add(m);
      return g;
    },
    brackets() {                                              // </>
      const g = new THREE.Group(), t = 0.15;
      g.add(bar([-0.55, 0.42, 0], [-1.05, 0, 0], t, C.teal), bar([-1.05, 0, 0], [-0.55, -0.42, 0], t, C.teal));
      g.add(bar([0.55, 0.42, 0], [1.05, 0, 0], t, C.teal), bar([1.05, 0, 0], [0.55, -0.42, 0], t, C.teal));
      g.add(bar([0.2, 0.55, 0], [-0.2, -0.55, 0], t, C.copper));
      return g;
    },
    braces() {                                                // { }
      const g = new THREE.Group();
      const curly = (s) => new THREE.CatmullRomCurve3([[0.18, 0.6], [0.02, 0.5], [0, 0.18], [-0.14, 0], [0, -0.18], [0.02, -0.5], [0.18, -0.6]].map(([x, y]) => new THREE.Vector3(x * s, y, 0)));
      const a = new THREE.Mesh(new THREE.TubeGeometry(curly(1), 24, 0.065, 8), mat(C.copper)); a.position.x = -0.5;
      const b = new THREE.Mesh(new THREE.TubeGeometry(curly(-1), 24, 0.065, 8), mat(C.copper)); b.position.x = 0.5;
      g.add(a, b);
      return g;
    },
    branch() {                                                // git graph
      const g = new THREE.Group();
      const node = (x, y, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(col)); m.position.set(x, y, 0); g.add(m); };
      g.add(bar([0, -0.8, 0], [0, 0.8, 0], 0.07, C.steel, true), bar([0, -0.1, 0], [0.6, 0.35, 0], 0.07, C.steel, true), bar([0.6, 0.35, 0], [0.6, 0.8, 0], 0.07, C.steel, true), bar([0.6, 0.8, 0], [0, 0.8, 0], 0.07, C.steel, true));
      node(0, -0.8, C.navy); node(0, -0.1, C.teal); node(0, 0.8, C.navy); node(0.6, 0.35, C.copper); node(0.6, 0.8, C.copper);
      return g;
    },
    network() {                                               // tiny neural net
      const g = new THREE.Group(), layers = [3, 4, 3], pos = [];
      layers.forEach((n, l) => { for (let i = 0; i < n; i++) pos.push([(l - 1) * 0.9, (i - (n - 1) / 2) * 0.5, 0, l]); });
      const verts = [];
      pos.forEach((a) => pos.forEach((b) => { if (b[3] === a[3] + 1) verts.push(a[0], a[1], 0, b[0], b[1], 0); }));
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: C.navy, transparent: true, opacity: 0.45 }));
      lines.raycast = () => {};
      g.add(lines);
      const ng = new THREE.SphereGeometry(0.11, 14, 10);
      pos.forEach(([x, y, , l]) => { const m = new THREE.Mesh(ng, mat([C.teal, C.copper, C.steel][l])); m.position.set(x, y, 0); g.add(m); });
      return g;
    },
  };
  const tag = (obj, data) => obj.traverse((o) => { if (o.isMesh) o.userData = data; });

  /* ═══ HERO: a laptop running code, with dev props orbiting it ═══════════ */
  const hero = place(new THREE.Group(), HERO);
  const laptop = fit(PROPS.laptop(), 3.1);
  laptop.position.y = -0.3;
  const laptopPivot = new THREE.Group(); laptopPivot.add(laptop); hero.add(laptopPivot);

  const sats = [];
  [['brackets', 0.9, 2.6, 0.45, 0.2], ['chip', 0.8, 2.5, -0.4, 1.7], ['gear', 0.85, 2.4, 0.6, 3.1], ['branch', 0.9, 2.6, -0.5, 4.4], ['braces', 0.8, 2.3, 0.35, 5.5]]
    .forEach(([name, size, radius, speed, phase]) => {
      const holder = new THREE.Group(); holder.add(fit(PROPS[name](), size)); hero.add(holder);
      sats.push({ m: holder, radius, speed, phase });
    });

  /* ═══ ABOUT: scattered points snap into a data cube (voxel lattice) ═════ */
  const about = place(new THREE.Group(), ABOUT);
  const n3 = lite ? 8 : 12, PN = n3 * n3 * n3;
  const scatter = new Float32Array(PN * 3), lattice = new Float32Array(PN * 3), partPos = new Float32Array(PN * 3), partCol = new Float32Array(PN * 3);
  {
    const tmp = new THREE.Color(), sp = 4.2 / (n3 - 1);
    let i = 0;
    for (let x = 0; x < n3; x++) for (let y = 0; y < n3; y++) for (let z = 0; z < n3; z++, i++) {
      const r = 4 + Math.random() * 5, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      scatter.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
      lattice.set([(x - (n3 - 1) / 2) * sp, (y - (n3 - 1) / 2) * sp, (z - (n3 - 1) / 2) * sp], i * 3);
      tmp.setHex(PARTICLE_COLORS[(x + y + z) % PARTICLE_COLORS.length]);
      partCol.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    partPos.set(scatter);
  }
  const dot = (() => {                              // little square "bit" sprite, drawn once
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(6, 6, 20, 20);
    return new THREE.CanvasTexture(c);
  })();
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
  const pMat = new THREE.PointsMaterial({ size: lite ? 0.22 : 0.17, map: dot, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  about.add(points);

  /* ═══ SKILLS: a CPU core with 6 tech props orbiting (1 per skill group) ═ */
  const skills = place(new THREE.Group(), SKILLS);
  const core = fit(PROPS.chip(), 1.15);
  skills.add(core);
  const orbit = new THREE.Group();
  orbit.rotation.x = 0.28;
  skills.add(orbit);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0.18 }));
  ring.rotation.x = Math.PI / 2;
  orbit.add(ring);
  // Order matches the .skill cards in index.html (data-orb 0…5).
  const SKILL_PROPS = ['phone', 'server', 'network', 'terminal', 'database', 'browser'];
  const orbs = [];
  SKILL_PROPS.forEach((name, i) => {
    const a = (i / 6) * Math.PI * 2, rad = 2.4;
    const holder = new THREE.Group();                      // holder = hover-scaled
    holder.add(fit(PROPS[name](), 0.95));
    holder.position.set(Math.cos(a) * rad, Math.sin(a * 2) * 0.3, Math.sin(a) * rad);
    tag(holder, { kind: 'orb', index: i, label: orbLabels[i] || '' });
    orbit.add(holder);
    orbs.push({ m: holder, s: 1 });
  });

  /* ═══ PROJECTS: floating slabs with a tech prop (or the project's image) ═ */
  const slabGeo = slabOf(3.3, 2.2, 0.16, 0.16);            // shared by all cards
  const cards = [];
  projects.forEach((pr, p) => {
    const g = place(new THREE.Group(), PROJ0 + p);
    const slab = new THREE.Mesh(slabGeo, mat(C[pr.color] ?? C.steel));
    slab.userData = { kind: 'project', index: p, url: pr.url };
    g.add(slab);

    const motif = fit((PROPS[pr.motif] || PROPS.chip)(), pr.image ? 0.85 : 1.7);
    if (pr.image) {
      // White inset + the project's image, shown contained (aspect-correct).
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.75), new THREE.MeshBasicMaterial({ color: C.white }));
      paper.position.z = 0.125; g.add(paper);
      anyTexture = true;
      texLoader.load(pr.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const ar = tex.image.width / tex.image.height, bw = 2.7, bh = 1.65;
        const w = ar > bw / bh ? bw : bh * ar, h = ar > bw / bh ? bw / ar : bh;
        const img = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        img.position.z = 0.13; g.add(img);
      });
      motif.position.set(1.45, -0.95, 0.6);
    } else {
      motif.position.set(0, 0, 0.9);
    }
    motif.userData.baseY = motif.position.y;
    g.add(motif);
    cards.push({ group: g, slab, motif, hover: 0 });
  });

  /* ═══ EXPERIENCE: a "git history" with 5 commits that light up ═════════ */
  const exp = place(new THREE.Group(), EXP);
  exp.scale.setScalar(0.7);
  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -3.4, 0), new THREE.Vector3(-0.9, -1.9, 0.4), new THREE.Vector3(0.8, -0.5, -0.2),
    new THREE.Vector3(-0.7, 0.9, 0.4), new THREE.Vector3(0.6, 2.2, -0.2), new THREE.Vector3(0, 3.5, 0),
  ]);
  exp.add(new THREE.Mesh(new THREE.TubeGeometry(ribbonCurve, 90, 0.07, 8), mat(C.steel)));
  const mileGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const unlit = new THREE.Color(C.mist), lit = new THREE.Color(C.teal);
  const miles = [];
  for (let i = 0; i < 5; i++) {
    // Item 0 (oldest) at the TOP, to match the HTML timeline order.
    const m = new THREE.Mesh(mileGeo, mat(C.mist, { emissive: C.teal, emissiveIntensity: 0 }));
    m.position.copy(ribbonCurve.getPoint(1 - (i + 0.5) / 5));
    m.rotation.set(0.5, 0.7, 0);
    exp.add(m);
    miles.push({ m, v: 0, target: 0 });
  }

  /* ═══ CONTACT: a wireframe globe (the network) + the whole trip as a line ═ */
  const contact = place(new THREE.Group(), CONTACT);
  const globeGeo = new THREE.IcosahedronGeometry(2, 2);
  const globe = new THREE.Group();
  globe.add(new THREE.Mesh(globeGeo, mat(C.mist, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  globe.add(new THREE.LineSegments(new THREE.EdgesGeometry(globeGeo), new THREE.LineBasicMaterial({ color: C.navy, transparent: true, opacity: 0.55 })));
  contact.add(globe);
  const cSat = [['chip', 0.7, 3, 0], ['brackets', 0.9, 3.4, 2.1], ['gear', 0.7, 3.2, 4.2]].map(([name, size, radius, phase]) => {
    const h = new THREE.Group(); h.add(fit(PROPS[name](), size)); contact.add(h); return { h, radius, phase };
  });
  // The trail of the whole trip; mostly invisible up close, the star of the pull-back shot.
  const trail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(anchors), N * 24, 0.09, 6),
    new THREE.MeshBasicMaterial({ color: C.steel, fog: false, transparent: true, opacity: 0 })
  );
  trail.visible = false;
  scene.add(trail);

  /* ═══ Scatter of tiny cubes ("bits") along the corridor. One draw call. ═ */
  {
    const cnt = lite ? 28 : 70;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat(0xffffff), cnt);
    const d = new THREE.Object3D(), col = new THREE.Color();
    for (let i = 0; i < cnt; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      d.position.set(side * (5 + Math.random() * 9), (Math.random() - 0.5) * 12, 6 - Math.random() * (N * STEP + 10));
      d.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      d.scale.setScalar(0.5 + Math.random() * 1.1);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, col.setHex(PARTICLE_COLORS[i % PARTICLE_COLORS.length]));
    }
    scene.add(im);
  }

  /* ── Camera curves ────────────────────────────────────────────────── */
  let portrait = false, camCurve, lookCurve;
  function offsetFor(i) {
    // Where the stop's object should appear on screen relative to the centre,
    // in world units at that depth. Desktop: left/right. Phone: above centre.
    let ox = 0, oy = 0;
    const side = (i >= PROJ0 && i < EXP) ? ((i - PROJ0) % 2 === 0 ? 1 : -1)   // HTML alternates; object takes the other side
      : (i === EXP) ? -1
      : (i === CONTACT) ? 0 : 1;
    if (portrait) oy = i === CONTACT ? 0 : i === HERO ? 4.1 : 2.0;
    else ox = side * (i === SKILLS ? 2.2 : i === HERO ? 2.6 : 3.0);
    return [ox, oy];
  }
  function buildCurves() {
    const D = portrait ? 12.5 : 9.5;
    const cam = [], look = [];
    for (let i = 0; i < N; i++) {
      const a = anchors[i], [ox, oy] = offsetFor(i);
      cam.push(new THREE.Vector3(a.x, a.y + 0.4, a.z + D));
      look.push(new THREE.Vector3(a.x - ox, a.y - oy, a.z));
    }
    // Last stop: pull way back and up to see the whole trail.
    const midZ = anchors[N - 1].z / 2;
    cam[N - 1].set(30, 50, 24);
    look[N - 1].set(-6, -4, midZ);
    camCurve = new THREE.CatmullRomCurve3(cam, false, 'catmullrom', 0.5);
    lookCurve = new THREE.CatmullRomCurve3(look, false, 'catmullrom', 0.5);
  }

  /* ── State ────────────────────────────────────────────────────────── */
  let fTarget = 0, fs = 0;                // fs = smoothed fractional stop index
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, moved: false, clientX: 0, clientY: 0, enabled: true };
  const ray = new THREE.Raycaster();
  let hovered = null;                     // { kind, index }
  let forcedOrb = -1, forcedProject = -1; // hover coming from the HTML side
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  const clock = new THREE.Clock();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.85 ? 46 : 40;     // a little wider on phones
    camera.updateProjectionMatrix();
    const nowPortrait = w / h < 0.85;
    if (nowPortrait !== portrait || !camCurve) { portrait = nowPortrait; buildCurves(); }
    hero.scale.setScalar(portrait ? 0.78 : 1);      // smaller hero on phones so it fits above the text
  }
  resize();

  /* ── Hover / pick ─────────────────────────────────────────────────── */
  function pick() {
    const inSkills = Math.abs(fs - SKILLS) < 1.1, inProj = fs > PROJ0 - 1.1 && fs < EXP - 0.1;
    let hit = null;
    if (pointer.enabled && (inSkills || inProj)) {
      ray.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
      const list = [];
      if (inSkills) orbs.forEach((o) => list.push(o.m));
      if (inProj) cards.forEach((c) => list.push(c.slab));
      const hits = ray.intersectObjects(list, true);
      if (hits.length) hit = hits[0].object.userData;
    }
    hovered = hit && hit.kind ? { kind: hit.kind, index: hit.index } : null;
    onHover && onHover(hovered && { ...hovered, label: hit.label, url: hit.url, x: pointer.clientX, y: pointer.clientY });
  }

  /* ── Per-frame update ─────────────────────────────────────────────── */
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

    // Ease toward the scroll target. Lenis already smooths scroll; this adds a
    // soft "camera has weight" feel and hides small jumps.
    fs += (fTarget - fs) * (1 - Math.exp(-dt * 6));
    const u = clamp(fs / (N - 1), 0, 1);
    const overview = smooth(N - 1.9, N - 1, fs);               // 0→1 during the final pull-back

    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 5));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 5));

    camCurve.getPoint(u, pos); lookCurve.getPoint(u, tgt);
    const par = 1 - overview;                                  // no parallax in the calm overview
    pos.x += pointer.sx * 0.45 * par; pos.y += pointer.sy * 0.3 * par;
    camera.position.copy(pos);
    camera.lookAt(tgt);

    // Fog thins out so the pull-back reveals the whole trail.
    scene.fog.density = FOG_NEAR + (0.0016 - FOG_NEAR) * overview;
    // The trail only fades in for the final pull-back (up close it would sit right beside the camera).
    trail.visible = overview > 0.02;
    trail.material.opacity = overview * 0.9;

    const calm = 1 - overview * 0.7;

    /* hero: laptop tilts toward the pointer; props orbit it */
    if (fs < 1.8) {
      laptopPivot.rotation.y += (pointer.sx * 0.55 + Math.sin(t * 0.35) * 0.18 - laptopPivot.rotation.y) * 0.06;
      laptopPivot.rotation.x += (-pointer.sy * 0.25 - laptopPivot.rotation.x) * 0.06;
      laptopPivot.position.y = Math.sin(t * 0.8) * 0.08;
      sats.forEach((s) => {
        const ang = t * s.speed * 0.6 + s.phase;
        // wide, tall ellipse so props circle around the laptop instead of crossing its screen
        s.m.position.set(0.3 + Math.cos(ang) * s.radius, Math.sin(ang) * 1.85 + 0.2, Math.sin(ang * 0.7) * 0.6 - 0.3);
        s.m.rotation.y += dt * 0.5; s.m.rotation.x = Math.sin(t * 0.5 + s.phase) * 0.3;
      });
    }

    /* about: scatter → lattice cube as f goes 0.45 → 1.05 (reverses when scrolling up) */
    const m = smooth(0.45, 1.05, fs);
    pMat.opacity = smooth(0.1, 0.7, fs) * (1 - smooth(1.5, 2.1, fs)) * 0.95;
    if (pMat.opacity > 0.01) {
      for (let i = 0; i < PN * 3; i++) partPos[i] = scatter[i] + (lattice[i] - scatter[i]) * m;
      pGeo.attributes.position.needsUpdate = true;
      points.rotation.y = t * 0.15;
      points.rotation.x = 0.35 + Math.sin(t * 0.2) * 0.1;
    }

    /* skills: scroll spins the orbit, hover grows a prop */
    if (Math.abs(fs - SKILLS) < 1.6) {
      orbit.rotation.y = fs * 1.7 + t * 0.12 * calm;
      core.rotation.y = t * 0.5; core.rotation.x = 0.6;
      const active = forcedOrb >= 0 ? forcedOrb : (hovered && hovered.kind === 'orb' ? hovered.index : -1);
      orbs.forEach((o, i) => {
        o.s += ((i === active ? 1.45 : 1) - o.s) * 0.14;
        o.m.scale.setScalar(o.s);
        o.m.rotation.y = -orbit.rotation.y;                     // keep faces toward the viewer
      });
    }

    /* projects: float, face the middle, tilt on hover */
    for (let p = 0; p < cards.length; p++) {
      const c = cards[p], idx = PROJ0 + p;
      if (Math.abs(fs - idx) > 1.6) continue;
      const isHover = forcedProject === p || (hovered && hovered.kind === 'project' && hovered.index === p);
      c.hover += ((isHover ? 1 : 0) - c.hover) * 0.12;
      const sideSign = (p % 2 === 0) ? 1 : -1;                  // object appears right when p even
      const base = portrait ? 0 : -sideSign * 0.32;
      c.group.position.y = anchors[idx].y + Math.sin(t * 0.8 + p) * 0.12 * calm;
      c.group.rotation.y += (base + c.hover * pointer.sx * 0.5 - c.group.rotation.y) * 0.1;
      c.group.rotation.x += (c.hover * -pointer.sy * 0.35 - c.group.rotation.x) * 0.1;
      c.group.scale.setScalar(1 + c.hover * 0.07);
      c.motif.rotation.y = Math.sin(t * 0.7 + p) * 0.6;          // gentle swivel so screens stay readable
      c.motif.position.y = c.motif.userData.baseY + Math.sin(t * 1.2 + p) * 0.06 * calm;
    }

    /* experience: commits glow */
    miles.forEach((ml) => {
      ml.v += (ml.target - ml.v) * 0.08;
      ml.m.material.color.copy(unlit).lerp(lit, ml.v);
      ml.m.material.emissiveIntensity = ml.v * 0.45;
      ml.m.scale.setScalar(1 + ml.v * 0.35);
      ml.m.rotation.y += dt * 0.3;
    });

    /* contact: slow turn */
    if (fs > CONTACT - 1.5) {
      globe.rotation.y = t * 0.12; globe.rotation.x = 0.3;
      cSat.forEach((s, i) => { const a = t * 0.25 + s.phase; s.h.position.set(Math.cos(a) * s.radius, Math.sin(a * 1.4) * 0.8, Math.sin(a) * s.radius * 0.6); s.h.rotation.y = t * 0.4 + i; });
    }

    if (pointer.moved) { pick(); pointer.moved = false; }
    renderer.render(scene, camera);
  }

  // Compile shaders now so the first scroll doesn't stutter.
  renderer.compile(scene, camera);
  if (!anyTexture) onProgress && onProgress(1);
  await loaded.catch(() => {});

  return {
    frame, resize,
    setScroll(f) { fTarget = clamp(f, 0, N - 1); },
    jump(f) { fTarget = fs = clamp(f, 0, N - 1); },
    setPointer(nx, ny, cx, cy) { pointer.x = nx; pointer.y = ny; pointer.clientX = cx; pointer.clientY = cy; pointer.moved = true; },
    setPointerEnabled(v) { pointer.enabled = v; if (!v) pointer.moved = true; },
    setMilestones(count) { miles.forEach((m, i) => { m.target = i < count ? 1 : 0; }); },
    hoverOrb(i) { forcedOrb = i; },
    hoverProject(i) { forcedProject = i; },
    stopCount: N,
  };
}

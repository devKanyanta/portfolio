# Mapalo Kanyanta — Portfolio ("Concrete & Steel")

A scroll-driven 3D portfolio in a clean, engineered look: cool concrete greys, navy, steel, teal and copper, with a faint blueprint grid and mono labels. Every 3D object is a dev prop (laptop running code, CPU chip, server, database, phone, terminal, browser, gear, `</>`, git branch, neural net). As you scroll, the camera
travels along one continuous path through the scene. Each section of the site is a
"stop" along the way. Plain HTML, CSS and JavaScript. **There is no build step**, so it
deploys straight to GitHub Pages.

## Run locally

ES modules and import maps need a web server (opening `index.html` from disk won't work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

Push to `main`. Pages serves the repo root, and `CNAME` keeps `devkanyanta.me`.
Everything the site needs, including Three.js, GSAP and Lenis, is in `vendor/`, so there
are no runtime CDN dependencies apart from Google Fonts.

## Folder structure

```
index.html          All content (real HTML text), SEO tags, import map
css/styles.css      Design tokens (colours, fonts) + layout + responsive rules
js/main.js          Boot, loader, Lenis, scroll → camera mapping, reveals, nav, form
js/scene.js         The Three.js world: camera path, objects, hover picking
vendor/             three.js r160, GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.13 (local copies)
images/             Project screenshots/logos, portrait, og.jpg (social share image)
```

## How the scroll journey works

1. `main.js` turns the scroll position into one number, `f`: the fractional **stop index**
   (0 = hero, 1 = about, 2.5 = halfway between skills and the first project…).
   Each stop holds the camera while its section is on screen, then eases to the next.
2. `scene.js` samples two CatmullRom splines (camera position and look-at target) at
   `f / (stops - 1)`. The camera is a pure function of `f`, so scrolling up reverses
   everything exactly.
3. To place a 3D object on one side of the screen while the text sits on the other, the
   camera is aimed slightly past the object (`offsetFor()` in `scene.js`).

## Add a new project

Copy any `<article class="project stop" data-stop …>` block in `index.html` and edit it.
No JavaScript changes are needed. The 3D scene reads the `data-*` attributes:

| Attribute | Meaning |
|---|---|
| `data-motif` | Tech prop on the 3D card: `server` `database` `network` `chip` `phone` `browser` `terminal` `gear` `brackets` `braces` `branch` `laptop` |
| `data-color` | Card colour: `navy` `steel` `mist` `teal` `sand` `copper` |
| `data-image` | *(optional)* image shown on the 3D card; also add an `<img>` inside the HTML card |
| `data-url` | Where clicking the 3D card goes |

The new project automatically gets its own stop on the camera path. Sides alternate
left/right by order. Put new images in `images/` and keep them small (under ~100 KB).

## Skills and experience

* **Skills:** each `<li class="skill" data-orb="N">` pairs with the Nth prop in the 3D orbit
  (`SKILL_PROPS` in `scene.js`: phone, server, network, terminal, database, browser).
  The scene has 6, so keep 6 groups or extend that list.
* **Experience:** each `.tl-item` lights its 3D milestone as it scrolls past. The scene has 5
  milestones; to add a 6th, change `5` to `6` in the milestone loop in `scene.js`.

## Performance

* Procedural low-poly geometry only (props are built from primitives; screens are drawn on tiny canvases): no model downloads. Shared geometries, instancing for
  scatter shapes, and 2 lights plus a hemisphere/ambient light.
* Pixel ratio capped (1.75 desktop, 1.25 on weak or small touch devices).
* **Lite mode** (phones, ≤4 CPU cores, ≤4 GB RAM, Save-Data): 512 instead of 1,728 data-cube points,
  Lambert instead of Standard materials, lower-poly spheres, no anti-aliasing.
* Three.js is loaded lazily with `import()` after the page has painted.
* No post-processing.

## Accessibility and fallbacks

* All content is real HTML. The canvas is `aria-hidden`. Skip link, visible focus, keyboard-navigable.
* `prefers-reduced-motion`, no WebGL, a lost WebGL context, or any startup error → **static
  mode**: same content over a pastel gradient with simple fade-ins.
* Responsive: on phones the 3D object sits in the top half and the text card in the bottom
  half, with the camera pulled back.

## Notes

* To re-theme, change the tokens at the top of `css/styles.css` and the palette `C` at the top of `js/scene.js`.
* The `images/me.jpg`, `desac.jpg` and `content-creation.png` originals are no longer used
  by the page (smaller `*-720` / `*-640` copies are). You can delete them to slim the repo.
* The contact form still posts to your existing Formspree endpoint.

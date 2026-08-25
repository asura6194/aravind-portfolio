# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server (port 5173, configured in `vite.config.ts`).
- `npm run build` — type-checks with `tsc` (no emit) and then runs `vite build`. The `tsc` step uses `strict`, `noUnusedLocals`, and `noUnusedParameters`, so an unused import/variable fails the build, not just `tsc --noEmit` in isolation.
- `npm run preview` — serve the built `dist/` output locally.
- There is no lint script and no test runner configured in `package.json`/devDependencies.

## Architecture

This is a vanilla TypeScript + Vite single-page site (no frontend framework). `index.html` holds the real DOM structure (header/nav, hero, `#page-body` sections, footer); `src/main.ts` is the only entry point and wires everything up imperatively via `querySelector`.

**Boot sequence in `src/main.ts`:** `renderPage()` (fills in DOM text/lists from static data) and `setupNav()` (mobile nav toggle) run immediately. Everything else — `setupMotion()` (GSAP/ScrollTrigger reveal-on-scroll for `[data-animate]` sections) and the dust-particle background scene — is deferred inside a `bootPage()` callback that only runs after `setupLoadingScreen()` resolves. The real page content sits in the DOM the whole time but is hidden via the `is-loading` class (see `index.html`'s inline `<style>` block) until the loader finishes and removes that class.

**Content/rendering split:** `src/content.ts` is the single source of truth for profile, experience, education, and skills data (plain exported objects/arrays, no CMS). `src/ui/render.ts` reads that data and injects it into the static markup via `data-*` attribute selectors and manual `innerHTML` string templates (with its own `escapeHtml` helper — there's no templating library).

**Loading screen subsystem** (`src/ui/loadingScreen.ts`, `loaderWave.ts`, `hexLattice.ts`, `loadingScreenConfig.ts`) is the most complex part of the codebase — a multi-stage three.js/GSAP intro animation:
1. A hexagonal instanced-mesh floor is built and sized to the camera's worst-case visible footprint (`getWorstCaseGroundBounds` in `loadingScreen.ts`) so no grid edges are ever visible, including during the later FOV-widening dolly zoom.
2. `loaderWave.ts` drives a ring-by-ring "wave" that sweeps inward from the edge of the grid to the center hex (tiles bucketed by hex-ring distance via `hexLattice.ts`'s axial-coordinate math), each tile rising and glowing as the front passes over it.
3. Once the center hex lights up and flares, `loadingScreen.ts` takes over: a dolly-zoom push into the hex (distance and FOV are eased on deliberately different curves — see the comments around `DOLLY_DIST_EASE_POWER`/`DOLLY_FOV_EASE_POWER` — because widening FOV before distance has closed would reveal ground past the pre-built grid), then a colour wash, then a DOM-level "reveal" that re-parents the loader overlay above `<body>` and scales the real page down from the nav logo's "R" (see `.logo-r` in `index.html`) to its natural size, finally removing the loader and resolving the promise `main.ts` awaits.
4. Tunable parameters live in `src/ui/loadingScreenConfig.ts` (`LoaderParams`). A hidden debug panel (toggle `SHOW_DEBUG_PANEL` in `loadingScreen.ts`) exposes live sliders for these; its Save button POSTs to `/__save-loader-config`, a dev-only Vite middleware defined in `vite.config.ts` that rewrites `loadingScreenConfig.ts` on disk — this is how the animation gets tuned interactively during development.

**Background dust scene** (`src/scene/dustScene.ts`) is a separate, independent three.js instanced-mesh particle field rendered behind `#page-body` on the main page (not part of the loading screen). It has its own renderer/camera and lifecycle, gated by `canCreateWebGL()`, paused via `IntersectionObserver` when off-screen, and respects `prefers-reduced-motion`.

**Styling:** a single `src/styles/main.css` using CSS custom properties (`--text`, `--accent`, `--bg`, etc.) as the theming source of truth — component styles reference these rather than hardcoding colors.

**Deployment note:** `vite.config.ts` sets `base: "/aravind-portfolio/"` in production (GitHub Pages subpath), so asset URLs written directly in `index.html` (not resolved through Vite's JS import graph) must use the `%BASE_URL%` placeholder rather than root-relative paths.

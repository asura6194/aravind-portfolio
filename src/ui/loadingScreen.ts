import gsap from "gsap";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  type BufferGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  InstancedBufferAttribute,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { WAVE_COLOR, isOriginHex } from "./hexLattice";
import { createWaveSystem, type WaveSystem } from "./loaderWave";
import {
  loadingScreenConfig,
  type LoaderParams,
  type Vec3,
} from "./loadingScreenConfig";

/**
 * Loading screen — 3D hexagonal floor plus an inward hex-ring rise wave.
 */

const HEX_COLOR = 0x333333;
const FLOOR_COLOR = 0x111111;
const CLEAR_COLOR = 0x0a0a0a;
const TRENCH_EMISSIVE = 0xffffff;
/**
 * Dimmer than WAVE_COLOR on purpose: tiles rising with the wave should read
 * as lit grey, not full white, so only the centre hex itself reads as the
 * bright white flare once the front reaches it.
 */
const RING_GLOW_COLOR = 0x7a7a7a;
/** Tuning sliders are hidden once the loader's look is finalized; flip to debug again. */
const SHOW_DEBUG_PANEL = false;
/** Camera elevation drifts across this range while the wave sweeps inward. */
const ELEV_DRIFT_START = 40;
const ELEV_DRIFT_END = 60;
/**
 * Dolly zoom into the glowing centre hex once the flare fades: the camera
 * pushes toward it along the current viewing ray while the FOV widens for
 * the classic rush-forward warp, ending once the hex fills the frame.
 *
 * The FOV widening is deliberately back-loaded relative to the distance
 * closing (see DOLLY_FOV_EASE_POWER): a wide FOV multiplies how much ground
 * is visible at any given distance, so widening it early — while the camera
 * is still far away — briefly reveals ground well past the edge of the
 * pre-built grid. Keeping the FOV close to its start value until the camera
 * has mostly closed the distance keeps the visible footprint monotonically
 * shrinking instead of spiking mid-flight.
 */
const DOLLY_BASE_DURATION = 1.6;
const DOLLY_TARGET_FOV = 70;
const DOLLY_FILL_MARGIN = 0.92;
const DOLLY_DIST_EASE_POWER = 2;
const DOLLY_FOV_EASE_POWER = 6;
/**
 * Second push once the FOV-warp dolly zoom lands: FOV stays fixed here (only
 * distance keeps closing), so the footprint only keeps shrinking — no need
 * to re-check it against the grid bounds. This is what actually gets the
 * hex to dominate the frame; a smaller margin means a closer final distance.
 */
const PUNCH_FILL_MARGIN = 0.7;
const PUNCH_DURATION = 0.5;
/**
 * Reveal transition once the dolly zoom's colour wash covers the screen: the
 * real page (already sitting at natural size underneath the loader the whole
 * time) is punched through by a hexagon growing from screen centre — same
 * clip-path-hole technique as the theme toggle's wipe — until the hole
 * outgrows the viewport and the wash underneath it is gone.
 */
const REVEAL_DURATION = 1.4;
/**
 * Bloom strength is derived from the wave intensity rather than being its own
 * slider — both fed the same perceived brightness, so one knob now drives the
 * emissive ramp and the glow spill together.
 */
const BLOOM_PER_INTENSITY = 0.2;
function bloomStrengthFor(intensity: number): number {
  return Math.max(0, intensity) * BLOOM_PER_INTENSITY;
}

/** Extra hex radii past the screen edge so tiles aren't clipped at the frame. */
const VIEW_PAD_HEXES = 2;
const SQRT3 = Math.sqrt(3);
const LOOK_AT = new Vector3(0, 0, 0);

/**
 * SVG path for "full viewport rect, minus a hexagon hole of radius r at
 * (cx, cy)" — same hexagon shape as the theme toggle's wipe. Used with
 * `clip-path: path(evenodd, ...)`: evenodd cancels out the overlapping
 * hexagon, punching a see-through hole through whatever the path is applied
 * to.
 */
function hexHolePath(cx: number, cy: number, r: number, w: number, h: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  });
  return `M0 0 H${w} V${h} H0 Z M${pts.join(" L")} Z`;
}

/**
 * Hero image + webfonts are the only things the just-revealed page needs to
 * already look right — wait for them alongside the reveal animation so a
 * slow network can't finish the loader onto a half-rendered page.
 */
function waitForCriticalAssets(): Promise<void> {
  const heroImg = document.querySelector<HTMLImageElement>(".hero-bg");
  const imgReady =
    heroImg && !heroImg.complete
      ? new Promise<void>((res) => {
          heroImg.addEventListener("load", () => res(), { once: true });
          heroImg.addEventListener("error", () => res(), { once: true });
        })
      : Promise.resolve();
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  return Promise.all([imgReady, fontsReady]).then(() => undefined);
}

function cloneParams(source: LoaderParams): LoaderParams {
  return {
    ...source,
    topPos: [...source.topPos],
    leftPos: [...source.leftPos],
    rightPos: [...source.rightPos],
    backPos: [...source.backPos],
    frontPos: [...source.frontPos],
    waveWidth: source.waveWidth ?? 2,
    waveIntensity: source.waveIntensity ?? 2,
    waveSpeed: source.waveSpeed ?? 9,
    centerHexEdge: source.centerHexEdge ?? 1.29,
    dollySpeed: source.dollySpeed ?? 1,
  };
}

const params = cloneParams(loadingScreenConfig);

type SceneLights = {
  hemi: HemisphereLight;
  ambient: AmbientLight;
  top: DirectionalLight;
  left: DirectionalLight;
  right: DirectionalLight;
  back: DirectionalLight;
  front: DirectionalLight;
};

type FoundationScene = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  postFXPass: ShaderPass;
  hexMesh: InstancedMesh;
  hexMat: MeshPhysicalMaterial;
  hexUniforms: { time: { value: number }; idle: { value: number } };
  floor: Mesh;
  root: Group;
  lights: SceneLights;
  wave: WaveSystem;
  dispose: () => void;
};

/**
 * Static isometric hex-floor foundation for the portfolio loader.
 * Runs to completion uninterrupted — no click-to-skip or pause, so the
 * animation and the reveal it sets up always play in full.
 */
export function setupLoadingScreen(): Promise<void> {
  const assetsReady = waitForCriticalAssets();
  return new Promise((resolve) => {
    const overlay =
      document.querySelector<HTMLElement>("#loading-screen") ??
      document.createElement("div");
    overlay.id = "loading-screen";
    overlay.className = "loading-screen";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", "Loading");
    if (!overlay.parentElement) {
      document.body.prepend(overlay);
    }

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    overlay.replaceChildren(canvas);
    document.documentElement.classList.add("is-loading");
    document.body.classList.add("is-loading");
    overlay.style.background = "#050608";

    // Guarantees a perfectly uniform, edge-free frame once the dolly zoom
    // reaches the centre hex: 3D framing alone can't promise every pixel is
    // covered by the hex's silhouette, so this flat-colour layer fades in
    // over the tail of the push and finishes the job.
    const colorWashColor = `#${new Color(WAVE_COLOR).getHexString()}`;
    const colorWash = document.createElement("div");
    colorWash.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 1;
      background: ${colorWashColor};
      opacity: 0;
      pointer-events: none;
    `;
    overlay.appendChild(colorWash);

    let raf = 0;
    let foundation: FoundationScene | null = null;
    let removeListeners: (() => void) | null = null;
    let hexTimer = 0;
    let camTimer = 0;
    let elevTween: gsap.core.Tween | null = null;
    let dollyTween: gsap.core.Tween | null = null;
    let revealTween: gsap.core.Tween | null = null;

    const finish = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hexTimer);
      window.clearTimeout(camTimer);
      elevTween?.kill();
      dollyTween?.kill();
      revealTween?.kill();
      document.documentElement.style.overflow = "";
      document.body.style.pointerEvents = "";
      removeListeners?.();
      foundation?.dispose();
      foundation = null;
      overlay.remove();
      document.documentElement.classList.remove("is-loading");
      document.body.classList.remove("is-loading");
      resolve();
    };

    const onWavePlayStart = (durationSeconds: number) => {
      elevTween?.kill();
      const proxy = { elev: ELEV_DRIFT_START };
      elevTween = gsap.to(proxy, {
        elev: ELEV_DRIFT_END,
        duration: durationSeconds,
        ease: "sine.inOut",
        onUpdate: () => {
          if (!foundation) return;
          params.camElevation = proxy.elev;
          placeIsometricCamera(
            foundation.camera,
            Math.max(1, window.innerWidth),
            Math.max(1, window.innerHeight),
          );
        },
      });
    };

    const startReveal = () => {
      cancelAnimationFrame(raf);
      revealTween?.kill();

      // Re-parent the loader above <body> so it keeps covering the page
      // until the expanding hexagon hole has eaten through it.
      document.documentElement.appendChild(overlay);
      document.documentElement.classList.remove("is-loading");
      document.body.classList.remove("is-loading");
      // The is-loading class also gated scroll/pointer-events; removing it
      // reveals the real DOM at natural size, so re-lock both by hand until
      // the hole finishes growing — otherwise the page can be scrolled or
      // clicked mid-reveal.
      document.documentElement.style.overflow = "hidden";
      document.body.style.pointerEvents = "none";

      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const cx = w / 2;
      const cy = h / 2;
      const diagonal = Math.hypot(w, h);

      const proxy = { r: 0 };
      revealTween = gsap.to(proxy, {
        r: diagonal,
        duration: REVEAL_DURATION,
        ease: "power2.inOut",
        onUpdate: () => {
          overlay.style.clipPath = `path(evenodd, "${hexHolePath(cx, cy, proxy.r, w, h)}")`;
        },
        onComplete: () => {
          void assetsReady.then(finish);
        },
      });
    };

    const onFlareDone = () => {
      if (!foundation) return;
      elevTween?.kill();
      dollyTween?.kill();

      // Push straight down the current viewing ray while widening the FOV —
      // a dolly zoom — until the centre hex's world-space radius fills the
      // viewport at the new, much closer distance. The camera also swings
      // around the hex (azimuth) over the combined zoom-in, split between
      // this stage and the punch-in below in proportion to their durations.
      //
      // placeIsometricCamera pads the distance by up to 8 units on wide
      // viewports to keep the intro shot framed on ultra-wide monitors — far
      // bigger than the sub-1-unit distances targeted below, so from here on
      // every render call skips that padding. distStart captures the actual
      // distance the camera was already sitting at (padding included) so the
      // switch doesn't cause a visible pop.
      const wideAspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
      const padAtStart = Math.max(0, wideAspect - 1) * 8;
      const hexRadius = Math.max(0.05, params.centerHexEdge - params.hexGap / SQRT3);
      const fovEndRad = (DOLLY_TARGET_FOV * Math.PI) / 180;
      const distEnd = Math.max(
        0.05,
        (hexRadius * DOLLY_FILL_MARGIN) / Math.tan(fovEndRad / 2),
      );

      const distStart = params.camDistance + padAtStart;
      const fovStart = params.camFov;
      const azimStart = params.camAzimuth;
      const azimEnd = azimStart + 180;
      const durationA = DOLLY_BASE_DURATION / Math.max(0.1, params.dollySpeed);
      const durationB = PUNCH_DURATION / Math.max(0.1, params.dollySpeed);
      const azimAtHandoff = azimStart + 180 * (durationA / (durationA + durationB));

      const proxy = { t: 0 };
      dollyTween = gsap.to(proxy, {
        t: 1,
        duration: durationA,
        ease: "none",
        onUpdate: () => {
          if (!foundation) return;
          const distT = proxy.t ** DOLLY_DIST_EASE_POWER;
          const fovT = proxy.t ** DOLLY_FOV_EASE_POWER;
          params.camDistance = distStart + (distEnd - distStart) * distT;
          params.camFov = fovStart + (DOLLY_TARGET_FOV - fovStart) * fovT;
          params.camAzimuth = azimStart + (azimAtHandoff - azimStart) * proxy.t;
          placeIsometricCamera(
            foundation.camera,
            Math.max(1, window.innerWidth),
            Math.max(1, window.innerHeight),
            true,
          );
        },
        onComplete: () => {
          startPunchIn(distEnd, azimAtHandoff, azimEnd);
        },
      });
    };

    const startPunchIn = (
      distFrom: number,
      azimFrom: number,
      azimTo: number,
    ) => {
      if (!foundation) return;

      // Continue straight in, FOV fixed, until the hex genuinely dominates
      // the frame. The colour wash now rides directly on this stage's own
      // progress — no separate pause-then-flash, it ramps in step with the
      // hex visibly taking over the viewport.
      const hexRadius = Math.max(0.05, params.centerHexEdge - params.hexGap / SQRT3);
      const fovRad = (params.camFov * Math.PI) / 180;
      const distTo = Math.max(
        0.05,
        (hexRadius * PUNCH_FILL_MARGIN) / Math.tan(fovRad / 2),
      );

      const proxy = { t: 0 };
      const duration = PUNCH_DURATION / Math.max(0.1, params.dollySpeed);
      dollyTween = gsap.to(proxy, {
        t: 1,
        duration,
        ease: "power2.in",
        onUpdate: () => {
          if (!foundation) return;
          params.camDistance = distFrom + (distTo - distFrom) * proxy.t;
          params.camAzimuth = azimFrom + (azimTo - azimFrom) * proxy.t;
          placeIsometricCamera(
            foundation.camera,
            Math.max(1, window.innerWidth),
            Math.max(1, window.innerHeight),
            true,
          );
          colorWash.style.opacity = String(proxy.t);
        },
        onComplete: () => {
          startReveal();
        },
      });
    };

    try {
      foundation = createFoundationScene(canvas, onWavePlayStart, onFlareDone);
      const panel = SHOW_DEBUG_PANEL
        ? mountDebugPanel(overlay, {
            onLights: () => {
              if (foundation) applyLights(foundation);
            },
            onCamera: () => {
              elevTween?.kill();
              window.clearTimeout(camTimer);
              camTimer = window.setTimeout(() => {
                if (foundation) applyCameraAndGrid(foundation, false);
              }, 70);
            },
            onHex: () => {
              window.clearTimeout(hexTimer);
              hexTimer = window.setTimeout(() => {
                if (foundation) applyCameraAndGrid(foundation, true);
              }, 40);
            },
            onWave: () => {
              foundation?.wave.applySettings();
            },
            onBloom: () => {
              if (foundation) applyBloom(foundation);
            },
            onDolly: () => {
              // Speed only affects the next post-flare push; nothing to
              // re-apply live.
            },
          })
        : null;

      const onResize = () => {
        if (!foundation) return;
        applyCameraAndGrid(foundation, false);
      };
      window.addEventListener("resize", onResize);

      removeListeners = () => {
        window.removeEventListener("resize", onResize);
        panel?.remove();
      };

      let lastFrame = performance.now();
      const tick = () => {
        if (!foundation) return;
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
        lastFrame = now;
        foundation.wave.update(dt);
        const nowS = now / 1000;
        // Reuses the colour wash's own 0..1 ramp (set during the punch-in
        // dolly) as the god-ray / chromatic-aberration drive — it's already
        // the exact signal for "bursting out of the centre hex".
        const burst = Number.parseFloat(colorWash.style.opacity) || 0;
        foundation.hexUniforms.time.value = nowS;
        foundation.postFXPass.uniforms.uTime.value = nowS;
        foundation.postFXPass.uniforms.uGodRay.value = burst;
        foundation.postFXPass.uniforms.uChroma.value = burst;
        foundation.composer.render();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      finish();
    }
  });
}

function createFoundationScene(
  canvas: HTMLCanvasElement,
  onWavePlayStart: (durationSeconds: number) => void,
  onFlareDone: () => void,
): FoundationScene {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  renderer.setClearColor(CLEAR_COLOR, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;
  renderer.shadowMap.enabled = false;

  const scene = new Scene();
  scene.background = new Color(CLEAR_COLOR);

  const root = new Group();
  scene.add(root);

  const camera = new PerspectiveCamera(params.camFov, width / height, 0.1, 500);
  const initialBounds = getWorstCaseGroundBounds(camera, width, height);

  const floorMat = new MeshStandardMaterial({
    color: FLOOR_COLOR,
    metalness: 0.05,
    roughness: 0.85,
    emissive: new Color(TRENCH_EMISSIVE),
    emissiveIntensity: 0.35,
  });
  const floor = new Mesh(new PlaneGeometry(2, 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  root.add(floor);

  const hexGeo = createHexBuildingGeometry();
  const hexMat = new MeshPhysicalMaterial({
    color: HEX_COLOR,
    metalness: 0.22,
    roughness: 0.6,
    envMapIntensity: params.envIntensity,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  });
  const hexUniforms = applyGlowShader(hexMat);

  const bounds = initialBounds;
  fitFloorToBounds(floor, bounds);
  const positions = buildHexPositions(bounds, camera);
  const tiles = positions.filter((p) => !isOriginHex(p, params.hexEdge));
  attachGlowAttribute(hexGeo, Math.max(1, tiles.length));
  const hexMesh = new InstancedMesh(
    hexGeo,
    hexMat,
    Math.max(1, tiles.length),
  );
  hexMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  populateHexInstances(hexMesh, tiles);
  root.add(hexMesh);

  // Centre hex keeps its own geometry so the Hex "Edge" slider only resizes
  // the surrounding grid.
  const centerGeo = createHexBuildingGeometry(params.centerHexEdge);
  // Idle shimmer only makes sense before the wave has anything to show —
  // fade it out the moment the real animation takes over.
  const handleWavePlayStart = (durationSeconds: number) => {
    onWavePlayStart(durationSeconds);
    gsap.to(hexUniforms.idle, { value: 0, duration: 0.6, ease: "power2.out" });
  };
  const wave = createWaveSystem(centerGeo, () => params, handleWavePlayStart, onFlareDone);
  root.add(wave.group);
  wave.rebuild(tiles, params.hexEdge, params.hexHeight, hexMesh);

  const pmrem = new PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  envScene.dispose();
  pmrem.dispose();

  const addDir = (color: number, intensity: number, pos: Vec3): DirectionalLight => {
    const light = new DirectionalLight(color, intensity);
    light.position.set(...pos);
    light.target.position.copy(LOOK_AT);
    scene.add(light.target);
    scene.add(light);
    return light;
  };

  const lights: SceneLights = {
    hemi: new HemisphereLight(0xd4dce6, 0x1a1e26, params.hemiIntensity),
    ambient: new AmbientLight(0xb8c2cc, params.ambientIntensity),
    top: addDir(0xf2f5f8, params.topIntensity, params.topPos),
    left: addDir(0xe4ebf2, params.leftIntensity, params.leftPos),
    right: addDir(0xe4ebf2, params.rightIntensity, params.rightPos),
    back: addDir(0xcdd6e0, params.backIntensity, params.backPos),
    front: addDir(0xc5d0dc, params.frontIntensity, params.frontPos),
  };
  scene.add(lights.hemi);
  scene.add(lights.ambient);

  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new Vector2(width, height),
    bloomStrengthFor(params.waveIntensity),
    params.bloomRadius,
    params.bloomThreshold,
  );
  composer.addPass(bloomPass);
  const postFXPass = new ShaderPass(createPostFXShader());
  postFXPass.uniforms.uResolution.value.set(width, height);
  composer.addPass(postFXPass);
  composer.addPass(new OutputPass());

  const dispose = () => {
    wave.dispose();
    hexMesh.geometry.dispose();
    hexMat.dispose();
    floor.geometry.dispose();
    floorMat.dispose();
    envMap.dispose();
    bloomPass.dispose();
    composer.dispose();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    composer,
    bloomPass,
    postFXPass,
    hexMesh,
    hexMat,
    hexUniforms,
    floor,
    root,
    lights,
    wave,
    dispose,
  };
}

function applyLights(sc: FoundationScene): void {
  sc.renderer.toneMappingExposure = params.exposure;
  sc.hexMat.envMapIntensity = params.envIntensity;
  sc.lights.hemi.intensity = params.hemiIntensity;
  sc.lights.ambient.intensity = params.ambientIntensity;
  setDir(sc.lights.top, params.topIntensity, params.topPos);
  setDir(sc.lights.left, params.leftIntensity, params.leftPos);
  setDir(sc.lights.right, params.rightIntensity, params.rightPos);
  setDir(sc.lights.back, params.backIntensity, params.backPos);
  setDir(sc.lights.front, params.frontIntensity, params.frontPos);
}

function applyBloom(sc: FoundationScene): void {
  sc.bloomPass.strength = bloomStrengthFor(params.waveIntensity);
  sc.bloomPass.radius = params.bloomRadius;
  sc.bloomPass.threshold = params.bloomThreshold;
}

function setDir(light: DirectionalLight, intensity: number, pos: Vec3): void {
  light.intensity = intensity;
  light.position.set(...pos);
}

function applyCameraAndGrid(sc: FoundationScene, rebuildGeometry: boolean): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  sc.renderer.setPixelRatio(dpr);
  sc.renderer.setSize(width, height, false);
  sc.composer.setPixelRatio(dpr);
  sc.composer.setSize(width, height);
  sc.postFXPass.uniforms.uResolution.value.set(width, height);

  const bounds = getWorstCaseGroundBounds(sc.camera, width, height);
  fitFloorToBounds(sc.floor, bounds);

  const old = sc.hexMesh;
  const mat = sc.hexMat;
  let geo = old.geometry;
  if (rebuildGeometry) {
    geo = createHexBuildingGeometry();
    old.geometry.dispose();
    // Centre hex is rebuilt from its own edge param, never the grid's.
    const oldCenter = sc.wave.centerMesh.geometry;
    sc.wave.centerMesh.geometry = createHexBuildingGeometry(params.centerHexEdge);
    oldCenter.dispose();
  }
  const positions = buildHexPositions(bounds, sc.camera);
  const tiles = positions.filter((p) => !isOriginHex(p, params.hexEdge));
  attachGlowAttribute(geo, Math.max(1, tiles.length));
  const next = new InstancedMesh(geo, mat, Math.max(1, tiles.length));
  next.instanceMatrix.setUsage(DynamicDrawUsage);
  populateHexInstances(next, tiles);
  sc.root.remove(old);
  sc.root.add(next);
  sc.hexMesh = next;
  sc.wave.rebuild(tiles, params.hexEdge, params.hexHeight, next);
}

function createHexBuildingGeometry(edge = params.hexEdge): ExtrudeGeometry {
  const r = Math.max(0.05, edge - params.hexGap / SQRT3);
  const shape = new Shape();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(0.02, params.hexHeight),
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

type GroundBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/**
 * Adds a per-instance `aGlow` float that drives emissive output, letting each
 * floor tile light up independently while sharing one draw call. Instance
 * colour would only tint the diffuse term, which reads as flat grey against
 * the dark palette and never reaches the bloom threshold.
 *
 * Also carries two extras on the same shader, since they're a few lines on
 * top of a patch that's already here: a view-angle fresnel rim (reuses
 * uGlowColor, no new tint to tune) and a per-instance idle shimmer driven by
 * uTime/uIdleStrength, which callers fade to 0 once the wave actually starts.
 */
function applyGlowShader(
  mat: MeshPhysicalMaterial,
): { time: { value: number }; idle: { value: number } } {
  // Mirrors the centre hex's own lit look: diffuse lerps toward the wave red
  // while emissive ramps up, both driven by the tile's 0..1 rise progress.
  const strength = { value: 0 };
  const time = { value: 0 };
  const idle = { value: 1 };
  mat.userData.glowStrength = strength;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = { value: new Color(RING_GLOW_COLOR) };
    shader.uniforms.uGlowStrength = strength;
    shader.uniforms.uTime = time;
    shader.uniforms.uIdleStrength = idle;
    shader.vertexShader =
      `attribute float aGlow;\nuniform float uTime;\nuniform float uIdleStrength;\nvarying float vGlow;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
	vGlow = aGlow;
	float idleSeed = dot( instanceMatrix[3].xz, vec2( 12.9898, 78.233 ) );
	float idleNoise = sin( idleSeed + uTime * 1.6 ) * 0.5 + 0.5;
	transformed.y += idleNoise * uIdleStrength * 0.12;`,
      );
    shader.fragmentShader = `uniform vec3 uGlowColor;\nuniform float uGlowStrength;\nvarying float vGlow;\n${shader.fragmentShader}`
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, uGlowColor, clamp( vGlow, 0.0, 1.0 ) );",
      )
      .replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\n\tfloat vFresnel = pow( 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 ), 2.2 );",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uGlowColor * ( vGlow * uGlowStrength );\n\ttotalEmissiveRadiance += uGlowColor * vFresnel * 0.8;",
      );
  };
  mat.customProgramCacheKey = () => "loader-hex-glow";
  return { time, idle };
}

/**
 * Single combined post pass: chromatic aberration + radial god-rays (both
 * driven by `uChroma`/`uGodRay`, ramped from the punch-in's own colour-wash
 * progress — see tick()), plus an always-on vignette and film grain. One
 * ShaderPass instead of four, since they're all one texture-in/texture-out
 * pixel shader anyway.
 */
function createPostFXShader(): {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
} {
  return {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uGodRay: { value: 0 },
      uChroma: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uGodRay;
      uniform float uChroma;
      uniform vec2 uResolution;
      varying vec2 vUv;

      float grainHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 uv = vUv;
        vec2 toCenter = uv - 0.5;
        float dist = length(toCenter);
        vec2 dir = toCenter / max(dist, 1e-4);

        float caAmount = uChroma * 0.018;
        vec3 color = vec3(
          texture2D(tDiffuse, uv - dir * caAmount).r,
          texture2D(tDiffuse, uv).g,
          texture2D(tDiffuse, uv + dir * caAmount).b
        );

        if (uGodRay > 0.001) {
          vec3 rays = vec3(0.0);
          vec2 step = -toCenter * 0.12;
          vec2 samplePos = uv;
          float weight = 1.0;
          for (int i = 0; i < 8; i += 1) {
            samplePos += step;
            rays += texture2D(tDiffuse, samplePos).rgb * weight;
            weight *= 0.82;
          }
          color += (rays / 8.0) * uGodRay * 1.4;
        }

        float vignette = smoothstep(0.9, 0.25, dist);
        color *= mix(0.55, 1.0, vignette);

        float grain = (grainHash(uv * uResolution + uTime) - 0.5) * 0.05;
        color += grain;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
}

/** Sized to match the instance count; read and written by the wave system. */
function attachGlowAttribute(geo: BufferGeometry, count: number): void {
  const attr = new InstancedBufferAttribute(new Float32Array(count), 1);
  attr.setUsage(DynamicDrawUsage);
  geo.setAttribute("aGlow", attr);
}

function populateHexInstances(
  hexMesh: InstancedMesh,
  positions: Array<{ x: number; z: number }>,
): void {
  const dummy = new Object3D();
  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hexMesh.setMatrixAt(i, dummy.matrix);
  }
  hexMesh.instanceMatrix.needsUpdate = true;
}

function fitFloorToBounds(floor: Mesh, bounds: GroundBounds): void {
  const pad = params.hexEdge * 2;
  const w = bounds.maxX - bounds.minX + pad * 2;
  const d = bounds.maxZ - bounds.minZ + pad * 2;
  floor.scale.set(w * 0.5, d * 0.5, 1);
  floor.position.set(
    (bounds.minX + bounds.maxX) * 0.5,
    -0.001,
    (bounds.minZ + bounds.maxZ) * 0.5,
  );
}

/**
 * Small buffer over the exact 8-ray sample, since the true frustum-ground
 * intersection is a smooth curve and the samples only approximate it.
 */
const FOOTPRINT_SAFETY = 1.08;

/**
 * Bounds sized for the widest point of the elevation drift (its lower start
 * angle sees further across the ground than the settled end angle), not
 * whatever elevation the camera currently happens to be at. Azimuth is
 * constant during the loader, so no rotation margin is needed.
 */
function getWorstCaseGroundBounds(
  camera: PerspectiveCamera,
  viewW: number,
  viewH: number,
): GroundBounds {
  const liveElevation = params.camElevation;
  params.camElevation = Math.min(ELEV_DRIFT_START, liveElevation);
  placeIsometricCamera(camera, viewW, viewH);
  const bounds = getVisibleGroundBounds(camera);
  params.camElevation = liveElevation;
  placeIsometricCamera(camera, viewW, viewH);
  return bounds;
}

function getVisibleGroundBounds(camera: PerspectiveCamera): GroundBounds {
  camera.updateMatrixWorld(true);

  const samples: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  let maxRadius = 0;
  let anyValid = false;
  const near = new Vector3();
  const far = new Vector3();
  const dir = new Vector3();

  for (const [nx, ny] of samples) {
    near.set(nx, ny, -1).unproject(camera);
    far.set(nx, ny, 1).unproject(camera);
    dir.copy(far).sub(near);
    if (Math.abs(dir.y) < 1e-8) continue;
    const t = -near.y / dir.y;
    if (t < 0) continue;
    const x = near.x + dir.x * t;
    const z = near.z + dir.z * t;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    maxRadius = Math.max(maxRadius, Math.hypot(x, z));
    anyValid = true;
  }

  if (!anyValid) {
    const pad = params.hexEdge * 8;
    return { minX: -pad, maxX: pad, minZ: -pad, maxZ: pad };
  }

  const R = maxRadius * FOOTPRINT_SAFETY + params.hexEdge * VIEW_PAD_HEXES;
  return { minX: -R, maxX: R, minZ: -R, maxZ: R };
}

function buildHexPositions(
  bounds: GroundBounds,
  _camera: PerspectiveCamera,
): Array<{ x: number; z: number }> {
  const colW = SQRT3 * params.hexEdge;
  const rowH = 1.5 * params.hexEdge;
  const radius = Math.max(bounds.maxX, bounds.maxZ) + params.hexEdge;

  const positions: Array<{ x: number; z: number }> = [];
  const row0 = Math.floor(bounds.minZ / rowH);
  const row1 = Math.ceil(bounds.maxZ / rowH);

  for (let row = row0; row <= row1; row += 1) {
    const odd = row % 2 !== 0;
    const xOff = odd ? colW * 0.5 : 0;
    const z = row * rowH;
    const col0 = Math.floor((bounds.minX - xOff) / colW);
    const col1 = Math.ceil((bounds.maxX - xOff) / colW);
    for (let col = col0; col <= col1; col += 1) {
      const x = col * colW + xOff;
      if (Math.hypot(x, z) > radius) continue;
      positions.push({ x, z });
    }
  }
  return positions;
}

function placeIsometricCamera(
  camera: PerspectiveCamera,
  viewW: number,
  viewH: number,
  skipAspectPad = false,
): void {
  const elev = (params.camElevation * Math.PI) / 180;
  const azim = (params.camAzimuth * Math.PI) / 180;
  const aspect = viewW / Math.max(viewH, 1);
  // The wide-viewport padding keeps the intro wave-sweep shot framed on
  // ultra-wide monitors, but it can be several world units — far bigger than
  // the sub-1-unit distances the zoom-in stages target, so it's skipped
  // there entirely rather than fought with a subtraction that would just
  // clamp back to a much larger distance on any normal 16:9 screen.
  const dist = skipAspectPad
    ? params.camDistance
    : params.camDistance + Math.max(0, aspect - 1) * 8;

  const y = Math.sin(elev) * dist;
  const horiz = Math.cos(elev) * dist;
  camera.position.set(
    LOOK_AT.x + Math.sin(azim) * horiz,
    LOOK_AT.y + y,
    LOOK_AT.z + Math.cos(azim) * horiz,
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(LOOK_AT);
  camera.fov = params.camFov;
  camera.aspect = aspect;
  camera.near = 0.1;
  camera.far = 500;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

type DebugHandlers = {
  onLights: () => void;
  onCamera: () => void;
  onHex: () => void;
  onWave: () => void;
  onBloom: () => void;
  onDolly: () => void;
};

type SliderDef = {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (value: number) => void;
  onChange: () => void;
};

type PanelDef = {
  title: string;
  sliders: SliderDef[];
};

async function saveLoaderConfig(): Promise<boolean> {
  const response = await fetch("/__save-loader-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return response.ok;
}

function mountDebugPanel(overlay: HTMLElement, handlers: DebugHandlers): HTMLElement {
  if (!document.getElementById("loader-debug-style")) {
    const style = document.createElement("style");
    style.id = "loader-debug-style";
    style.textContent = `
      .loader-debug-bar {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 2;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-content: flex-end;
        gap: 8px;
        pointer-events: none;
      }
      .loader-debug {
        pointer-events: auto;
        width: 168px;
        max-height: min(50vh, 340px);
        overflow: auto;
        padding: 8px 10px 10px;
        border: 1px solid rgba(220, 228, 240, 0.18);
        border-radius: 10px;
        background: rgba(8, 10, 14, 0.6);
        backdrop-filter: blur(10px);
        color: #d7dee8;
        font: 11px/1.3 ui-sans-serif, system-ui, sans-serif;
      }
      .loader-debug.is-min {
        width: auto;
        max-height: none;
        overflow: visible;
        padding: 6px 8px;
      }
      .loader-debug-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        margin-bottom: 6px;
      }
      .loader-debug.is-min .loader-debug-head {
        margin-bottom: 0;
      }
      .loader-debug-head p {
        margin: 0;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9aa6b4;
      }
      .loader-debug-head .spacer {
        flex: 1;
      }
      .loader-debug-toggle,
      .loader-debug-save-btn {
        width: 24px;
        height: 22px;
        padding: 0;
        border: 1px solid rgba(220, 228, 240, 0.22);
        border-radius: 6px;
        background: rgba(232, 238, 245, 0.12);
        color: #e8eef5;
        font: 11px/1 ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
        flex-shrink: 0;
      }
      .loader-debug-toggle:hover,
      .loader-debug-save-btn:hover {
        background: rgba(232, 238, 245, 0.2);
      }
      .loader-debug-save-btn.is-saved { border-color: rgba(120, 220, 150, 0.6); color: #9df0b4; }
      .loader-debug-save-btn.is-failed { border-color: rgba(240, 120, 120, 0.6); color: #f5a3a3; }
      .loader-debug.is-min .loader-debug-body {
        display: none;
      }
      .loader-debug label {
        display: grid;
        grid-template-columns: 1fr 44px;
        gap: 6px;
        align-items: center;
        margin: 3px 0;
      }
      .loader-debug span { color: #8b96a4; }
      .loader-debug b {
        font-weight: 600;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: #e8eef5;
      }
      .loader-debug input[type="range"] {
        grid-column: 1 / -1;
        width: 100%;
        margin: 0 0 4px;
        accent-color: #c5d0dc;
      }
    `;
    document.head.appendChild(style);
  }

  const bar = document.createElement("div");
  bar.className = "loader-debug-bar";
  bar.addEventListener("pointerdown", (event) => event.stopPropagation());
  bar.addEventListener("keydown", (event) => event.stopPropagation());

  const buildPanel = (def: PanelDef): void => {
    const panel = document.createElement("div");
    panel.className = "loader-debug";

    const head = document.createElement("div");
    head.className = "loader-debug-head";
    const title = document.createElement("p");
    title.textContent = def.title;
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "loader-debug-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", `Minimize ${def.title} settings`);
    toggle.textContent = "–";
    toggle.addEventListener("click", () => {
      const minimized = panel.classList.toggle("is-min");
      toggle.textContent = minimized ? "+" : "–";
      toggle.setAttribute("aria-expanded", minimized ? "false" : "true");
    });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "loader-debug-save-btn";
    saveBtn.textContent = "💾";
    saveBtn.title = "Save config";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      saveBtn.classList.remove("is-saved", "is-failed");
      try {
        const ok = await saveLoaderConfig();
        saveBtn.classList.add(ok ? "is-saved" : "is-failed");
      } catch {
        saveBtn.classList.add("is-failed");
      } finally {
        saveBtn.disabled = false;
        window.setTimeout(() => {
          saveBtn.classList.remove("is-saved", "is-failed");
        }, 1800);
      }
    });
    head.append(title, spacer, toggle, saveBtn);
    panel.appendChild(head);

    const body = document.createElement("div");
    body.className = "loader-debug-body";
    panel.appendChild(body);

    for (const s of def.sliders) {
      const wrap = document.createElement("label");
      const name = document.createElement("span");
      name.textContent = s.label;
      const valueEl = document.createElement("b");
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(s.min);
      input.max = String(s.max);
      input.step = String(s.step);
      input.value = String(s.get());
      const format = (n: number) => (s.step >= 1 ? String(Math.round(n)) : n.toFixed(3));
      valueEl.textContent = format(s.get());
      input.addEventListener("input", () => {
        s.set(Number(input.value));
        const applied = s.get();
        input.value = String(applied);
        valueEl.textContent = format(applied);
        s.onChange();
      });
      wrap.append(name, valueEl, input);
      body.appendChild(wrap);
    }

    bar.appendChild(panel);
  };

  const panels: PanelDef[] = [
    {
      title: "Hex",
      sliders: [
        { label: "Edge", min: 0.3, max: 3, step: 0.01, get: () => params.hexEdge, set: (v) => { params.hexEdge = v; }, onChange: handlers.onHex },
        { label: "Height", min: 0.05, max: 2, step: 0.01, get: () => params.hexHeight, set: (v) => { params.hexHeight = v; }, onChange: handlers.onHex },
        { label: "Gap", min: 0, max: 0.8, step: 0.01, get: () => params.hexGap, set: (v) => { params.hexGap = v; }, onChange: handlers.onHex },
        { label: "Center Edge", min: 0.3, max: 3, step: 0.01, get: () => params.centerHexEdge, set: (v) => { params.centerHexEdge = v; }, onChange: handlers.onHex },
      ],
    },
    {
      title: "Camera",
      sliders: [
        { label: "Exposure", min: 0, max: 3, step: 0.01, get: () => params.exposure, set: (v) => { params.exposure = v; }, onChange: handlers.onLights },
        { label: "Distance", min: 6, max: 80, step: 0.5, get: () => params.camDistance, set: (v) => { params.camDistance = v; }, onChange: handlers.onCamera },
        { label: "Elevation °", min: 10, max: 85, step: 0.5, get: () => params.camElevation, set: (v) => { params.camElevation = v; }, onChange: handlers.onCamera },
        { label: "Azimuth °", min: 0, max: 360, step: 0.5, get: () => params.camAzimuth, set: (v) => { params.camAzimuth = v; }, onChange: handlers.onCamera },
      ],
    },
    {
      title: "Wave",
      sliders: [
        { label: "Width", min: 0.5, max: 10, step: 0.1, get: () => params.waveWidth, set: (v) => { params.waveWidth = v; }, onChange: handlers.onWave },
        { label: "Intensity", min: 0.1, max: 3, step: 0.05, get: () => params.waveIntensity, set: (v) => { params.waveIntensity = v; }, onChange: handlers.onWave },
        { label: "Speed", min: 1, max: 40, step: 0.5, get: () => params.waveSpeed, set: (v) => { params.waveSpeed = v; }, onChange: handlers.onWave },
      ],
    },
    {
      title: "Rise",
      sliders: [
        { label: "Rise factor", min: 0, max: 5, step: 0.05, get: () => params.riseFactor, set: (v) => { params.riseFactor = v; }, onChange: handlers.onWave },
        { label: "Speed", min: 1, max: 20, step: 0.5, get: () => params.riseSpeed, set: (v) => { params.riseSpeed = v; }, onChange: handlers.onWave },
      ],
    },
    {
      title: "Bloom",
      sliders: [
        { label: "Radius", min: 0, max: 1, step: 0.01, get: () => params.bloomRadius, set: (v) => { params.bloomRadius = v; }, onChange: handlers.onBloom },
        { label: "Threshold", min: 0, max: 1, step: 0.01, get: () => params.bloomThreshold, set: (v) => { params.bloomThreshold = v; }, onChange: handlers.onBloom },
      ],
    },
    {
      title: "Dolly",
      sliders: [
        { label: "Speed", min: 0.2, max: 5, step: 0.05, get: () => params.dollySpeed, set: (v) => { params.dollySpeed = v; }, onChange: handlers.onDolly },
      ],
    },
  ];

  for (const def of panels) buildPanel(def);

  overlay.appendChild(bar);
  return bar;
}

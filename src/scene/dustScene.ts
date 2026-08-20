import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  WebGLRenderer,
} from "three";

const FRUSTUM = 5;
const GRID_SPACING_PX = 7;
const PARTICLE_RADIUS_PX = 1.2;
const MOUSE_RADIUS_PX = 12;
const WAVE_SPEED = 0.75;
const MAX_PARTICLES = 18000;
const DUST_EDGE_FADE = 0.24;
const ACCENT_RED = 0xff3d5a;
const ACCENT_RED_DIM = 0xc42e48;

// =============================================================================
// PERSPECTIVE GRID — square floor, 1-point perspective
// =============================================================================

/** Square cell size in world units. Smaller = denser grid. */
const GRID_CELL = 0.3;

/**
 * Screen distance from the viewport edge to the horizon.
 * Larger = the plane covers more of the screen before vanishing.
 */
const GRID_HORIZON = 2.4;

/**
 * World depth where the grid is fully faded. Larger = visible farther.
 * Lines are generated well past this so they read as infinite.
 */
const GRID_FADE_DISTANCE = 1.9;

// =============================================================================
// EMBERS — Matrix-style Kannada / Hindi glyphs with a 5-character tail
// =============================================================================

const EMBER_CHARACTERS = [
  "ಅ",
  "ಆ",
  "ಇ",
  "ಈ",
  "ಉ",
  "ಊ",
  "ಋ",
  "ಎ",
  "ಏ",
  "ಐ",
  "ಒ",
  "ಓ",
  "ಔ",
  "ಕ",
  "ಖ",
  "ಗ",
  "ಘ",
  "ಙ",
  "ಚ",
  "ಛ",
  "ಜ",
  "ಝ",
  "ಞ",
  "ಟ",
  "ಠ",
  "ಡ",
  "ಢ",
  "ಣ",
  "ತ",
  "ಥ",
  "ದ",
  "ಧ",
  "ನ",
  "ಪ",
  "ಫ",
  "ಬ",
  "ಭ",
  "ಮ",
  "ಯ",
  "ರ",
  "ಲ",
  "ವ",
  "ಶ",
  "ಷ",
  "ಸ",
  "ಹ",
  "ಳ",
  "ೞ",
  "೧",
  "೨",
  "೩",
  "೪",
  "೫",
  "೬",
  "೭",
  "೮",
  "೯",
  "अ",
  "आ",
  "इ",
  "ई",
  "उ",
  "ऊ",
  "ऋ",
  "ए",
  "ऐ",
  "ओ",
  "औ",
  "क",
  "ख",
  "ग",
  "घ",
  "ङ",
  "च",
  "छ",
  "ज",
  "झ",
  "ञ",
  "ट",
  "ठ",
  "ड",
  "ढ",
  "ण",
  "त",
  "थ",
  "द",
  "ध",
  "न",
  "प",
  "फ",
  "ब",
  "भ",
  "म",
  "य",
  "र",
  "ल",
  "व",
  "श",
  "ष",
  "स",
  "ह",
  "०",
  "१",
  "२",
  "३",
  "४",
  "५",
  "६",
  "७",
  "८",
  "९",
];

/** Fall speed in pixels per frame. */
const EMBER_SPEED_PX = 0.65;

/** Glyph size in pixels at the nearest depth. */
const EMBER_SIZE_PX = 16;

/**
 * Farthest Z. Smaller / dimmer, deeper into the scene.
 * Camera looks from z = 10 toward the origin.
 */
const EMBER_MIN_DEPTH = 5;

/**
 * Closest Z. Full size / brightest, nearer the viewport.
 */
const EMBER_MAX_DEPTH = 10;

/** How many ember streams are alive at once. Derived from viewport width. */
const EMBER_COUNT_WIDTH_DIVISOR = 2;

const EMBER_TAIL = 15;
const EMBER_TAIL_GAP_PX = 18;
const EMBER_FLICKER = 0.08;

/** Hard clip line, in pixels from the canvas bottom. */
const EMBER_BOTTOM_CUTOFF_PX = 96;

/** Extra random height above that line, in pixels. */
const EMBER_BOTTOM_CUTOFF_VARIANCE_PX = 160;

// =============================================================================

type Particle = {
  col: number;
  row: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
};

type GridState = {
  mesh: InstancedMesh;
  particles: Particle[];
  dummy: Object3D;
  geometry: SphereGeometry;
  material: MeshBasicMaterial;
  cols: number;
  rows: number;
};

type Ember = {
  x: number;
  y: number;
  z: number;
  chars: number[];
  killPx: number;
};

type EmberLayer = {
  streams: Ember[];
  dummy: Object3D;
  mesh: InstancedMesh;
  geometry: PlaneGeometry;
  material: ShaderMaterial;
  texture: CanvasTexture;
  charAttr: InstancedBufferAttribute;
  atlasCols: number;
  atlasRows: number;
};

export function createDustScene(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
): () => void {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.z = 10;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const gridLines = new Group();
  scene.add(gridLines);

  let grid = createGrid(host);
  scene.add(grid.mesh);

  let embers = createEmberLayer(host);
  scene.add(embers.mesh);

  const rebuildGridLines = () => {
    while (gridLines.children.length) {
      const child = gridLines.children[0] as LineSegments;
      gridLines.remove(child);
      child.geometry.dispose();
      (child.material as LineBasicMaterial).dispose();
    }
    gridLines.add(buildPerspectiveGrid(hostAspect(host), false));
  };
  rebuildGridLines();

  const mouse = { x: 9999, y: 9999, inside: false };
  let pushRadius = pushRadiusWorld(host);
  let waveAmp = waveAmpWorld(host);
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    mouse.x = ndcX * FRUSTUM * hostAspect(host);
    mouse.y = -ndcY * FRUSTUM;
    mouse.inside = true;
  };

  const onPointerLeave = () => {
    mouse.inside = false;
    mouse.x = 9999;
    mouse.y = 9999;
  };

  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);

  let playing = true;
  let raf = 0;
  let time = 0;
  let lastAspect = hostAspect(host);
  const dustColor = new Color();
  const dustColorDim = new Color(ACCENT_RED_DIM);

  const tick = () => {
    if (!playing) return;
    time += reduceMotion ? 0 : 0.016;

    const aspect = hostAspect(host);
    const worldW = FRUSTUM * 2 * aspect;
    const worldH = FRUSTUM * 2;
    const { cols, rows } = grid;
    const spacingX = worldW / cols;
    const spacingY = worldH / rows;

    for (let i = 0; i < grid.particles.length; i += 1) {
      const p = grid.particles[i];
      const u = (p.col + 0.5) / cols;
      const v = (p.row + 0.5) / rows;
      const wave =
        Math.sin(time * WAVE_SPEED + u * Math.PI * 6 + v * Math.PI * 2) *
          waveAmp +
        Math.sin(time * WAVE_SPEED * 0.62 + u * Math.PI * 3) * waveAmp * 0.4;
      const homeX = (p.col + 0.5) * spacingX - worldW / 2;
      const homeY = (p.row + 0.5) * spacingY - worldH / 2 + (reduceMotion ? 0 : wave);

      if (!reduceMotion && mouse.inside) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < pushRadius && dist > 0.0001) {
          const falloff = 1 - dist / pushRadius;
          const force = falloff * falloff * 0.1;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      p.vx *= 0.8;
      p.vy *= 0.8;
      p.x += p.vx + (homeX - p.x) * 0.16;
      p.y += p.vy + (homeY - p.y) * 0.16;

      const fade = edgeFade(v);
      const tint = 0.65 + ((p.col * 7 + p.row * 3) % 10) / 28;
      dustColor.setHex(ACCENT_RED).lerp(dustColorDim, 1 - tint);
      dustColor.multiplyScalar(fade);
      grid.mesh.setColorAt(i, dustColor);

      grid.dummy.position.set(p.x, p.y, 0);
      grid.dummy.scale.setScalar(p.scale * (0.35 + fade * 0.65));
      grid.dummy.updateMatrix();
      grid.mesh.setMatrixAt(i, grid.dummy.matrix);
    }
    grid.mesh.instanceMatrix.needsUpdate = true;
    if (grid.mesh.instanceColor) grid.mesh.instanceColor.needsUpdate = true;

    tickEmbers(embers, host, reduceMotion);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const rebuildGridIfNeeded = () => {
    const next = gridSize(host);
    if (next.cols === grid.cols && next.rows === grid.rows) {
      const scale = particleScale(host);
      for (const p of grid.particles) p.scale = scale;
      return;
    }

    scene.remove(grid.mesh);
    grid.geometry.dispose();
    grid.material.dispose();
    grid = createGrid(host);
    scene.add(grid.mesh);
  };

  const rebuildEmbersIfNeeded = () => {
    const nextCount = emberCount(host);
    if (nextCount === embers.streams.length) return;
    scene.remove(embers.mesh);
    disposeEmberLayer(embers);
    embers = createEmberLayer(host);
    scene.add(embers.mesh);
  };

  const resize = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    const nextAspect = width / height;
    camera.left = -FRUSTUM * nextAspect;
    camera.right = FRUSTUM * nextAspect;
    camera.top = FRUSTUM;
    camera.bottom = -FRUSTUM;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
    pushRadius = pushRadiusWorld(host);
    waveAmp = waveAmpWorld(host);
    rebuildGridIfNeeded();
    rebuildEmbersIfNeeded();
    if (Math.abs(nextAspect - lastAspect) > 0.01) {
      rebuildGridLines();
      lastAspect = nextAspect;
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const io = new IntersectionObserver(
    ([entry]) => {
      playing = Boolean(entry?.isIntersecting);
      if (playing) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
      }
    },
    { threshold: 0.02 },
  );
  io.observe(host);

  raf = requestAnimationFrame(tick);

  return () => {
    playing = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerleave", onPointerLeave);
    renderer.dispose();
    grid.geometry.dispose();
    grid.material.dispose();
    disposeEmberLayer(embers);
    while (gridLines.children.length) {
      const child = gridLines.children[0] as LineSegments;
      gridLines.remove(child);
      child.geometry.dispose();
      (child.material as LineBasicMaterial).dispose();
    }
  };
}

function buildPerspectiveGrid(aspect: number, isTop: boolean): LineSegments {
  const worldW = FRUSTUM * 2 * aspect;
  const edgeY = isTop ? FRUSTUM : -FRUSTUM;
  const horizonY = isTop ? FRUSTUM - GRID_HORIZON : -FRUSTUM + GRID_HORIZON;
  const zNear = 1;
  const zFar = GRID_FADE_DISTANCE * 2.4;
  const focal = (worldW * 0.5) * zNear;
  const xExtent = Math.ceil(zFar / GRID_CELL) * GRID_CELL;

  const positions: number[] = [];
  const colors: number[] = [];
  const base = new Color(ACCENT_RED);

  const fadeAt = (z: number): number => {
    const t = Math.min(1, Math.max(0, (z - zNear) / GRID_FADE_DISTANCE));
    const s = 1 - t;
    return s * s * s;
  };

  const project = (x: number, z: number) => {
    const depth = Math.max(z, zNear);
    const t = 1 - zNear / depth;
    return {
      x: (x * focal) / depth,
      y: edgeY + (horizonY - edgeY) * t,
      fade: fadeAt(depth),
    };
  };

  const pushLine = (
    x1: number,
    y1: number,
    fade1: number,
    x2: number,
    y2: number,
    fade2: number,
  ) => {
    if (Math.max(fade1, fade2) < 0.012) return;
    positions.push(x1, y1, -0.05, x2, y2, -0.05);
    const c1 = base.clone().multiplyScalar(fade1);
    const c2 = base.clone().multiplyScalar(fade2);
    colors.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
  };

  const pushWorldLine = (x1: number, z1: number, x2: number, z2: number) => {
    const a = project(x1, z1);
    const b = project(x2, z2);
    pushLine(a.x, a.y, a.fade, b.x, b.y, b.fade);
  };

  const depthSteps = 12;
  for (let x = -xExtent; x <= xExtent + 0.0001; x += GRID_CELL) {
    for (let s = 0; s < depthSteps; s += 1) {
      const z0 = zNear + ((zFar - zNear) * s) / depthSteps;
      const z1 = zNear + ((zFar - zNear) * (s + 1)) / depthSteps;
      pushWorldLine(x, z0, x, z1);
    }
  }

  for (let z = zNear; z <= zFar + 0.0001; z += GRID_CELL) {
    if (fadeAt(z) < 0.012) break;
    pushWorldLine(-xExtent, z, xExtent, z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    }),
  );
}

function edgeFade(v: number): number {
  if (v < DUST_EDGE_FADE) return v / DUST_EDGE_FADE;
  if (v > 1 - DUST_EDGE_FADE) return (1 - v) / DUST_EDGE_FADE;
  return 1;
}

function emberKillY(host: HTMLElement, killPx: number): number {
  return -FRUSTUM + pxToWorld(killPx, host);
}

function randomKillPx(): number {
  return EMBER_BOTTOM_CUTOFF_PX + Math.random() * EMBER_BOTTOM_CUTOFF_VARIANCE_PX;
}

function hostAspect(host: HTMLElement): number {
  return (host.clientWidth || 1) / (host.clientHeight || 1);
}

function particleScale(host: HTMLElement): number {
  const height = host.clientHeight || 1;
  return (PARTICLE_RADIUS_PX / height) * (FRUSTUM * 2);
}

function waveAmpWorld(host: HTMLElement): number {
  const height = host.clientHeight || 1;
  return ((GRID_SPACING_PX * 1.35) / height) * (FRUSTUM * 2);
}

function pushRadiusWorld(host: HTMLElement): number {
  const height = host.clientHeight || 1;
  return ((MOUSE_RADIUS_PX * 2) / height) * (FRUSTUM * 2);
}

function gridSize(host: HTMLElement): { cols: number; rows: number } {
  const width = host.clientWidth || 1;
  const height = host.clientHeight || 1;
  let cols = Math.max(8, Math.floor(width / GRID_SPACING_PX));
  let rows = Math.max(8, Math.floor(height / GRID_SPACING_PX));
  if (cols * rows > MAX_PARTICLES) {
    const scale = Math.sqrt(MAX_PARTICLES / (cols * rows));
    cols = Math.max(8, Math.floor(cols * scale));
    rows = Math.max(8, Math.floor(rows * scale));
  }
  return { cols, rows };
}

function createGrid(host: HTMLElement): GridState {
  const { cols, rows } = gridSize(host);
  const scale = particleScale(host);
  const count = cols * rows;
  const geometry = new SphereGeometry(1, 6, 6);
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const dummy = new Object3D();
  const particles: Particle[] = [];
  const color = new Color();
  const aspect = hostAspect(host);
  const worldW = FRUSTUM * 2 * aspect;
  const worldH = FRUSTUM * 2;
  const spacingX = worldW / cols;
  const spacingY = worldH / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) * spacingX - worldW / 2;
      const y = (row + 0.5) * spacingY - worldH / 2;
      const v = (row + 0.5) / rows;
      const fade = edgeFade(v);
      particles.push({
        col,
        row,
        x,
        y,
        vx: 0,
        vy: 0,
        scale,
      });
      dummy.position.set(x, y, 0);
      dummy.scale.setScalar(scale * (0.35 + fade * 0.65));
      dummy.updateMatrix();
      mesh.setMatrixAt(particles.length - 1, dummy.matrix);
      const tint = 0.65 + ((col * 7 + row * 3) % 10) / 28;
      color.setHex(ACCENT_RED).lerp(new Color(ACCENT_RED_DIM), 1 - tint);
      color.multiplyScalar(fade);
      mesh.setColorAt(particles.length - 1, color);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return { mesh, particles, dummy, geometry, material, cols, rows };
}

function pxToWorld(px: number, host: HTMLElement): number {
  const height = host.clientHeight || 1;
  return (px / height) * (FRUSTUM * 2);
}

function emberCount(host: HTMLElement): number {
  return Math.max(1, Math.floor((host.clientWidth || 1) / EMBER_COUNT_WIDTH_DIVISOR));
}

function randomCharIndex(): number {
  return Math.floor(Math.random() * EMBER_CHARACTERS.length);
}

function randomDepth(): number {
  return EMBER_MIN_DEPTH + Math.random() * (EMBER_MAX_DEPTH - EMBER_MIN_DEPTH);
}

function depthAmount(z: number): number {
  const span = EMBER_MAX_DEPTH - EMBER_MIN_DEPTH;
  if (span <= 0.0001) return 1;
  return Math.min(1, Math.max(0, (z - EMBER_MIN_DEPTH) / span));
}

function createCharAtlas(): {
  texture: CanvasTexture;
  cols: number;
  rows: number;
} {
  const count = EMBER_CHARACTERS.length;
  const cols = 16;
  const rows = Math.ceil(count / cols);
  const cell = 96;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { texture: new CanvasTexture(canvas), cols, rows };
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.floor(cell * 0.62)}px "Nirmala UI","Noto Sans Kannada","Noto Sans Devanagari",sans-serif`;

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.fillText(
      EMBER_CHARACTERS[i],
      col * cell + cell / 2,
      row * cell + cell / 2 + cell * 0.04,
    );
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return { texture, cols, rows };
}

function createEmberMaterial(
  texture: CanvasTexture,
  cols: number,
  rows: number,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uAtlas: { value: texture },
      uCols: { value: cols },
      uRows: { value: rows },
    },
    vertexShader: `
      attribute float aChar;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vChar;
      void main() {
        vUv = uv;
        vChar = aChar;
        vColor = instanceColor;
        vec4 world = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform float uCols;
      uniform float uRows;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vChar;
      void main() {
        float col = mod(vChar, uCols);
        float row = floor(vChar / uCols);
        vec2 uv = vec2(
          (col + vUv.x) / uCols,
          1.0 - (row + 1.0 - vUv.y) / uRows
        );
        vec4 texel = texture2D(uAtlas, uv);
        gl_FragColor = vec4(vColor, texel.a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

function spawnEmber(host: HTMLElement, scatter: boolean): Ember {
  const aspect = hostAspect(host);
  const worldW = FRUSTUM * 2 * aspect;
  const worldH = FRUSTUM * 2;
  const tailLen = pxToWorld(EMBER_TAIL_GAP_PX, host) * (EMBER_TAIL - 1);
  const chars = Array.from({ length: EMBER_TAIL }, randomCharIndex);
  return {
    x: (Math.random() - 0.5) * worldW,
    y: scatter
      ? FRUSTUM - Math.random() * (worldH + tailLen)
      : FRUSTUM + tailLen * Math.random(),
    z: randomDepth(),
    chars,
    killPx: randomKillPx(),
  };
}

function createEmberLayer(host: HTMLElement): EmberLayer {
  const streamsCount = emberCount(host);
  const count = streamsCount * EMBER_TAIL;
  const { texture, cols, rows } = createCharAtlas();
  const geometry = new PlaneGeometry(1, 1);
  const charAttr = new InstancedBufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute("aChar", charAttr);
  const material = createEmberMaterial(texture, cols, rows);
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;

  const streams: Ember[] = [];
  for (let i = 0; i < streamsCount; i += 1) {
    streams.push(spawnEmber(host, true));
  }

  return {
    streams,
    dummy: new Object3D(),
    mesh,
    geometry,
    material,
    texture,
    charAttr,
    atlasCols: cols,
    atlasRows: rows,
  };
}

function tickEmbers(
  embers: EmberLayer,
  host: HTMLElement,
  reduceMotion: boolean,
): void {
  const aspect = hostAspect(host);
  const worldW = FRUSTUM * 2 * aspect;
  const speed = pxToWorld(EMBER_SPEED_PX, host);
  const gap = pxToWorld(EMBER_TAIL_GAP_PX, host);
  const size = pxToWorld(EMBER_SIZE_PX, host);
  const tailLen = gap * (EMBER_TAIL - 1);
  const color = new Color();
  const dummy = embers.dummy;

  if (!reduceMotion) {
    for (const ember of embers.streams) {
      ember.y -= speed;
      const killY = emberKillY(host, ember.killPx);
      if (ember.y + tailLen < killY) {
        ember.x = (Math.random() - 0.5) * worldW;
        ember.y = FRUSTUM + gap * Math.random();
        ember.z = randomDepth();
        ember.killPx = randomKillPx();
        for (let t = 0; t < EMBER_TAIL; t += 1) {
          ember.chars[t] = randomCharIndex();
        }
      } else {
        for (let t = 0; t < EMBER_TAIL; t += 1) {
          if (Math.random() < EMBER_FLICKER) {
            ember.chars[t] = randomCharIndex();
          }
        }
      }
    }
  }

  for (let s = 0; s < embers.streams.length; s += 1) {
    const ember = embers.streams[s];
    const near = depthAmount(ember.z);
    const scale = size * (0.32 + near * 0.68);
    const killY = emberKillY(host, ember.killPx);
    for (let t = 0; t < EMBER_TAIL; t += 1) {
      const index = s * EMBER_TAIL + t;
      const glyphY = ember.y + t * gap;
      const visible = glyphY - scale * 0.5 > killY;
      const fade = ((EMBER_TAIL - t) / EMBER_TAIL) * (0.22 + near * 0.78);
      dummy.position.set(ember.x, glyphY, ember.z);
      dummy.scale.setScalar(visible ? scale : 0);
      dummy.updateMatrix();
      embers.mesh.setMatrixAt(index, dummy.matrix);
      color.setHex(ACCENT_RED);
      if (t === 0) color.lerp(new Color(0xffffff), 0.28 * near);
      color.multiplyScalar(fade);
      embers.mesh.setColorAt(index, color);
      embers.charAttr.setX(index, ember.chars[t]);
    }
  }

  embers.mesh.instanceMatrix.needsUpdate = true;
  if (embers.mesh.instanceColor) embers.mesh.instanceColor.needsUpdate = true;
  embers.charAttr.needsUpdate = true;
}

function disposeEmberLayer(embers: EmberLayer): void {
  embers.geometry.dispose();
  embers.material.dispose();
  embers.texture.dispose();
}

export function canCreateWebGL(): boolean {
  const probe = document.createElement("canvas");
  return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
}

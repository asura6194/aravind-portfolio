import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";

const FRUSTUM = 5;
const GRID_SPACING_PX = 7;
const PARTICLE_RADIUS_PX = 1.2;
const MOUSE_RADIUS_PX = 12;
const WAVE_SPEED = 0.75;
const MAX_PARTICLES = 18000;

type Particle = {
  u: number;
  v: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
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

  const { cols, rows } = gridSize(host);
  const { mesh, particles, dummy, geometry, material } = createGrid(
    cols,
    rows,
    hostAspect(host),
    particleScale(host),
  );
  scene.add(mesh);

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

  const tick = () => {
    if (!playing) return;
    time += reduceMotion ? 0 : 0.016;

    const aspect = hostAspect(host);
    const worldW = FRUSTUM * 2 * aspect;
    const worldH = FRUSTUM * 2;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const wave =
        Math.sin(time * WAVE_SPEED + p.u * Math.PI * 6 + p.v * Math.PI * 2) *
          waveAmp +
        Math.sin(time * WAVE_SPEED * 0.62 + p.u * Math.PI * 3) * waveAmp * 0.4;
      const homeX = (p.u - 0.5) * worldW;
      const homeY = (p.v - 0.5) * worldH + (reduceMotion ? 0 : wave);

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

      dummy.position.set(p.x, p.y, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
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
    const scale = particleScale(host);
    for (const p of particles) p.scale = scale;
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
    geometry.dispose();
    material.dispose();
  };
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

function createGrid(
  cols: number,
  rows: number,
  aspect: number,
  scale: number,
): {
  mesh: InstancedMesh;
  particles: Particle[];
  dummy: Object3D;
  geometry: SphereGeometry;
  material: MeshBasicMaterial;
} {
  const count = cols * rows;
  const geometry = new SphereGeometry(1, 6, 6);
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const dummy = new Object3D();
  const particles: Particle[] = [];
  const color = new Color();
  const worldW = FRUSTUM * 2 * aspect;
  const worldH = FRUSTUM * 2;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = (col + 0.5) / cols;
      const v = (row + 0.5) / rows;
      const x = (u - 0.5) * worldW;
      const y = (v - 0.5) * worldH;
      particles.push({
        u,
        v,
        x,
        y,
        vx: 0,
        vy: 0,
        scale,
      });
      dummy.position.set(x, y, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(particles.length - 1, dummy.matrix);
      color.setRGB(1, 1, 1);
      mesh.setColorAt(particles.length - 1, color);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return { mesh, particles, dummy, geometry, material };
}

export function canCreateWebGL(): boolean {
  const probe = document.createElement("canvas");
  return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
}

import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

const ACCENT = 0xe8a87c;
const TEAL = 0x7ec8c4;
const INK = 0x16181d;

export function createHeroScene(canvas: HTMLCanvasElement): () => void {
  const scene = new Scene();
  scene.background = new Color(INK);

  const camera = new PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(0, 0.35, 6.2);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const { group: cube, geo } = buildCubeLattice();
  scene.add(cube);

  const ambient = new AmbientLight(0xffffff, 0.45);
  const key = new DirectionalLight(0xfff4e8, 1.15);
  key.position.set(4, 6, 5);
  const fill = new DirectionalLight(0x7ec8c4, 0.35);
  fill.position.set(-5, -2, 2);
  scene.add(ambient, key, fill);

  const pointer = { x: 0, y: 0, down: false };
  const targetRot = { x: 0.35, y: 0.55 };

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    if (pointer.down) {
      targetRot.y += (nx - pointer.x) * 1.4;
      targetRot.x += (ny - pointer.y) * 1.1;
    } else {
      targetRot.y = 0.55 + nx * 0.35;
      targetRot.x = 0.35 + ny * 0.2;
    }
    pointer.x = nx;
    pointer.y = ny;
  };

  const onPointerDown = (event: PointerEvent) => {
    pointer.down = true;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  };

  const onPointerUp = () => {
    pointer.down = false;
    canvas.style.cursor = "grab";
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  let playing = true;
  let raf = 0;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const tick = () => {
    if (!playing) return;
    if (!reduceMotion && !pointer.down) {
      targetRot.y += 0.004;
    }
    cube.rotation.y += (targetRot.y - cube.rotation.y) * 0.08;
    cube.rotation.x += (targetRot.x - cube.rotation.x) * 0.08;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const resize = () => {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const height =
      canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement ?? canvas);
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
    { threshold: 0.05 },
  );
  io.observe(canvas);

  raf = requestAnimationFrame(tick);

  return () => {
    playing = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    renderer.dispose();
    geo.dispose();
    cube.traverse((obj: Object3D) => {
      if (obj instanceof Mesh) {
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  };
}

function buildCubeLattice(): { group: Group; geo: BoxGeometry } {
  const group = new Group();
  const geo = new BoxGeometry(0.72, 0.72, 0.72);
  const colors = [ACCENT, TEAL, 0xd8d4cc];
  const gap = 0.88;

  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const material = new MeshStandardMaterial({
          color: colors[(Math.abs(x) + Math.abs(y) + Math.abs(z)) % 3],
          roughness: 0.35,
          metalness: 0.25,
        });
        const mesh = new Mesh(geo, material);
        mesh.position.set(x * gap, y * gap, z * gap);
        group.add(mesh);
      }
    }
  }

  return { group, geo };
}

export function canCreateWebGL(): boolean {
  const probe = document.createElement("canvas");
  return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
}

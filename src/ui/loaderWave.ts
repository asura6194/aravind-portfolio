import gsap from "gsap";
import {
  AdditiveBlending,
  type BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  type InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
} from "three";
import { WAVE_COLOR, hexRing, worldToAxial, type XZ } from "./hexLattice";
import type { LoaderParams } from "./loadingScreenConfig";

const FILL_S = 0.4;
const FLARE_DURATION = 0.5;
/** Matches the centre hex's own emissive ramp so risen tiles look identical. */
const GLOW_RAMP = 2.6;

const DARK = new Color(0x090b0f);
const RED = new Color(WAVE_COLOR);

type RiseEntry = { current: number; target: number };

export type WaveSystem = {
  group: Group;
  centerMesh: Mesh;
  rebuild: (
    tiles: XZ[],
    size: number,
    hexHeight: number,
    hexMesh: InstancedMesh,
  ) => void;
  applySettings: () => void;
  update: (dt: number) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
};

/**
 * Drives a hexagonal ring wave that sweeps inward from the edge of the grid.
 * Each ring rises, glows, and settles as the band passes over it; when the
 * front reaches the middle the centre hex lights up and flares.
 */
export function createWaveSystem(
  hexGeo: ExtrudeGeometry,
  getParams: () => LoaderParams,
  onPlayStart?: (durationSeconds: number) => void,
  onFlareDone?: () => void,
): WaveSystem {
  const group = new Group();
  group.name = "loader-wave";

  const flareGeo = new PlaneGeometry(1, 1);
  flareGeo.rotateX(-Math.PI / 2);
  const flareTexture = createFlareTexture();
  const flareMat = new MeshBasicMaterial({
    map: flareTexture,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const flareMesh = new Mesh(flareGeo, flareMat);
  flareMesh.visible = false;
  flareMesh.renderOrder = 10;
  group.add(flareMesh);
  let flareTween: gsap.core.Timeline | null = null;
  let flareSize = 2;
  let flareY = 0.2;

  const centerMat = new MeshPhysicalMaterial({
    color: 0x090b0f,
    metalness: 0.45,
    roughness: 0.32,
    emissive: new Color(WAVE_COLOR),
    emissiveIntensity: 0,
  });
  const centerMesh = new Mesh(hexGeo, centerMat);
  group.add(centerMesh);

  const centerLight = new PointLight(WAVE_COLOR, 0, 7, 2);
  group.add(centerLight);

  let timeline: gsap.core.Timeline | null = null;
  let waveProgress = 0;
  let fill = 0;
  let currentHexHeight = 0.2;

  // Floor tiles, bucketed by hex ring so each frame only visits the few rings
  // the band currently covers instead of every tile on screen.
  let floorMesh: InstancedMesh | null = null;
  let floorTiles: XZ[] = [];
  let ringTiles: number[][] = [];
  let maxRing = 1;
  let glowAttr: BufferAttribute | InterleavedBufferAttribute | null = null;
  let glowStrength: { value: number } | null = null;
  const riseState = new Map<number, RiseEntry>();
  const activeTiles = new Set<number>();
  const _dummy = new Object3D();

  const styleFromParams = () => {
    flareY = currentHexHeight * 1.15 + 0.03;
  };

  /** Rings per second, so bigger grids take proportionally longer to cross. */
  const waveDuration = () => {
    const speed = Math.max(0.5, getParams().waveSpeed);
    const width = Math.max(0.5, getParams().waveWidth);
    return Math.min(6, Math.max(0.6, (maxRing + 2 * width) / speed));
  };

  /** Timeline offset at which the front sits exactly on the centre hex. */
  const centerHitTime = (totalS: number) => {
    const width = Math.max(0.5, getParams().waveWidth);
    return totalS * ((maxRing + width) / (maxRing + 2 * width));
  };

  const update = (dt: number) => {
    if (!floorMesh) return;
    const p = getParams();
    const width = Math.max(0.5, p.waveWidth);
    const riseTarget = Math.max(0, currentHexHeight * p.riseFactor);
    const speed = Math.max(0.1, p.riseSpeed);
    const fade = fill > 0.2 ? Math.max(0, 1 - (fill - 0.2) / 0.8) : 1;

    // Front travels from just outside the outermost ring to just past centre,
    // so every ring gets a clean rise and a clean drop.
    const front = maxRing + width - waveProgress * (maxRing + 2 * width);

    activeTiles.clear();
    if (fade > 0.02) {
      const lo = Math.max(0, Math.ceil(front - width));
      const hi = Math.min(maxRing, Math.floor(front + width));
      for (let r = lo; r <= hi; r += 1) {
        const bucket = ringTiles[r];
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k += 1) activeTiles.add(bucket[k]);
      }
    }

    for (const idx of activeTiles) {
      let entry = riseState.get(idx);
      if (!entry) {
        entry = { current: 0, target: 0 };
        riseState.set(idx, entry);
      }
      entry.target = riseTarget;
    }
    for (const [idx, entry] of riseState) {
      if (!activeTiles.has(idx)) entry.target = 0;
    }

    if (riseState.size === 0) return;
    if (glowStrength) {
      glowStrength.value = GLOW_RAMP * Math.max(0.4, p.waveIntensity);
    }
    const lerpF = Math.min(1, dt * speed);
    const invHeight = 1 / Math.max(0.05, currentHexHeight);
    const invTarget = riseTarget > 1e-4 ? 1 / riseTarget : 0;
    let touched = false;
    for (const [idx, entry] of riseState) {
      entry.current += (entry.target - entry.current) * lerpF;
      if (entry.target === 0 && Math.abs(entry.current) < 0.001) {
        entry.current = 0;
      }
      const tile = floorTiles[idx];
      _dummy.position.set(tile.x, 0, tile.z);
      _dummy.quaternion.identity();
      _dummy.scale.set(1, 1 + entry.current * invHeight, 1);
      _dummy.updateMatrix();
      floorMesh.setMatrixAt(idx, _dummy.matrix);
      if (glowAttr) {
        glowAttr.setX(idx, Math.min(1, entry.current * invTarget) * fade);
      }
      touched = true;
      if (entry.current === 0 && entry.target === 0) riseState.delete(idx);
    }
    if (touched) {
      floorMesh.instanceMatrix.needsUpdate = true;
      if (glowAttr) glowAttr.needsUpdate = true;
    }
  };

  const applyCenter = () => {
    const lit = Math.max(0, (fill - 0.06) / 0.94);
    const boost = getParams().waveIntensity;
    centerMat.emissiveIntensity = lit * GLOW_RAMP * Math.max(0.4, boost);
    centerMat.color.lerpColors(DARK, RED, lit);
    const s = 1 + Math.sin(Math.min(1, fill) * Math.PI) * 0.06;
    centerMesh.scale.setScalar(s);
    centerLight.intensity = lit * 3.2 * Math.max(0.4, boost);
  };

  const triggerFlare = () => {
    flareTween?.kill();
    flareMesh.visible = true;
    flareMesh.position.set(0, flareY, 0);
    flareMesh.scale.setScalar(flareSize * 0.4);
    flareMat.opacity = 0;
    flareTween = gsap.timeline({
      onComplete: () => {
        flareMesh.visible = false;
        onFlareDone?.();
      },
    });
    flareTween.to(flareMat, { opacity: 1, duration: FLARE_DURATION * 0.24, ease: "power2.out" });
    flareTween.to(
      flareMesh.scale,
      {
        x: flareSize * 1.35,
        y: flareSize * 1.35,
        z: flareSize * 1.35,
        duration: FLARE_DURATION * 0.8,
        ease: "power2.out",
      },
      "<",
    );
    flareTween.to(flareMat, { opacity: 0, duration: FLARE_DURATION * 0.56, ease: "power2.in" }, "-=0.08");
  };

  const resetTiles = () => {
    if (!floorMesh) return;
    for (const [idx] of riseState) {
      const tile = floorTiles[idx];
      _dummy.position.set(tile.x, 0, tile.z);
      _dummy.quaternion.identity();
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      floorMesh.setMatrixAt(idx, _dummy.matrix);
      glowAttr?.setX(idx, 0);
    }
    riseState.clear();
    activeTiles.clear();
    floorMesh.instanceMatrix.needsUpdate = true;
    if (glowAttr) glowAttr.needsUpdate = true;
  };

  const play = () => {
    timeline?.kill();
    flareTween?.kill();
    flareMesh.visible = false;
    resetTiles();
    waveProgress = 0;
    fill = 0;
    centerMat.emissiveIntensity = 0;
    centerMat.color.copy(DARK);
    centerMesh.scale.setScalar(1);
    centerLight.intensity = 0;
    styleFromParams();

    const waveProxy = { v: 0 };
    const fillProxy = { v: 0 };
    const waveS = waveDuration();
    const hitS = centerHitTime(waveS);
    onPlayStart?.(Math.max(waveS, hitS + FILL_S));

    timeline = gsap.timeline();
    timeline.to(waveProxy, {
      v: 1,
      duration: waveS,
      ease: "none",
      onUpdate: () => {
        waveProgress = waveProxy.v;
      },
    });
    timeline.to(
      fillProxy,
      {
        v: 1,
        duration: FILL_S,
        ease: "back.out(1.6)",
        onUpdate: () => {
          fill = fillProxy.v;
          applyCenter();
        },
      },
      hitS,
    );
    timeline.call(() => triggerFlare(), undefined, hitS + FILL_S * 0.5);
  };

  const rebuild = (
    tiles: XZ[],
    size: number,
    hexHeight: number,
    hexMesh: InstancedMesh,
  ) => {
    currentHexHeight = hexHeight;
    flareSize = size * 3.2;
    styleFromParams();
    centerMesh.geometry = hexGeo;
    centerMesh.position.set(0, 0, 0);
    centerLight.position.set(0, Math.max(0.035, hexHeight * 0.8), 0);

    floorMesh = hexMesh;
    floorTiles = tiles;
    glowAttr = hexMesh.geometry.getAttribute("aGlow") ?? null;
    const hexMat = hexMesh.material as MeshPhysicalMaterial;
    glowStrength = (hexMat.userData?.glowStrength as { value: number }) ?? null;
    riseState.clear();
    activeTiles.clear();

    ringTiles = [];
    maxRing = 1;
    for (let i = 0; i < tiles.length; i += 1) {
      const a = worldToAxial(tiles[i].x, tiles[i].z, size);
      const ring = hexRing(a.q, a.r);
      if (ring > maxRing) maxRing = ring;
      let bucket = ringTiles[ring];
      if (!bucket) {
        bucket = [];
        ringTiles[ring] = bucket;
      }
      bucket.push(i);
    }

    play();
  };

  let lastSpeed = getParams().waveSpeed;

  const applySettings = () => {
    styleFromParams();
    const speed = getParams().waveSpeed;
    if (Math.abs(speed - lastSpeed) > 1e-3) {
      lastSpeed = speed;
      play();
      return;
    }
    applyCenter();
  };

  const pause = () => {
    timeline?.pause();
    flareTween?.pause();
  };

  const resume = () => {
    timeline?.resume();
    flareTween?.resume();
  };

  const dispose = () => {
    timeline?.kill();
    timeline = null;
    flareTween?.kill();
    flareTween = null;
    riseState.clear();
    activeTiles.clear();
    floorMesh = null;
    glowAttr = null;
    glowStrength = null;
    flareGeo.dispose();
    flareMat.dispose();
    flareTexture.dispose();
    centerMat.dispose();
  };

  return { group, centerMesh, rebuild, applySettings, update, pause, resume, dispose };
}

function createFlareTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);
  const cx = size / 2;
  const cy = size / 2;

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  core.addColorStop(0, "rgba(255,235,225,1)");
  core.addColorStop(0.15, "rgba(255,150,120,0.9)");
  core.addColorStop(0.4, "rgba(255,38,38,0.45)");
  core.addColorStop(1, "rgba(255,38,38,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "lighter";
  const spikeCount = 10;
  for (let i = 0; i < spikeCount; i += 1) {
    const angle = (Math.PI * 2 * i) / spikeCount + Math.random() * 0.12;
    const len = size * 0.5 * (0.55 + Math.random() * 0.45);
    const w = size * 0.01 * (0.6 + Math.random());
    const grad = ctx.createLinearGradient(
      cx,
      cy,
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len,
    );
    grad.addColorStop(0, "rgba(255,210,190,0.9)");
    grad.addColorStop(0.5, "rgba(255,60,50,0.5)");
    grad.addColorStop(1, "rgba(255,38,38,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }

  const axes = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  for (const angle of axes) {
    const len = size * 0.62;
    const grad = ctx.createLinearGradient(
      cx - Math.cos(angle) * len,
      cy - Math.sin(angle) * len,
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len,
    );
    grad.addColorStop(0, "rgba(255,60,50,0)");
    grad.addColorStop(0.5, "rgba(255,225,210,0.95)");
    grad.addColorStop(1, "rgba(255,60,50,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = size * 0.015;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * len, cy - Math.sin(angle) * len);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

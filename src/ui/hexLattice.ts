const SQRT3 = Math.sqrt(3);

export const WAVE_COLOR = 0xff2626;

export type Axial = { q: number; r: number };
export type XZ = { x: number; z: number };

export function axialToWorld(q: number, r: number, size: number): XZ {
  return {
    x: size * SQRT3 * (q + r * 0.5),
    z: size * 1.5 * r,
  };
}

export function worldToAxial(x: number, z: number, size: number): Axial {
  const r = z / (1.5 * size);
  const q = x / (size * SQRT3) - r * 0.5;
  return axialRound(q, r);
}

export function axialRound(q: number, r: number): Axial {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/** Ring index of a tile: how many hex steps it sits from the origin. */
export function hexRing(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

export function isOriginHex(p: XZ, size: number): boolean {
  const a = worldToAxial(p.x, p.z, size);
  return a.q === 0 && a.r === 0;
}

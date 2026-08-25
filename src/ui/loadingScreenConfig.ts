/** Saved loader scene knobs. Edit by hand or use Save on the debug panel. */

export type Vec3 = [number, number, number];

export type LoaderParams = {
  hexEdge: number;
  hexHeight: number;
  hexGap: number;
  exposure: number;
  envIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  topIntensity: number;
  topPos: Vec3;
  leftIntensity: number;
  leftPos: Vec3;
  rightIntensity: number;
  rightPos: Vec3;
  backIntensity: number;
  backPos: Vec3;
  frontIntensity: number;
  frontPos: Vec3;
  camDistance: number;
  camElevation: number;
  camAzimuth: number;
  camFov: number;
  waveWidth: number;
  waveIntensity: number;
  waveSpeed: number;
  riseFactor: number;
  riseSpeed: number;
  centerHexEdge: number;
  /** Speed of the post-flare dolly-zoom push into the centre hex. */
  dollySpeed: number;
  bloomRadius: number;
  bloomThreshold: number;
};

export const loadingScreenConfig: LoaderParams = {
  hexEdge: 0.69,
  hexHeight: 0.28,
  hexGap: 0.32,
  exposure: 0.17,
  envIntensity: 0.26,
  hemiIntensity: 4.2,
  ambientIntensity: 0,
  topIntensity: 0.3,
  topPos: [-4.5, 54, 51],
  leftIntensity: 2.65,
  leftPos: [42.5, 31.5, 12],
  rightIntensity: 0.9,
  rightPos: [-41.5, 28, 12],
  backIntensity: 0.3,
  backPos: [0, 11.5, -36],
  frontIntensity: 0,
  frontPos: [0, 18, 36],
  camDistance: 48,
  camElevation: 44.7876,
  camAzimuth: 0,
  camFov: 15,
  waveWidth: 1.2,
  waveIntensity: 3,
  waveSpeed: 23.5,
  riseFactor: 5,
  riseSpeed: 11,
  centerHexEdge: 0.77,
  dollySpeed: 1,
  bloomRadius: 1,
  bloomThreshold: 1,
};

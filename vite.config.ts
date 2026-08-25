import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const loaderConfigPath = path.join(rootDir, "src/ui/loadingScreenConfig.ts");

function round(value: number): number {
  return Number(Number(value).toFixed(4));
}

function formatVec(v: unknown): string {
  if (!Array.isArray(v) || v.length !== 3) {
    throw new Error("Invalid vec3");
  }
  return `[${round(Number(v[0]))}, ${round(Number(v[1]))}, ${round(Number(v[2]))}]`;
}

function formatLoaderConfig(data: Record<string, unknown>): string {
  return `/** Saved loader scene knobs. Edit by hand or use Save on the debug panel. */

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
  dollySpeed: number;
  bloomRadius: number;
  bloomThreshold: number;
};

export const loadingScreenConfig: LoaderParams = {
  hexEdge: ${round(Number(data.hexEdge))},
  hexHeight: ${round(Number(data.hexHeight))},
  hexGap: ${round(Number(data.hexGap))},
  exposure: ${round(Number(data.exposure))},
  envIntensity: ${round(Number(data.envIntensity))},
  hemiIntensity: ${round(Number(data.hemiIntensity))},
  ambientIntensity: ${round(Number(data.ambientIntensity))},
  topIntensity: ${round(Number(data.topIntensity))},
  topPos: ${formatVec(data.topPos)},
  leftIntensity: ${round(Number(data.leftIntensity))},
  leftPos: ${formatVec(data.leftPos)},
  rightIntensity: ${round(Number(data.rightIntensity))},
  rightPos: ${formatVec(data.rightPos)},
  backIntensity: ${round(Number(data.backIntensity))},
  backPos: ${formatVec(data.backPos)},
  frontIntensity: ${round(Number(data.frontIntensity))},
  frontPos: ${formatVec(data.frontPos)},
  camDistance: ${round(Number(data.camDistance))},
  camElevation: ${round(Number(data.camElevation))},
  camAzimuth: ${round(Number(data.camAzimuth))},
  camFov: ${round(Number(data.camFov))},
  waveWidth: ${round(Number(data.waveWidth))},
  waveIntensity: ${round(Number(data.waveIntensity))},
  waveSpeed: ${round(Number(data.waveSpeed))},
  riseFactor: ${round(Number(data.riseFactor))},
  riseSpeed: ${round(Number(data.riseSpeed))},
  centerHexEdge: ${round(Number(data.centerHexEdge))},
  dollySpeed: ${round(Number(data.dollySpeed))},
  bloomRadius: ${round(Number(data.bloomRadius))},
  bloomThreshold: ${round(Number(data.bloomThreshold))},
};
`;
}

function saveLoaderConfigPlugin(): Plugin {
  return {
    name: "save-loader-config",
    configureServer(server) {
      server.middlewares.use("/__save-loader-config", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        req.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            const data = JSON.parse(raw) as Record<string, unknown>;
            fs.writeFileSync(loaderConfigPath, formatLoaderConfig(data), "utf8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/plain");
            res.end("saved");
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain");
            res.end(error instanceof Error ? error.message : "save failed");
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/aravind-portfolio/" : "/",
  plugins: [saveLoaderConfigPlugin()],
  server: {
    port: 5173,
  },
}));

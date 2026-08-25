import {
  HEX_FILL,
  HEX_HIGHLIGHT,
  HEX_SIZE_PX,
  SQRT3,
  hexFillColor,
  hexFits,
  hexTint,
  hexVertexAngle,
  readCssColor,
  traceHex,
} from "../hex/hexGridConfig";
import {
  EMBER_CHARACTERS,
  EMBER_FONT_STACK,
  randomEmberCharIndex,
} from "../embers/emberCharacters";

/**
 * Gap between hexes on the loading canvas, in pixels.
 * Increase this to space the honeycomb out. Snake width is always 4px smaller.
 */
const LOADING_HEX_GAP_PX = 6;

const LOADING_COL_W = SQRT3 * HEX_SIZE_PX + LOADING_HEX_GAP_PX;
const LOADING_ROW_H = 1.5 * HEX_SIZE_PX + LOADING_HEX_GAP_PX;
const LOADING_RING_R = HEX_SIZE_PX + LOADING_HEX_GAP_PX / SQRT3;
const SNAKE_WIDTH_PX = Math.max(0.5, LOADING_HEX_GAP_PX - 4);

const SNAKE_COUNT = 380;
const TRAVEL_MS = 2500;
/** Brief hold after snakes reach the meshed center hex. */
const HOLD_MS = 280;
/** Zoom from full grid until mesh snakes become ember character rows. */
const ZOOM_IN_MS = 3200;
/** Short settle on the full-screen ember mesh before clearing the canvas bg. */
const EMBER_HOLD_MS = 150;
/** Slow fade: canvas blackish fill → transparent over the live page. */
const BG_FADE_MS = 300;
/** After bg is clear, ease out remaining ember graphics. */
const FADE_MS = 1500;
const ZOOM_START_MS = TRAVEL_MS + HOLD_MS;
const EMBER_HOLD_START_MS = ZOOM_START_MS + ZOOM_IN_MS;
const BG_FADE_START_MS = EMBER_HOLD_START_MS + EMBER_HOLD_MS;
const FADE_START_MS = BG_FADE_START_MS + BG_FADE_MS;
const TOTAL_MS = FADE_START_MS + FADE_MS;
const SNAKE_LEN_PX = 100;
const MAX_STAGGER_MS = 380;
const NODE_QUANT = 10;
/** Outer hex rings (from the screen edge) charged with laser color at start. */
const EDGE_CHARGE_LAYERS = 5;
/** How quickly a charged hex finishes draining once its snake tail has passed. */
const EDGE_DRAIN_PER_FRAME = 0.45;

/**
 * Fine hex lattice inside the center cell. Thin snakes (~1/12 outer width)
 * fill the hex so it reads solid from afar; zoom reveals the gaps.
 */
const MESH_CELL_PX = HEX_SIZE_PX / 10;
const MESH_SNAKE_WIDTH_PX = SNAKE_WIDTH_PX / 12;
/** Empty hole left in the mesh for the final zoom-through. */
const MESH_GAP_R = MESH_CELL_PX * 1.35;
/** Three stacked grids; lower layers rotated + translated so each reads clearly. */
const MESH_LAYERS = 3;
/**
 * Back → front rotations. Avoid 60° (hex lattice maps onto itself).
 * 30° / 15° / 0° keeps three distinct orientations.
 */
const MESH_LAYER_ANGLES = [Math.PI / 6, Math.PI / 12, 0];
/**
 * Back → front world-space offsets (multiples of cell size) so the third
 * layer isn't buried under the others.
 */
const MESH_LAYER_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: -0.42, y: -0.38 },
  { x: 0.36, y: -0.28 },
  { x: 0, y: 0 },
];
/** Fraction of lattice edges kept (incomplete honeycomb). */
const MESH_EDGE_KEEP = 0.82;

/** Parallel ember rows packed across each mesh snake. */
const MESH_EMBER_LINES = 5;
/** Match dustScene in-place glyph flicker rate. */
const MESH_EMBER_FLICKER = 0.08;
/**
 * Screen-space snake thickness where solid mesh starts dissolving into glyphs.
 * Full morph once the inner mesh fills the frame like the deep-zoom hold.
 */
const MESH_EMBER_MORPH_START_PX = 18;
const MESH_EMBER_MORPH_FULL_PX = 38;
/** Screen-space border between outer lasers and the center mesh. */
const CENTER_HEX_BORDER_PX = 18;
/** Extra glyph size on the loading mesh embers only (not dustScene). */
const MESH_EMBER_FONT_EXTRA_PX = 4;
/** How many front mesh layers morph into ember characters. */
const MESH_EMBER_LAYERS = 2;
/** Atlas cell size for fast drawImage glyphs (avoids fillText per frame). */
const EMBER_ATLAS_CELL = 64;
const EMBER_ATLAS_COLS = 16;

type Vec = { x: number; y: number };

type GraphNode = {
  x: number;
  y: number;
  nbs: number[];
};

type Snake = {
  xs: Float32Array;
  ys: Float32Array;
  cum: Float32Array;
  total: number;
  delay: number;
  duration: number;
};

type HexCell = {
  col: number;
  row: number;
  x: number;
  y: number;
  tint: number;
  /** 0..EDGE_CHARGE_LAYERS-1 if in the charged outer ring, else -1. */
  edgeLayer: number;
  /** 0 = full laser charge, 1 = drained to base fill. */
  drain: number;
  /**
   * Snakes whose paths pass this hex, with the path distance at contact.
   * Drains once any listed snake's tail moves past its distance.
   */
  passList: Array<{ s: number; d: number }> | null;
};

/** One mesh snake edge with 5 parallel ember rows (chars swap in place). */
type MeshEdgeEmber = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  len: number;
  angle: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  slots: number;
  chars: Uint16Array;
};

/**
 * Vector hex lattice for the center cell. Stroked live under the camera so
 * zoom stays sharp (a baked bitmap blurs once scaled past its resolution).
 */
type CenterMesh = {
  path: Path2D;
  edges: MeshEdgeEmber[];
  gapR: number;
  clipR: number;
  cell: number;
};

type EmberAtlas = {
  canvas: HTMLCanvasElement;
  cell: number;
  cols: number;
};

export function setupLoadingScreen(): Promise<void> {
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

    const ctx = canvas.getContext("2d");
    let removePauseHotkey: (() => void) | null = null;
    const abort = () => {
      cancelAnimationFrame(raf);
      removePauseHotkey?.();
      overlay.remove();
      document.documentElement.classList.remove("is-loading");
      document.body.classList.remove("is-loading");
      resolve();
    };
    let raf = 0;
    if (!ctx) {
      abort();
      return;
    }

    try {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = readCssColor("--bg", HEX_FILL);
    const accent = readCssColor("--accent", HEX_HIGHLIGHT);
    const accentRgb = cssToRgb(accent);
    const bgRgb = cssToRgb(bg);
    // Page stays visible underneath; canvas paints its own opaque cover early on.
    overlay.style.background = "transparent";

    const cells = buildCells(width, height);
    const center = pickCenterHex(cells, width, height);
    const { nodes, goals, hexVerts } = buildGapGraph(width, height, center);
    const snakes = spawnSnakes(nodes, goals, hexVerts, cells, center);
    bindEdgeDrainToSnakes(cells, snakes);
    const mesh = buildCenterMesh(center);
    const emberAtlas = createEmberAtlas(accent);

    // Ember framing zoom — stay here and fade over the page (no empty-hole flash).
    const zoomEmber = Math.max(
      MESH_EMBER_MORPH_FULL_PX / Math.max(MESH_SNAKE_WIDTH_PX, 0.0001),
      zoomHexFill(width, height) * 1.35,
    );
    const zoomMax = zoomEmber;

    const sample = { x: 0, y: 0 };
    let activeCells = cells;
    /** Settled laser trails as one Path2D — stroked live so zoom stays sharp. */
    let settledSnakes: Path2D | null = null;
    let fading = false;
    let paused = false;
    let pauseStartedAt = 0;
    let pausedTotalMs = 0;
    const start = performance.now();

    const elapsed = (now: number) => now - start - pausedTotalMs;

    const finish = () => {
      cancelAnimationFrame(raf);
      removePauseHotkey?.();
      overlay.remove();
      document.documentElement.classList.remove("is-loading");
      document.body.classList.remove("is-loading");
      resolve();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      event.preventDefault();
      if (paused) {
        pausedTotalMs += performance.now() - pauseStartedAt;
        paused = false;
      } else {
        paused = true;
        pauseStartedAt = performance.now();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    removePauseHotkey = () => window.removeEventListener("keydown", onKeyDown);

    const tick = (now: number) => {
      if (paused) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const t = elapsed(now);
      const zoom = cameraZoom(t, zoomMax, zoomEmber);

      if (t >= TRAVEL_MS && !settledSnakes) {
        settledSnakes = buildUniqueLaserPath(snakes, true, t, sample);
        activeCells = cells;
      }

      // Drop hexes that have left the viewport while zooming.
      if (t >= ZOOM_START_MS && activeCells.length > 1) {
        activeCells = cullVisibleCells(activeCells, center, zoom, width, height);
      }

      // Canvas bg stays solid until the ember mesh fills the screen, then
      // slowly clears to show the page underneath (embers stay on top).
      const pageReveal = pageRevealAmount(t);
      const graphicsFade = graphicsFadeAmount(t);

      drawFrame(ctx, {
        t,
        width,
        height,
        bg,
        bgRgb,
        accent,
        accentRgb,
        cells: activeCells,
        center,
        snakes,
        mesh,
        emberAtlas,
        settledSnakes,
        zoomMax,
        zoomEmber,
        pageReveal,
        graphicsFade,
        sample,
      });

      if (t >= FADE_START_MS && !fading) {
        fading = true;
        document.documentElement.classList.remove("is-loading");
        document.body.classList.remove("is-loading");
      }
      if (t >= TOTAL_MS) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    drawFrame(ctx, {
      t: 0,
      width,
      height,
      bg,
      bgRgb,
      accent,
      accentRgb,
      cells: activeCells,
      center,
      snakes,
      mesh,
      emberAtlas,
      settledSnakes,
      zoomMax,
      zoomEmber,
      pageReveal: 0,
      graphicsFade: 1,
      sample,
    });
    raf = requestAnimationFrame(tick);
    } catch {
      abort();
    }
  });
}

function loadingHexCenter(col: number, row: number): { x: number; y: number } {
  const offset = row % 2 === 0 ? 0 : LOADING_COL_W / 2;
  return { x: col * LOADING_COL_W + offset, y: row * LOADING_ROW_H };
}

function buildCells(width: number, height: number): HexCell[] {
  const cols = Math.ceil(width / LOADING_COL_W) + 2;
  const rows = Math.ceil(height / LOADING_ROW_H) + 2;
  const cells: HexCell[] = [];
  for (let row = -1; row < rows; row += 1) {
    for (let col = -1; col < cols; col += 1) {
      const { x, y } = loadingHexCenter(col, row);
      if (!hexFits(x, y, HEX_SIZE_PX, width, height, 0)) continue;
      cells.push({
        col,
        row,
        x,
        y,
        tint: hexTint(col, row),
        edgeLayer: -1,
        drain: 0,
        passList: null,
      });
    }
  }
  markEdgeChargeLayers(cells, width, height);
  return cells;
}

/** Tag hexes in the outer N rings measured from the viewport edge. */
function markEdgeChargeLayers(
  cells: HexCell[],
  width: number,
  height: number,
): void {
  const pitch = (LOADING_COL_W + LOADING_ROW_H) * 0.5;
  for (const cell of cells) {
    const dist = Math.min(
      cell.x,
      cell.y,
      width - cell.x,
      height - cell.y,
    );
    const layer = Math.floor(Math.max(0, dist) / Math.max(pitch, 0.0001));
    cell.edgeLayer = layer < EDGE_CHARGE_LAYERS ? layer : -1;
    cell.drain = 0;
    cell.passList = null;
  }
}

/**
 * Bind each charged edge hex to nearby snake paths.
 * When any bound snake's tail moves past the contact distance, the hex drains.
 */
function bindEdgeDrainToSnakes(cells: HexCell[], snakes: Snake[]): void {
  // Hex centers sit off the gap-lattice paths — reach across a couple cells.
  const radius =
    Math.max(LOADING_COL_W, LOADING_ROW_H) * 1.85 + HEX_SIZE_PX;
  const r2 = radius * radius;

  for (const cell of cells) {
    if (cell.edgeLayer < 0) continue;
    const hits: Array<{ s: number; d: number }> = [];

    for (let s = 0; s < snakes.length; s += 1) {
      const { xs, ys, cum } = snakes[s];
      let best = Infinity;

      for (let i = 0; i < xs.length; i += 1) {
        const dx = cell.x - xs[i];
        const dy = cell.y - ys[i];
        if (dx * dx + dy * dy > r2) continue;
        if (cum[i] < best) best = cum[i];
      }
      for (let i = 1; i < xs.length; i += 1) {
        const mx = (xs[i - 1] + xs[i]) * 0.5;
        const my = (ys[i - 1] + ys[i]) * 0.5;
        const dx = cell.x - mx;
        const dy = cell.y - my;
        if (dx * dx + dy * dy > r2) continue;
        const midCum = (cum[i - 1] + cum[i]) * 0.5;
        if (midCum < best) best = midCum;
      }

      if (best < Infinity) hits.push({ s, d: best });
    }

    cell.passList = hits.length > 0 ? hits : null;
  }
}

/**
 * Drain charged hexes once any bound snake's tail has moved past them.
 */
function updateEdgeDrain(cells: HexCell[], snakes: Snake[], t: number): void {
  if (t >= TRAVEL_MS) {
    for (const cell of cells) {
      if (cell.edgeLayer >= 0) cell.drain = 1;
    }
    return;
  }

  const tailDists = new Float32Array(snakes.length);
  for (let s = 0; s < snakes.length; s += 1) {
    const snake = snakes[s];
    const local = (t - snake.delay) / snake.duration;
    if (local <= 0) {
      tailDists[s] = -1;
      continue;
    }
    const p = local >= 1 ? 1 : easeInOutCubic(local);
    const headDist = p * snake.total;
    tailDists[s] = Math.max(0, headDist - SNAKE_LEN_PX);
  }

  for (const cell of cells) {
    if (cell.edgeLayer < 0 || cell.drain >= 1) continue;
    const list = cell.passList;
    if (!list) continue;

    let passed = false;
    for (let i = 0; i < list.length; i += 1) {
      const { s, d } = list[i];
      const tailDist = tailDists[s];
      // Strictly past: spawn hexes (d≈0) wait until the tail starts moving.
      if (tailDist > d) {
        passed = true;
        break;
      }
    }
    if (!passed) continue;
    cell.drain = Math.min(1, cell.drain + EDGE_DRAIN_PER_FRAME);
  }
}

/** Accent-charged edge hex → base fill as drain goes 0→1. */
function cellFillStyle(
  cell: HexCell,
  accentRgb: [number, number, number],
): string {
  if (cell.edgeLayer < 0 || cell.drain >= 0.995) {
    return hexFillColor(cell.tint);
  }
  const base = cssToRgb(hexFillColor(cell.tint));
  const u = cell.drain;
  const r = Math.round(accentRgb[0] + (base[0] - accentRgb[0]) * u);
  const g = Math.round(accentRgb[1] + (base[1] - accentRgb[1]) * u);
  const b = Math.round(accentRgb[2] + (base[2] - accentRgb[2]) * u);
  return `rgb(${r},${g},${b})`;
}

function pickCenterHex(cells: HexCell[], width: number, height: number): HexCell {
  const cx = width / 2;
  const cy = height / 2;
  if (cells.length === 0) {
    return {
      col: 0,
      row: 0,
      x: cx,
      y: cy,
      tint: 0,
      edgeLayer: -1,
      drain: 1,
      passList: null,
    };
  }
  let best = cells[0];
  let bestD = Infinity;
  for (const cell of cells) {
    const d = (cell.x - cx) ** 2 + (cell.y - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function nodeKey(x: number, y: number): string {
  return `${Math.round(x * NODE_QUANT)},${Math.round(y * NODE_QUANT)}`;
}

function neighborOffsets(row: number): Array<[number, number]> {
  return row % 2 === 0
    ? [
        [1, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
      ]
    : [
        [1, 0],
        [-1, 0],
        [1, -1],
        [0, -1],
        [1, 1],
        [0, 1],
      ];
}

function buildGapGraph(
  width: number,
  height: number,
  center: HexCell,
): { nodes: GraphNode[]; goals: Set<number>; hexVerts: Map<string, number[]> } {
  const cols = Math.ceil(width / LOADING_COL_W) + 4;
  const rows = Math.ceil(height / LOADING_ROW_H) + 4;
  const indexOf = new Map<string, number>();
  const nodes: GraphNode[] = [];
  const hexVerts = new Map<string, number[]>();

  const intern = (x: number, y: number): number => {
    const key = nodeKey(x, y);
    const existing = indexOf.get(key);
    if (existing !== undefined) return existing;
    const id = nodes.length;
    indexOf.set(key, id);
    nodes.push({ x, y, nbs: [] });
    return id;
  };

  const link = (a: number, b: number) => {
    if (a === b) return;
    if (!nodes[a].nbs.includes(b)) nodes[a].nbs.push(b);
    if (!nodes[b].nbs.includes(a)) nodes[b].nbs.push(a);
  };

  for (let row = -2; row < rows; row += 1) {
    for (let col = -2; col < cols; col += 1) {
      const { x, y } = loadingHexCenter(col, row);
      const ids = new Array<number>(6);
      for (let i = 0; i < 6; i += 1) {
        const a = hexVertexAngle(i);
        ids[i] = intern(
          x + LOADING_RING_R * Math.cos(a),
          y + LOADING_RING_R * Math.sin(a),
        );
      }
      for (let i = 0; i < 6; i += 1) {
        link(ids[i], ids[(i + 1) % 6]);
      }
      hexVerts.set(cellKey(col, row), ids);
    }
  }

  const bridge = LOADING_ROW_H * 0.85;
  for (const [key, ids] of hexVerts) {
    const comma = key.indexOf(",");
    const col = Number(key.slice(0, comma));
    const row = Number(key.slice(comma + 1));
    for (const [dc, dr] of neighborOffsets(row)) {
      const nIds = hexVerts.get(cellKey(col + dc, row + dr));
      if (!nIds) continue;
      for (let i = 0; i < 6; i += 1) {
        let best = -1;
        let bestD = bridge;
        const ax = nodes[ids[i]].x;
        const ay = nodes[ids[i]].y;
        for (let j = 0; j < 6; j += 1) {
          const d = Math.hypot(ax - nodes[nIds[j]].x, ay - nodes[nIds[j]].y);
          if (d > 0.45 && d < bestD) {
            bestD = d;
            best = j;
          }
        }
        if (best >= 0) link(ids[i], nIds[best]);
      }
    }
  }

  const centerIds = hexVerts.get(cellKey(center.col, center.row)) ?? [];
  return { nodes, goals: new Set(centerIds), hexVerts };
}

function spawnSnakes(
  nodes: GraphNode[],
  goals: Set<number>,
  hexVerts: Map<string, number[]>,
  cells: HexCell[],
  center: HexCell,
): Snake[] {
  const starts = pickEdgeSpawnNodes(nodes, hexVerts, cells);
  const snakes: Snake[] = [];
  const goalList = [...goals];

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    const spawn = nodes[start];
    const goal =
      nearestGoal(spawn, goalList, nodes) ??
      goalList[s % Math.max(1, goalList.length)];
    const pathIds =
      (goal !== undefined
        ? bfsPath(nodes, start, new Set([goal]), s + 1)
        : null) ?? bfsPath(nodes, start, goals, s + 1);
    if (!pathIds || pathIds.length < 2) continue;

    // Extend into the center hex so snakes visually enter it.
    const pts: Array<{ x: number; y: number }> = pathIds.map((id) => ({
      x: nodes[id].x,
      y: nodes[id].y,
    }));
    const last = pts[pts.length - 1];
    const midX = last.x + (center.x - last.x) * 0.55;
    const midY = last.y + (center.y - last.y) * 0.55;
    pts.push({ x: midX, y: midY });
    pts.push({ x: center.x, y: center.y });

    const xs = new Float32Array(pts.length);
    const ys = new Float32Array(pts.length);
    const cum = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i += 1) {
      xs[i] = pts[i].x;
      ys[i] = pts[i].y;
      if (i > 0) {
        cum[i] =
          cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
      }
    }
    const delay =
      (s / Math.max(1, SNAKE_COUNT - 1)) * MAX_STAGGER_MS * 0.35 +
      Math.random() * MAX_STAGGER_MS * 0.65;
    snakes.push({
      xs,
      ys,
      cum,
      total: Math.max(cum[cum.length - 1], 1),
      delay,
      duration: TRAVEL_MS - delay,
    });
  }
  return snakes;
}

function pickEdgeSpawnNodes(
  nodes: GraphNode[],
  hexVerts: Map<string, number[]>,
  cells: HexCell[],
): number[] {
  if (cells.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    if (cell.x < minX) minX = cell.x;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.y > maxY) maxY = cell.y;
  }

  const bandX = LOADING_COL_W * 0.8;
  const bandY = LOADING_ROW_H * 0.8;
  const buckets: HexCell[][] = [[], [], [], []];
  for (const cell of cells) {
    const dTop = cell.y - minY;
    const dRight = maxX - cell.x;
    const dBottom = maxY - cell.y;
    const dLeft = cell.x - minX;
    const nearest = Math.min(dTop, dRight, dBottom, dLeft);
    if (nearest === dTop && dTop <= bandY) buckets[0].push(cell);
    else if (nearest === dRight && dRight <= bandX) buckets[1].push(cell);
    else if (nearest === dBottom && dBottom <= bandY) buckets[2].push(cell);
    else if (nearest === dLeft && dLeft <= bandX) buckets[3].push(cell);
  }

  const counts = splitCounts(SNAKE_COUNT, [1, 1, 1, 1]);
  const outward: Array<(n: GraphNode) => number> = [
    (n) => -n.y,
    (n) => n.x,
    (n) => n.y,
    (n) => -n.x,
  ];
  const along: Array<(c: HexCell) => number> = [
    (c) => c.x,
    (c) => c.y,
    (c) => c.x,
    (c) => c.y,
  ];

  const picked: number[] = [];
  const used = new Set<number>();

  for (let edge = 0; edge < 4; edge += 1) {
    const hexes = [...buckets[edge]].sort(
      (a, b) => along[edge](a) - along[edge](b),
    );
    const chosen = spacedItems(hexes, counts[edge]);
    for (const hex of chosen) {
      const ids = hexVerts.get(cellKey(hex.col, hex.row));
      if (!ids) continue;
      let best = -1;
      let bestScore = -Infinity;
      for (const id of ids) {
        if (used.has(id)) continue;
        const score = outward[edge](nodes[id]);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best < 0 || used.has(best)) continue;
      used.add(best);
      picked.push(best);
    }
  }

  if (picked.length < SNAKE_COUNT) {
    const extras = [...cells].sort((a, b) => {
      const da = Math.min(a.y - minY, maxY - a.y, a.x - minX, maxX - a.x);
      const db = Math.min(b.y - minY, maxY - b.y, b.x - minX, maxX - b.x);
      return da - db;
    });
    for (const hex of extras) {
      if (picked.length >= SNAKE_COUNT) break;
      const ids = hexVerts.get(cellKey(hex.col, hex.row));
      if (!ids) continue;
      for (const id of ids) {
        if (used.has(id)) continue;
        used.add(id);
        picked.push(id);
        break;
      }
    }
  }

  return picked.slice(0, SNAKE_COUNT);
}

function spacedItems<T>(items: T[], count: number): T[] {
  if (items.length === 0 || count <= 0) return [];
  if (items.length <= count) return items;
  const picks: T[] = [];
  const seen = new Set<number>();
  for (let k = 0; k < count; k += 1) {
    const t = count === 1 ? 0.5 : k / (count - 1);
    let idx = Math.round(t * (items.length - 1));
    while (seen.has(idx) && idx < items.length - 1) idx += 1;
    while (seen.has(idx) && idx > 0) idx -= 1;
    if (seen.has(idx)) continue;
    seen.add(idx);
    picks.push(items[idx]);
  }
  return picks;
}

function splitCounts(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const counts = raw.map((v) => Math.floor(v));
  const remain = total - counts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remain; k += 1) counts[order[k % order.length].i] += 1;
  return counts;
}

function nearestGoal(
  spawn: GraphNode,
  goalList: number[],
  nodes: GraphNode[],
): number | null {
  if (goalList.length === 0) return null;
  let best = goalList[0];
  let bestD = Infinity;
  for (const id of goalList) {
    const g = nodes[id];
    const d = (g.x - spawn.x) ** 2 + (g.y - spawn.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function bfsPath(
  nodes: GraphNode[],
  start: number,
  goals: Set<number>,
  salt = 1,
): number[] | null {
  if (goals.has(start)) return [start];
  const prev = new Int32Array(nodes.length).fill(-1);
  const seen = new Uint8Array(nodes.length);
  const q = [start];
  seen[start] = 1;
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++];
    const nbs = nodes[u].nbs;
    const len = nbs.length;
    const rot = len > 0 ? (u * 13 + salt * 7) % len : 0;
    for (let k = 0; k < len; k += 1) {
      const v = nbs[(k + rot) % len];
      if (seen[v]) continue;
      seen[v] = 1;
      prev[v] = u;
      if (goals.has(v)) {
        const path = [v];
        let cur = v;
        while (cur !== start) {
          cur = prev[cur];
          path.push(cur);
        }
        path.reverse();
        return path;
      }
      q.push(v);
    }
  }
  return null;
}

function cssToRgb(color: string): [number, number, number] {
  const hex = color.trim();
  if (hex.startsWith("#")) {
    const raw = hex.slice(1);
    if (raw.length === 3) {
      return [
        parseInt(raw[0] + raw[0], 16),
        parseInt(raw[1] + raw[1], 16),
        parseInt(raw[2] + raw[2], 16),
      ];
    }
    if (raw.length >= 6) {
      return [
        parseInt(raw.slice(0, 2), 16),
        parseInt(raw.slice(2, 4), 16),
        parseInt(raw.slice(4, 6), 16),
      ];
    }
  }
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return [42, 40, 47];
  probe.fillStyle = color;
  const m = String(probe.fillStyle).match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return [42, 40, 47];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function sampleAt(
  snake: Snake,
  dist: number,
  out: Vec,
): void {
  const { xs, ys, cum, total } = snake;
  if (total <= 0 || xs.length === 0) {
    out.x = xs[0] ?? 0;
    out.y = ys[0] ?? 0;
    return;
  }
  const d = dist < 0 ? 0 : dist > total ? total : dist;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const span = cum[i] - cum[i - 1];
  const u = span > 0.0001 ? (d - cum[i - 1]) / span : 0;
  out.x = xs[i - 1] + (xs[i] - xs[i - 1]) * u;
  out.y = ys[i - 1] + (ys[i] - ys[i - 1]) * u;
}

function pointInHex(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const dx = (px - cx) / r;
  const dy = (py - cy) / r;
  const q = (SQRT3 / 3) * dx - (1 / 3) * dy;
  const rr = (2 / 3) * dy;
  const s = -q - rr;
  return Math.max(Math.abs(q), Math.abs(rr), Math.abs(s)) <= 1.02;
}
/**
 * One Path2D hex lattice; layers apply rotate + translate at draw time.
 * Vector strokes stay sharp at any zoom (unlike a scaled bitmap).
 * Ember rows are stored per edge and only drawn when that snake is on-screen.
 */
function buildCenterMesh(center: HexCell): CenterMesh {
  const clipR = HEX_SIZE_PX * 0.98;
  const { path, edges } = buildHexGridLayer(
    center.x,
    center.y,
    clipR,
    MESH_CELL_PX,
    MESH_GAP_R,
  );
  return {
    path,
    edges,
    gapR: MESH_GAP_R,
    clipR,
    cell: MESH_CELL_PX,
  };
}

function buildHexGridLayer(
  cx: number,
  cy: number,
  clipR: number,
  cell: number,
  gapR: number,
): { path: Path2D; edges: MeshEdgeEmber[] } {
  const path = new Path2D();
  const edges: MeshEdgeEmber[] = [];
  const colW = SQRT3 * cell;
  const rowH = 1.5 * cell;
  const span = Math.ceil((clipR * 2.2) / cell) + 2;
  const seen = new Set<string>();
  const quant = (v: number) => Math.round(v * 1000);
  const font = MESH_SNAKE_WIDTH_PX / 5.4;
  // Slightly wider spacing → fewer glyphs, still reads as dense rows when zoomed.
  const gap = Math.max(font * 1.35, MESH_SNAKE_WIDTH_PX * 0.28);

  const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
    const d0 = Math.hypot(x0 - cx, y0 - cy);
    const d1 = Math.hypot(x1 - cx, y1 - cy);
    if (d0 < gapR && d1 < gapR) return;
    if (
      !pointInHex(x0, y0, cx, cy, clipR) ||
      !pointInHex(x1, y1, cx, cy, clipR)
    ) {
      return;
    }

    const qa0 = quant(x0);
    const qb0 = quant(y0);
    const qa1 = quant(x1);
    const qb1 = quant(y1);
    const key =
      qa0 < qa1 || (qa0 === qa1 && qb0 <= qb1)
        ? `${qa0},${qb0}:${qa1},${qb1}`
        : `${qa1},${qb1}:${qa0},${qb0}`;
    if (seen.has(key)) return;
    seen.add(key);
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);

    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return;
    const ux = dx / len;
    const uy = dy / len;
    const slots = Math.max(1, Math.round(len / gap));
    const chars = new Uint16Array(MESH_EMBER_LINES * slots);
    for (let i = 0; i < chars.length; i += 1) {
      chars[i] = randomEmberCharIndex();
    }
    edges.push({
      x0,
      y0,
      x1,
      y1,
      len,
      angle: Math.atan2(dy, dx),
      ux,
      uy,
      nx: -uy,
      ny: ux,
      slots,
      chars,
    });
  };

  for (let row = -span; row <= span; row += 1) {
    const offset = row % 2 === 0 ? 0 : colW / 2;
    for (let col = -span; col <= span; col += 1) {
      const hx = cx + col * colW + offset;
      const hy = cy + row * rowH;
      if (!pointInHex(hx, hy, cx, cy, clipR + cell * 0.45)) continue;

      for (let i = 0; i < 6; i += 1) {
        const keep =
          ((col * 17 + row * 31 + i * 13) & 255) / 255 < MESH_EDGE_KEEP;
        if (!keep) continue;
        const a0 = hexVertexAngle(i);
        const a1 = hexVertexAngle((i + 1) % 6);
        addEdge(
          hx + cell * Math.cos(a0),
          hy + cell * Math.sin(a0),
          hx + cell * Math.cos(a1),
          hy + cell * Math.sin(a1),
        );
      }
    }
  }

  return { path, edges };
}

/** In-place ember flicker (no fall) — same rate as dustScene streams. */
function flickerEdgeChars(chars: Uint16Array): void {
  for (let i = 0; i < chars.length; i += 1) {
    if (Math.random() < MESH_EMBER_FLICKER) {
      chars[i] = randomEmberCharIndex();
    }
  }
}

/**
 * 0 → solid mesh snakes; 1 → full ember character rows.
 * Triggers only once the inner mesh snakes dominate the screen.
 */
function meshEmberMorph(zoom: number): number {
  const snakePx = MESH_SNAKE_WIDTH_PX * zoom;
  return Math.min(
    1,
    Math.max(
      0,
      (snakePx - MESH_EMBER_MORPH_START_PX) /
        (MESH_EMBER_MORPH_FULL_PX - MESH_EMBER_MORPH_START_PX),
    ),
  );
}

/** Pre-rasterized glyphs — drawImage is far cheaper than fillText under zoom. */
function createEmberAtlas(fill: string): EmberAtlas {
  const cols = EMBER_ATLAS_COLS;
  const cell = EMBER_ATLAS_CELL;
  const rows = Math.ceil(EMBER_CHARACTERS.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const c = canvas.getContext("2d");
  if (c) {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = fill;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `700 ${Math.floor(cell * 0.62)}px ${EMBER_FONT_STACK}`;
    for (let i = 0; i < EMBER_CHARACTERS.length; i += 1) {
      const col = i % cols;
      const row = (i / cols) | 0;
      c.fillText(
        EMBER_CHARACTERS[i],
        col * cell + cell * 0.5,
        row * cell + cell * 0.5 + cell * 0.04,
      );
    }
  }
  return { canvas, cell, cols };
}

function worldToScreen(
  wx: number,
  wy: number,
  cx: number,
  cy: number,
  zoom: number,
  width: number,
  height: number,
): Vec {
  return {
    x: (wx - cx) * zoom + width * 0.5,
    y: (wy - cy) * zoom + height * 0.5,
  };
}

/** Unique corridor runs as continuous polylines (not one subpath per edge). */
function buildUniqueLaserPath(
  snakes: Snake[],
  settled: boolean,
  t: number,
  sample: Vec,
): Path2D {
  const path = new Path2D();
  const seen = new Set<string>();
  const tip = { x: 0, y: 0 };

  for (const snake of snakes) {
    let headDist: number;
    if (settled) {
      headDist = snake.total;
    } else {
      const local = (t - snake.delay) / snake.duration;
      if (local <= 0) continue;
      const p = local >= 1 ? 1 : easeInOutCubic(local);
      headDist = p * snake.total;
    }
    const tailDist = Math.max(0, headDist - SNAKE_LEN_PX);
    if (headDist <= 0.01) continue;

    const { xs, ys, cum } = snake;
    sampleAt(snake, tailDist, sample);
    let prevX = sample.x;
    let prevY = sample.y;
    let inRun = false;

    let i = 1;
    while (i < cum.length && cum[i] < tailDist) i += 1;
    for (; i < cum.length && cum[i] <= headDist; i += 1) {
      inRun = appendUniqueRun(
        path,
        seen,
        prevX,
        prevY,
        xs[i],
        ys[i],
        inRun,
      );
      prevX = xs[i];
      prevY = ys[i];
    }
    sampleAt(snake, headDist, tip);
    appendUniqueRun(path, seen, prevX, prevY, tip.x, tip.y, inRun);
  }

  return path;
}

/** @returns whether a continuous run is active after this edge */
function appendUniqueRun(
  path: Path2D,
  seen: Set<string>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  inRun: boolean,
): boolean {
  if (Math.hypot(x1 - x0, y1 - y0) < 0.05) return inRun;
  const q = 4;
  const a0 = Math.round(x0 * q);
  const b0 = Math.round(y0 * q);
  const a1 = Math.round(x1 * q);
  const b1 = Math.round(y1 * q);
  const key =
    a0 < a1 || (a0 === a1 && b0 <= b1)
      ? `${a0},${b0}:${a1},${b1}`
      : `${a1},${b1}:${a0},${b0}`;
  if (seen.has(key)) return false;
  seen.add(key);
  if (!inRun) path.moveTo(x0, y0);
  path.lineTo(x1, y1);
  return true;
}

function cameraZoom(t: number, zoomMax: number, zoomEmber: number): number {
  if (t < ZOOM_START_MS) return 1;

  const emberZ = Math.min(zoomEmber, zoomMax);

  // Ease into ember framing, then hold (page reveals underneath).
  if (t < EMBER_HOLD_START_MS) {
    const p = Math.min(1, (t - ZOOM_START_MS) / ZOOM_IN_MS);
    return 1 + (emberZ - 1) * easeInOutCubic(p);
  }

  return emberZ;
}

/**
 * 0 while zooming into the ember mesh; then a slow 0→1 clear of the canvas fill.
 * Embers stay drawn — only the blackish cover goes away.
 */
function pageRevealAmount(t: number): number {
  if (t < BG_FADE_START_MS) return 0;
  const p = Math.min(1, (t - BG_FADE_START_MS) / BG_FADE_MS);
  return easeInOutCubic(p);
}

/** After the bg is clear, ease remaining mesh/ember graphics out. */
function graphicsFadeAmount(t: number): number {
  if (t < FADE_START_MS) return 1;
  const p = Math.min(1, (t - FADE_START_MS) / FADE_MS);
  return 1 - easeInOutCubic(p);
}

/** Zoom level where the center hex roughly fills the viewport. */
function zoomHexFill(width: number, height: number): number {
  return Math.min(width, height) / (2 * HEX_SIZE_PX);
}

/** Drop hex cells that no longer intersect the viewport under the current zoom. */
function cullVisibleCells(
  cells: HexCell[],
  center: HexCell,
  zoom: number,
  width: number,
  height: number,
): HexCell[] {
  if (zoom >= zoomHexFill(width, height) * 1.05) return [center];

  const margin = HEX_SIZE_PX * zoom * 1.4;
  const next: HexCell[] = [];
  for (const cell of cells) {
    if (cell === center) {
      next.push(cell);
      continue;
    }
    const sx = (cell.x - center.x) * zoom + width * 0.5;
    const sy = (cell.y - center.y) * zoom + height * 0.5;
    if (
      sx >= -margin &&
      sx <= width + margin &&
      sy >= -margin &&
      sy <= height + margin
    ) {
      next.push(cell);
    }
  }
  return next;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  args: {
    t: number;
    width: number;
    height: number;
    bg: string;
    bgRgb: [number, number, number];
    accent: string;
    accentRgb: [number, number, number];
    cells: HexCell[];
    center: HexCell;
    snakes: Snake[];
    mesh: CenterMesh;
    emberAtlas: EmberAtlas;
    settledSnakes: Path2D | null;
    zoomMax: number;
    zoomEmber: number;
    pageReveal: number;
    graphicsFade: number;
    sample: Vec;
  },
): void {
  const {
    t,
    width,
    height,
    bgRgb,
    accentRgb,
    cells,
    center,
    snakes,
    mesh,
    emberAtlas,
    settledSnakes,
    zoomMax,
    zoomEmber,
    pageReveal,
    graphicsFade,
    sample,
  } = args;

  const zoom = cameraZoom(t, zoomMax, zoomEmber);
  const emberMorph = meshEmberMorph(zoom);
  const hexFillZ = zoomHexFill(width, height);
  // Drop outer content before extreme scale makes laser multi-pass expensive.
  const outerFade = Math.min(
    1,
    Math.max(0, 1 - (zoom / Math.max(hexFillZ * 0.85, 1) - 1) / 0.55),
  );
  const outerAlpha = Math.min(1 - emberMorph, outerFade) * graphicsFade;
  // Blackish canvas cover — fades to transparent after the ember mesh fills the screen.
  const bgAlpha = Math.max(0, 1 - pageReveal);

  if (t < TRAVEL_MS + 40) {
    updateEdgeDrain(cells, snakes, t);
  }

  ctx.clearRect(0, 0, width, height);
  if (bgAlpha > 0.01) {
    ctx.fillStyle = `rgba(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]},${bgAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Outer hexes + lasers under camera scale — only while still on-screen / cheap.
  if (outerAlpha > 0.01 && zoom < hexFillZ * 1.35) {
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.scale(zoom, zoom);
    ctx.translate(-center.x, -center.y);
    ctx.globalAlpha = outerAlpha;

    for (const cell of cells) {
      if (cell === center && t >= TRAVEL_MS) continue;
      ctx.fillStyle = cellFillStyle(cell, accentRgb);
      traceHex(ctx, cell.x, cell.y, HEX_SIZE_PX);
      ctx.fill();
    }

    if (settledSnakes && t >= TRAVEL_MS) {
      // Fewer glow passes once zoomed — full bloom under scale is costly.
      strokeLaserPath(
        ctx,
        settledSnakes,
        accentRgb,
        SNAKE_WIDTH_PX,
        1,
        zoom > 2.5 ? 2 : 6,
      );
    } else {
      const lasers = buildUniqueLaserPath(snakes, false, t, sample);
      strokeLaserPath(ctx, lasers, accentRgb, SNAKE_WIDTH_PX, 1, 6);
    }

    ctx.restore();
  }

  // Mesh + embers in *screen space* (no ctx.scale) so deep zoom stays cheap.
  if (t >= TRAVEL_MS - 180 && graphicsFade > 0.01) {
    const meshAlpha =
      (t >= TRAVEL_MS
        ? 1
        : Math.max(0, (t - (TRAVEL_MS - 180)) / 180)) * graphicsFade;
    drawCenterMesh(
      ctx,
      mesh,
      emberAtlas,
      center,
      bgRgb,
      accentRgb,
      meshAlpha,
      emberMorph,
      pageReveal,
      zoom,
      width,
      height,
    );
  }
}

/** Multi-pass laser look on a Path2D of unique edges. */
function strokeLaserPath(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  accentRgb: [number, number, number],
  width: number,
  alpha: number,
  passes = 6,
): void {
  paintLaserPasses(ctx, path, accentRgb, width, alpha, passes);
}

/**
 * Wide soft haze with butt caps (avoids round-cap circles) + thin readable core.
 * Unique edges are stroked once so merges don't stack brightness.
 */
function paintLaserPasses(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  accentRgb: [number, number, number],
  width: number,
  alpha: number,
  passes: number,
): void {
  const [ar, ag, ab] = accentRgb;
  const midR = Math.min(255, Math.floor(ar * 1.08 + 10));
  const midG = Math.min(255, Math.floor(ag * 1.04 + 5));
  const midB = Math.min(255, Math.floor(ab * 1.04 + 5));
  const coreR = Math.min(255, Math.floor(ar * 1.15 + 14));
  const coreG = Math.min(255, Math.floor(ag * 1.08 + 6));
  const coreB = Math.min(255, Math.floor(ab * 1.08 + 6));

  ctx.save();
  ctx.lineJoin = "round";
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";

  if (passes >= 6) {
    ctx.lineCap = "butt";
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.016 * alpha).toFixed(3)})`;
    ctx.lineWidth = width * 28;
    ctx.stroke(path);

    ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.028 * alpha).toFixed(3)})`;
    ctx.lineWidth = width * 16;
    ctx.stroke(path);

    ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.05 * alpha).toFixed(3)})`;
    ctx.lineWidth = width * 8;
    ctx.stroke(path);

    ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.1 * alpha).toFixed(3)})`;
    ctx.lineWidth = width * 3.5;
    ctx.stroke(path);
  } else if (passes >= 2) {
    ctx.lineCap = "butt";
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.06 * alpha).toFixed(3)})`;
    ctx.lineWidth = width * 6;
    ctx.stroke(path);
  }

  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(${midR},${midG},${midB},${(0.8 * alpha).toFixed(3)})`;
  ctx.lineWidth = width * 1.1;
  ctx.stroke(path);

  ctx.strokeStyle = `rgba(${coreR},${coreG},${coreB},${(0.92 * alpha).toFixed(3)})`;
  ctx.lineWidth = width * 0.5;
  ctx.stroke(path);

  ctx.restore();
}

/**
 * Draw mesh layers in screen space: only visible edges, no ctx.scale.
 * Front mesh layers morph into ember glyphs; a hex border separates lasers.
 */
function drawCenterMesh(
  ctx: CanvasRenderingContext2D,
  mesh: CenterMesh,
  atlas: EmberAtlas,
  center: HexCell,
  bgRgb: [number, number, number],
  accentRgb: [number, number, number],
  alpha: number,
  emberMorph: number,
  pageReveal: number,
  zoom: number,
  width: number,
  height: number,
): void {
  if (alpha < 0.01) return;
  const [ar, ag, ab] = accentRgb;
  const [br, bgc, bb] = bgRgb;
  const last = MESH_LAYERS - 1;
  const firstEmberLayer = Math.max(0, MESH_LAYERS - MESH_EMBER_LAYERS);
  const { x: cx, y: cy } = center;
  const cell = mesh.cell;
  const strokeAlpha = alpha * (1 - emberMorph);
  const emberAlpha = alpha * emberMorph;
  const lineW = MESH_SNAKE_WIDTH_PX * zoom;
  const fontPx = (MESH_SNAKE_WIDTH_PX / 5.4) * zoom + MESH_EMBER_FONT_EXTRA_PX;
  const lineSpan = MESH_SNAKE_WIDTH_PX * 0.82;
  const margin = lineW * 2 + MESH_CELL_PX * zoom;
  const meshBgAlpha = alpha * Math.max(0, 1 - pageReveal);

  const hexPath = new Path2D();
  for (let i = 0; i < 6; i += 1) {
    const a = hexVertexAngle(i);
    const p = worldToScreen(
      cx + HEX_SIZE_PX * Math.cos(a),
      cy + HEX_SIZE_PX * Math.sin(a),
      cx,
      cy,
      zoom,
      width,
      height,
    );
    if (i === 0) hexPath.moveTo(p.x, p.y);
    else hexPath.lineTo(p.x, p.y);
  }
  hexPath.closePath();

  ctx.save();

  // Clip slightly inside so the border stroke stays crisp on top.
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = hexVertexAngle(i);
    const p = worldToScreen(
      cx + HEX_SIZE_PX * 0.992 * Math.cos(a),
      cy + HEX_SIZE_PX * 0.992 * Math.sin(a),
      cx,
      cy,
      zoom,
      width,
      height,
    );
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.clip();

  if (meshBgAlpha > 0.01) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${br},${bgc},${bb},${meshBgAlpha.toFixed(3)})`;
    ctx.fill(hexPath);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 0;

  // Scratch for visible screen-space segments (reused per layer).
  const visEdges: MeshEdgeEmber[] = [];
  const visX0: number[] = [];
  const visY0: number[] = [];
  const visX1: number[] = [];
  const visY1: number[] = [];

  for (let L = 0; L < MESH_LAYERS; L += 1) {
    const depth = last <= 0 ? 1 : L / last;
    const shade = 0.34 + 0.66 * depth;
    const layerAng = MESH_LAYER_ANGLES[L] ?? 0;
    const cosL = Math.cos(layerAng);
    const sinL = Math.sin(layerAng);
    const off = MESH_LAYER_OFFSETS[L] ?? { x: 0, y: 0 };
    const ox = off.x * cell;
    const oy = off.y * cell;
    const strokeCol = `rgb(${Math.floor(ar * shade)},${Math.floor(ag * shade)},${Math.floor(ab * shade)})`;
    const useEmbers = L >= firstEmberLayer;

    visEdges.length = 0;
    visX0.length = 0;
    visY0.length = 0;
    visX1.length = 0;
    visY1.length = 0;

    for (const edge of mesh.edges) {
      // Inline layer transform (cached sin/cos).
      const dx0 = edge.x0 - cx;
      const dy0 = edge.y0 - cy;
      const dx1 = edge.x1 - cx;
      const dy1 = edge.y1 - cy;
      const wx0 = cx + ox + dx0 * cosL - dy0 * sinL;
      const wy0 = cy + oy + dx0 * sinL + dy0 * cosL;
      const wx1 = cx + ox + dx1 * cosL - dy1 * sinL;
      const wy1 = cy + oy + dx1 * sinL + dy1 * cosL;
      const saX = (wx0 - cx) * zoom + width * 0.5;
      const saY = (wy0 - cy) * zoom + height * 0.5;
      const sbX = (wx1 - cx) * zoom + width * 0.5;
      const sbY = (wy1 - cy) * zoom + height * 0.5;
      if (
        (saX < -margin && sbX < -margin) ||
        (saX > width + margin && sbX > width + margin) ||
        (saY < -margin && sbY < -margin) ||
        (saY > height + margin && sbY > height + margin)
      ) {
        continue;
      }
      visEdges.push(edge);
      visX0.push(saX);
      visY0.push(saY);
      visX1.push(sbX);
      visY1.push(sbY);
    }

    // Ember layers drop the solid stroke once characters dominate.
    const layerStroke =
      useEmbers && emberAlpha > 0.72 ? 0 : strokeAlpha;
    if (layerStroke > 0.01 && visEdges.length > 0) {
      ctx.globalAlpha = layerStroke;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = lineW * (0.86 + 0.16 * depth);
      const path = new Path2D();
      for (let i = 0; i < visEdges.length; i += 1) {
        path.moveTo(visX0[i], visY0[i]);
        path.lineTo(visX1[i], visY1[i]);
      }
      ctx.stroke(path);
    }

    if (useEmbers && emberAlpha > 0.01 && fontPx >= 4 && visEdges.length > 0) {
      ctx.globalAlpha = emberAlpha * (0.55 + 0.45 * depth);
      drawMeshEmbersScreen(
        ctx,
        visEdges,
        visX0,
        visY0,
        visX1,
        visY1,
        atlas,
        fontPx,
        lineSpan * zoom,
        width,
        height,
        // Flicker once on the front-most ember layer only.
        L === last,
      );
    }
  }

  ctx.restore();

  // 4px screen-space border between outer lasers and the interior mesh.
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgb(${ar},${ag},${ab})`;
  ctx.lineWidth = CENTER_HEX_BORDER_PX;
  ctx.stroke(hexPath);
  ctx.restore();
}

function drawMeshEmbersScreen(
  ctx: CanvasRenderingContext2D,
  edges: MeshEdgeEmber[],
  sx0: number[],
  sy0: number[],
  sx1: number[],
  sy1: number[],
  atlas: EmberAtlas,
  fontPx: number,
  spanPx: number,
  width: number,
  height: number,
  flicker: boolean,
): void {
  const { canvas, cell: atlasCell, cols } = atlas;
  const half = fontPx * 0.5;
  const src = atlasCell;
  // When the whole hex is still on-screen, thin the glyph density.
  const slotStep = edges.length > 160 ? 2 : 1;

  for (let e = 0; e < edges.length; e += 1) {
    const edge = edges[e];
    if (flicker) flickerEdgeChars(edge.chars);

    const x0 = sx0[e];
    const y0 = sy0[e];
    const sdx = sx1[e] - x0;
    const sdy = sy1[e] - y0;
    const slen = Math.hypot(sdx, sdy) || 1;
    const snx = -sdy / slen;
    const sny = sdx / slen;
    const ang = Math.atan2(sdy, sdx);
    const ux = sdx / slen;
    const uy = sdy / slen;
    const { slots, chars } = edge;

    for (let line = 0; line < MESH_EMBER_LINES; line += 1) {
      const tLine =
        MESH_EMBER_LINES <= 1 ? 0 : line / (MESH_EMBER_LINES - 1);
      const off = (tLine - 0.5) * spanPx;
      const base = line * slots;
      const ox = snx * off;
      const oy = sny * off;

      ctx.save();
      ctx.translate(x0 + ox, y0 + oy);
      ctx.rotate(ang);
      for (let s = 0; s < slots; s += slotStep) {
        const u = slots === 1 ? 0.5 : (s + 0.5) / slots;
        const gx = u * slen;
        const wx = x0 + ox + ux * gx;
        const wy = y0 + oy + uy * gx;
        if (
          wx < -fontPx ||
          wx > width + fontPx ||
          wy < -fontPx ||
          wy > height + fontPx
        ) {
          continue;
        }

        const ch = chars[base + s] ?? 0;
        ctx.drawImage(
          canvas,
          (ch % cols) * src,
          ((ch / cols) | 0) * src,
          src,
          src,
          gx - half,
          -half,
          fontPx,
          fontPx,
        );
      }
      ctx.restore();
    }
  }
}

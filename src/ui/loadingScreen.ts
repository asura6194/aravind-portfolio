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

/**
 * Gap between hexes on the loading canvas, in pixels.
 * Increase this to space the honeycomb out. Snake width is always 4px smaller.
 */
const LOADING_HEX_GAP_PX = 6;

const LOADING_COL_W = SQRT3 * HEX_SIZE_PX + LOADING_HEX_GAP_PX;
const LOADING_ROW_H = 1.5 * HEX_SIZE_PX + LOADING_HEX_GAP_PX;
const LOADING_RING_R = HEX_SIZE_PX + LOADING_HEX_GAP_PX / SQRT3;
const SNAKE_WIDTH_PX = Math.max(0.5, LOADING_HEX_GAP_PX - 4);

const SNAKE_COUNT = 120;
const TRAVEL_MS = 2500;
const TOTAL_MS = 3000;
const FADE_MS = 100;
const SNAKE_LEN_PX = 440;
const MAX_STAGGER_MS = 380;
const NODE_QUANT = 10;

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
    const abort = () => {
      overlay.remove();
      document.documentElement.classList.remove("is-loading");
      document.body.classList.remove("is-loading");
      resolve();
    };
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
    overlay.style.background = bg;

    const cells = buildCells(width, height);
    const center = pickCenterHex(cells, width, height);
    const { nodes, goals, hexVerts } = buildGapGraph(width, height, center);
    const snakes = spawnSnakes(nodes, goals, hexVerts, cells);

    const sample = { x: 0, y: 0 };
    let raf = 0;
    let fading = false;
    const start = performance.now();

    const finish = () => {
      cancelAnimationFrame(raf);
      overlay.remove();
      document.documentElement.classList.remove("is-loading");
      document.body.classList.remove("is-loading");
      resolve();
    };

    const tick = (now: number) => {
      const t = now - start;
      drawFrame(ctx, {
        t,
        width,
        height,
        bg,
        accent,
        accentRgb,
        cells,
        center,
        snakes,
        sample,
      });

      if (t >= TOTAL_MS - FADE_MS && !fading) {
        fading = true;
        document.documentElement.classList.remove("is-loading");
        overlay.classList.add("is-exit");
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
      accent,
      accentRgb,
      cells,
      center,
      snakes,
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
      cells.push({ col, row, x, y, tint: hexTint(col, row) });
    }
  }
  return cells;
}

function pickCenterHex(cells: HexCell[], width: number, height: number): HexCell {
  const cx = width / 2;
  const cy = height / 2;
  if (cells.length === 0) {
    return { col: 0, row: 0, x: cx, y: cy, tint: 0 };
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

    const xs = new Float32Array(pathIds.length);
    const ys = new Float32Array(pathIds.length);
    const cum = new Float32Array(pathIds.length);
    for (let i = 0; i < pathIds.length; i += 1) {
      xs[i] = nodes[pathIds[i]].x;
      ys[i] = nodes[pathIds[i]].y;
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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  args: {
    t: number;
    width: number;
    height: number;
    bg: string;
    accent: string;
    accentRgb: [number, number, number];
    cells: HexCell[];
    center: HexCell;
    snakes: Snake[];
    sample: Vec;
  },
): void {
  const { t, width, height, bg, accent, accentRgb, cells, center, snakes, sample } =
    args;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (const cell of cells) {
    if (cell === center && t >= TRAVEL_MS) continue;
    ctx.fillStyle = hexFillColor(cell.tint);
    traceHex(ctx, cell.x, cell.y, HEX_SIZE_PX);
    ctx.fill();
  }

  const [ar, ag, ab] = accentRgb;
  const halfW = SNAKE_WIDTH_PX * 0.5;
  for (const snake of snakes) {
    const local = (t - snake.delay) / snake.duration;
    const p = local <= 0 ? 0 : local >= 1 ? 1 : easeInOutCubic(local);
    const head = p * snake.total;
    const tail = head - SNAKE_LEN_PX;
    const step = 1.35;
    for (let d = 0; d <= SNAKE_LEN_PX; d += step) {
      const s = head - d;
      if (s < tail || s < 0) break;
      sampleAt(snake, s, sample);
      const fade = 1 - d / SNAKE_LEN_PX;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${(0.12 + fade * 0.88).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sample.x, sample.y, halfW, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (t >= TRAVEL_MS) {
    const ignite = t - TRAVEL_MS;
    const pulseT = Math.min(1, ignite / 380);
    const pulse = Math.sin(pulseT * Math.PI);
    const glowR = HEX_SIZE_PX * (2.4 + pulse * 1.4);
    const grad = ctx.createRadialGradient(
      center.x,
      center.y,
      HEX_SIZE_PX * 0.2,
      center.x,
      center.y,
      glowR,
    );
    grad.addColorStop(0, `rgba(${ar},${ag},${ab},${0.55 + pulse * 0.35})`);
    grad.addColorStop(0.45, `rgba(${ar},${ag},${ab},${0.18 + pulse * 0.12})`);
    grad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center.x, center.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    const scale = 1 + 0.16 * pulse;
    ctx.fillStyle = accent;
    traceHex(ctx, center.x, center.y, HEX_SIZE_PX * scale);
    ctx.fill();
  }
}

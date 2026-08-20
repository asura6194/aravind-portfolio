const HEX_SIZE_PX = 7.2;
const HEX_GAP_PX = 1.6;
const SQRT3 = Math.sqrt(3);
const PANEL_SELECTOR = ".hex-panel";
const HEX_FILL = "#1e1c24";
const HEX_HIGHLIGHT = "#2a282f";

/** Wave band width in hex cells. Try 3–5. */
const WAVE_WIDTH_HEX = 5;

/** Wave travel speed in pixels per second. */
const WAVE_SPEED_PX = 160;

/** Extra travel after a ring leaves the panel before that drop restarts, in pixels. */
const WAVE_REST_PX = 20;

/** How many raindrop origins / circular waves are alive in a panel at once. */
const RAIN_DROP_COUNT = 4;

/** Peak flip angle in degrees: 0 → +angle → 0 → −angle → 0 as the ring passes. */
const WAVE_FLIP_DEG = 45;

const HEX_SPACING = SQRT3 * HEX_SIZE_PX + HEX_GAP_PX;

type HexCell = {
  x: number;
  y: number;
  tint: number;
};

type RainDrop = {
  x: number;
  y: number;
  born: number;
};

type PanelState = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cells: HexCell[];
  drops: RainDrop[];
  width: number;
  height: number;
  visible: boolean;
};

const panelStates: PanelState[] = [];

export function setupHexPanels(): void {
  document.querySelectorAll<HTMLElement>(PANEL_SELECTOR).forEach(mountPanel);

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reduceMotion) return;

  const tick = (now: number) => {
    const time = now / 1000;
    for (const state of panelStates) {
      if (!state.visible) continue;
      drawHexes(state, time);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function mountPanel(panel: HTMLElement): void {
  if (panel.querySelector(".hex-panel-canvas")) return;

  let inner = panel.querySelector<HTMLElement>(".hex-panel-inner");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "hex-panel-inner";
    while (panel.firstChild) {
      inner.appendChild(panel.firstChild);
    }
    panel.appendChild(inner);
  }

  const canvas = document.createElement("canvas");
  canvas.className = "hex-panel-canvas";
  canvas.setAttribute("aria-hidden", "true");
  panel.insertBefore(canvas, inner);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const state: PanelState = {
    canvas,
    ctx,
    cells: [],
    drops: [],
    width: 0,
    height: 0,
    visible: true,
  };
  panelStates.push(state);
  resizePanel(panel, state);

  const ro = new ResizeObserver(() => resizePanel(panel, state));
  ro.observe(panel);

  const io = new IntersectionObserver(
    ([entry]) => {
      state.visible = Boolean(entry?.isIntersecting);
      if (state.visible) drawHexes(state, performance.now() / 1000);
    },
    { threshold: 0.02 },
  );
  io.observe(panel);
}

function resizePanel(panel: HTMLElement, state: PanelState): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, panel.clientWidth);
  const height = Math.max(1, panel.clientHeight);
  state.width = width;
  state.height = height;

  state.canvas.width = Math.floor(width * dpr);
  state.canvas.height = Math.floor(height * dpr);
  state.canvas.style.width = `${width}px`;
  state.canvas.style.height = `${height}px`;
  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const radius = Number.parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 14;
  state.cells = buildHexCells(width, height, radius);
  drawHexes(state, performance.now() / 1000);
}

function hexFits(
  cx: number,
  cy: number,
  hexR: number,
  width: number,
  height: number,
  cornerR: number,
): boolean {
  const x0 = hexR;
  const y0 = hexR;
  const x1 = width - hexR;
  const y1 = height - hexR;
  if (cx < x0 || cx > x1 || cy < y0 || cy > y1) return false;

  const ir = Math.max(0, cornerR - hexR);
  if (ir <= 0) return true;

  const inLeft = cx < x0 + ir;
  const inRight = cx > x1 - ir;
  const inTop = cy < y0 + ir;
  const inBottom = cy > y1 - ir;

  if (inLeft && inTop) {
    return Math.hypot(cx - (x0 + ir), cy - (y0 + ir)) <= ir;
  }
  if (inRight && inTop) {
    return Math.hypot(cx - (x1 - ir), cy - (y0 + ir)) <= ir;
  }
  if (inLeft && inBottom) {
    return Math.hypot(cx - (x0 + ir), cy - (y1 - ir)) <= ir;
  }
  if (inRight && inBottom) {
    return Math.hypot(cx - (x1 - ir), cy - (y1 - ir)) <= ir;
  }
  return true;
}

function buildHexCells(
  width: number,
  height: number,
  cornerR: number,
): HexCell[] {
  const r = HEX_SIZE_PX;
  const colW = SQRT3 * r + HEX_GAP_PX;
  const rowH = 1.5 * r + HEX_GAP_PX;
  const cells: HexCell[] = [];
  const cols = Math.ceil(width / colW) + 2;
  const rows = Math.ceil(height / rowH) + 2;

  for (let row = -1; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : colW / 2;
    for (let col = -1; col < cols; col += 1) {
      const x = col * colW + offset;
      const y = row * rowH;
      if (!hexFits(x, y, r, width, height, cornerR)) continue;
      cells.push({
        x,
        y,
        tint: ((col * 7 + row * 13) % 11) / 10,
      });
    }
  }
  return cells;
}

function waveFlip(axis: number, head: number, band: number): number {
  const along = head - axis;
  if (along < 0 || along > band) return 1;
  const t = along / band;
  const angle =
    ((WAVE_FLIP_DEG * Math.PI) / 180) * Math.sin(t * Math.PI * 2);
  return Math.cos(angle);
}

function dropCyclePx(width: number, height: number): number {
  return Math.hypot(width, height) + WAVE_WIDTH_HEX * HEX_SPACING + WAVE_REST_PX;
}

function spawnDrop(
  width: number,
  height: number,
  time: number,
  scatter: boolean,
): RainDrop {
  const cycleSec = dropCyclePx(width, height) / Math.max(WAVE_SPEED_PX, 1);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    born: scatter ? time - Math.random() * cycleSec : time,
  };
}

function syncDrops(state: PanelState, time: number): void {
  const count = Math.max(0, RAIN_DROP_COUNT);
  if (state.drops.length > count) {
    state.drops.length = count;
    return;
  }
  while (state.drops.length < count) {
    state.drops.push(spawnDrop(state.width, state.height, time, true));
  }
}

function drawHexes(state: PanelState, time: number): void {
  const { ctx, cells, width, height } = state;
  const band = WAVE_WIDTH_HEX * HEX_SPACING;
  const cyclePx = dropCyclePx(width, height);

  syncDrops(state, time);
  for (const drop of state.drops) {
    const radius = (time - drop.born) * WAVE_SPEED_PX;
    if (radius > cyclePx) {
      const next = spawnDrop(width, height, time, false);
      drop.x = next.x;
      drop.y = next.y;
      drop.born = next.born;
    }
  }

  ctx.clearRect(0, 0, width, height);

  for (const cell of cells) {
    let flip = 1;
    let ax = 1;
    let ay = 0;

    for (const drop of state.drops) {
      const dx = cell.x - drop.x;
      const dy = cell.y - drop.y;
      const dist = Math.hypot(dx, dy);
      const radius = (time - drop.born) * WAVE_SPEED_PX;
      const nextFlip = waveFlip(dist, radius, band);
      if (nextFlip < flip) {
        flip = nextFlip;
        if (dist > 0.0001) {
          ax = dx / dist;
          ay = dy / dist;
        }
      }
    }

    ctx.fillStyle = cell.tint > 0.86 ? HEX_HIGHLIGHT : HEX_FILL;
    drawHex(ctx, cell.x, cell.y, HEX_SIZE_PX, flip, ax, ay);
  }
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  flipScale: number,
  ax: number,
  ay: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    let lx = r * Math.cos(angle);
    let ly = r * Math.sin(angle);
    const along = lx * ax + ly * ay;
    lx += ax * along * (flipScale - 1);
    ly += ay * along * (flipScale - 1);
    const x = cx + lx;
    const y = cy + ly;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

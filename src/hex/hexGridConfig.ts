export const HEX_SIZE_PX = 5.2;
export const HEX_GAP_PX = 1.6;
export const SQRT3 = Math.sqrt(3);
export const HEX_FILL = "#1e1c24";
export const HEX_HIGHLIGHT = "#2a282f";

/** Horizontal center-to-center spacing (pointy-top). */
export const HEX_COL_W = SQRT3 * HEX_SIZE_PX + HEX_GAP_PX;

/** Vertical center-to-center spacing (pointy-top). */
export const HEX_ROW_H = 1.5 * HEX_SIZE_PX + HEX_GAP_PX;

export const HEX_SPACING = HEX_COL_W;

/**
 * Radius of the corridor centerline hex around a cell.
 * Flat-to-flat sits in the middle of HEX_GAP_PX between neighboring hexes.
 */
export const HEX_RING_R = HEX_SIZE_PX + HEX_GAP_PX / SQRT3;

export function hexCenter(col: number, row: number): { x: number; y: number } {
  const offset = row % 2 === 0 ? 0 : HEX_COL_W / 2;
  return { x: col * HEX_COL_W + offset, y: row * HEX_ROW_H };
}

export function hexTint(col: number, row: number): number {
  return ((col * 7 + row * 13) % 11) / 10;
}

export function hexFillColor(tint: number): string {
  return tint > 0.86 ? HEX_HIGHLIGHT : HEX_FILL;
}

export function hexVertexAngle(i: number): number {
  return (Math.PI / 3) * i - Math.PI / 6;
}

export function hexFits(
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

export function traceHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = hexVertexAngle(i);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function readCssColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

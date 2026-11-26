// Shared drawing helpers for the games (positions in grid cells).
import { T } from "./theme.js";

// Older names used by the games, mapped onto the arcade theme.
export const C = {
  fg: T.text,
  dim: T.muted,
  faint: T.panelHi,
  accent: T.accent,
  danger: T.bad,
  white: T.text,
  btnBg: T.panel,
  btnOn: T.edge,
};

export function fmtTime(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Top bar: title left, info right (drops to the second line on narrow screens), seed under the title.
export function hud(r, title, right, seed) {
  r.bar(0, 0, r.cols, 2, T.panel);
  r.bar(0, 2 - 0.12, r.cols, 0.12, T.edge);
  r.label(1, 0.5, title, T.accent, { size: 1 });
  const rightX = r.cols - 1 - r.hudInset;
  const fits = r.labelW(title) + 2 + r.labelW(right) + r.hudInset <= r.cols - 2;
  r.label(rightX, fits ? 0.5 : 2.4, right, T.text, { size: fits ? 1 : 0.9, align: "right" });
  // seed under the title, unless the info line already fills that row
  const seedText = `SEED ${seed}`;
  const room = fits || r.labelW(seedText, 0.75) + r.labelW(right, 0.9) + 3 + r.hudInset <= r.cols;
  if (seed && room) r.label(1, 2.4, seedText, T.muted, { size: 0.75 });
}

// Tappable raised button with a pixel-font label. Returns its width (cells).
// opts: { h (cells, default 3), w (cells), color (block colour), primary, disabled, size }
export function button(r, x, y, text, id, opts = {}) {
  const size = opts.size || 0.9;
  const h = opts.h || 3;
  const w = opts.w || Math.ceil(r.labelW(text, size) + 4);
  const base = opts.disabled ? T.panelHi : opts.primary ? T.accent : opts.color || T.edge;
  r.block(x, y, w, h, base, { inset: 0.15, flat: !!opts.disabled });
  const ink = opts.disabled ? T.muted : opts.primary || opts.color ? T.ink : T.text;
  r.label(x + w / 2, y + (h - size) / 2, text, ink, { size, align: "center" });
  if (!opts.disabled) r.zone(x, y, w, h, id);
  return w;
}

// Flat rounded panel (board backgrounds, trays).
export function panel(r, x, y, w, h) {
  r.bar(x, y, w, h, T.panel, { round: 8, stroke: T.edge, lw: 2 });
}

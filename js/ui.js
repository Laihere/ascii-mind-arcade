// Small drawing helpers shared by the games (all in grid cells).

export const C = {
  fg: "#9dffb0",
  dim: "#3f7a4c",
  faint: "#1d3a26",
  accent: "#ffcc4d",
  danger: "#ff5c5c",
  white: "#e8f0ea",
  btnBg: "#0d2416",
  btnOn: "#1f5a33",
};

export function fmtTime(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Top bar: title on the left, info on the right, rule under it, seed just below on the left.
export function hud(r, title, right, seed) {
  r.text(1, 0, title, C.accent, { bold: true });
  r.text(r.cols - 1 - r.hudInset - right.length, 0, right, C.fg);
  for (let x = 0; x < r.cols; x++) r.put(x, 1, "─", C.faint);
  if (seed) r.text(1, 2, `seed ${seed}`, C.dim);
}

// A tappable button: " LABEL " on a filled background. Returns its width.
export function button(r, x, y, label, id, opts = {}) {
  const text = ` ${label} `;
  const h = opts.h || 1;
  const w = text.length;
  r.fill(x, y, w, h, opts.disabled ? C.faint : opts.on ? C.btnOn : C.btnBg);
  r.text(x, y + Math.floor(h / 2), text, opts.disabled ? C.dim : opts.color || C.fg, { bold: !!opts.bold });
  if (!opts.disabled) r.zone(x, y, w, h, id);
  return w;
}

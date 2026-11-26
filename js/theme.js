// Arcade theme tokens, shared by the canvas games. css/style.css :root mirrors these.

export const T = {
  bg: "#0b0b1e", // screen
  panel: "#16163a", // board / card background
  panelHi: "#22225a", // raised panel edge, empty slots
  edge: "#34347a", // borders, dividers
  text: "#ffffff",
  muted: "#a9a9d6", // secondary text (8.9:1 on bg)
  accent: "#ffd23f", // ONE accent: primary action, active, focus
  good: "#3ddc84",
  bad: "#ff4d4d",
  water: "#22d3ee",
  ink: "#0b0b1e", // text on bright blocks
};

// Bright block colours (peg colours, logo letters, falling background blocks).
export const BLOCKS = ["#ff4d4d", "#ff9f1c", "#ffd23f", "#3ddc84", "#22d3ee", "#ff4fd8", "#4d7cff", "#b15cff"];

export const PIXEL_FONT = '"Press Start 2P", "Cascadia Mono", monospace';

// Lighter / darker versions of a #rrggbb colour, for bevels.
export function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

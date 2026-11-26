// Placeholder game used until the real one is built (tests the menu -> game -> result flow).
import { C, hud, button, fmtTime } from "../ui.js";

export class StubGame {
  constructor({ title, rng, diff }, hooks) {
    this.title = title;
    this.rng = rng;
    this.diff = diff;
    this.hooks = hooks;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  tap(id) {
    if (id === "finish") this.hooks.onEnd({ won: true, score: 100 + this.rng.int(900), detail: fmtTime(this.time) });
  }

  key() {}

  draw(r) {
    hud(r, this.title, `${this.diff.toUpperCase()}  ${fmtTime(this.time)}`, this.rng.seed);
    r.centerText(Math.floor(r.rows / 2) - 2, "COMING SOON", C.dim);
    const label = "FINISH";
    button(r, Math.floor((r.cols - label.length - 2) / 2), Math.floor(r.rows / 2), label, "finish", { h: 3 });
  }
}

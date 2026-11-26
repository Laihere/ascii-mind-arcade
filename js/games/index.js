// The game list: menu title, how-to-play text and the class that runs it.
import { StubGame } from "./stub.js";

export const GAMES = {
  codebreaker: {
    title: "CODE BREAKER",
    blurb: "Crack the secret code of symbols.\n● = right symbol, right place   ○ = right symbol, wrong place",
    Game: StubGame,
  },
  recall: {
    title: "BLOCK RECALL",
    blurb: "Blocks light up for a moment, then hide.\nTap every block you saw. Each level adds more. 3 lives.",
    Game: StubGame,
  },
  pipes: {
    title: "PIPE LINK",
    blurb: "Tap a pipe to turn it.\nConnect S (start) to F (finish) in as few turns as you can.",
    Game: StubGame,
  },
};

export const DIFFS = ["easy", "normal", "hard"];

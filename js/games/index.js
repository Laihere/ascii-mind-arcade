// The game list: menu title, how-to-play text and the class that runs it.
import { CodeBreaker } from "./codebreaker.js";
import { BlockRecall } from "./recall.js";
import { PipeLink } from "./pipes.js";

export const GAMES = {
  codebreaker: {
    title: "CODE BREAKER",
    blurb: "Guess the secret 4-colour code (colours can repeat).\n● = right colour, right place   ○ = right colour, wrong place\nCrack code after code: fewer tries + faster = more points.",
    diffs: ["classic"],
    Game: CodeBreaker,
  },
  recall: {
    title: "BLOCK RECALL",
    blurb: "Blocks light up for a moment, then hide.\nTap every block you saw. Each level adds one more.\nA wrong tap costs a life (3 lives).",
    diffs: ["easy", "normal", "hard", "stages"],
    Game: BlockRecall,
  },
  pipes: {
    title: "PIPE LINK",
    blurb: "Tap a pipe to turn it.\nLink S (start) to F (finish) so the water can flow.\nLong routes, few turns and speed = more points.",
    diffs: ["easy", "normal", "hard", "stages"],
    Game: PipeLink,
  },
};

// Button / tab label for each difficulty id. STAGES starts easy and gets harder each stage.
export const DIFF_LABELS = { classic: "START", easy: "EASY", normal: "NORMAL", hard: "HARD", stages: "STAGES" };

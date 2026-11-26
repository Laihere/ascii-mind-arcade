// The game list: menu title, how-to-play text and the class that runs it.
import { CodeBreaker } from "./codebreaker.js";
import { BlockRecall } from "./recall.js";
import { PipeLink } from "./pipes.js";

export const GAMES = {
  codebreaker: {
    title: "CODE BREAKER",
    blurb: "Guess the secret 4-colour code (colours can repeat) in 10 tries.\nClue pegs: solid = right colour, right place · ring = right colour, wrong place.\nFewer tries + faster = more points.",
    diffs: ["classic", "timed", "endless"],
    hint: "STREAK: one miss ends the run.\nTIME ATTACK: crack as many as you can in 3:00.\nENDLESS: never ends; a miss resets your streak. Best streak goes on the board.",
    scoreLabels: { endless: "STREAK" }, // leaderboard column (default SCORE)
    Game: CodeBreaker,
  },
  recall: {
    title: "BLOCK RECALL",
    blurb: "Blocks light up for a moment, then hide.\nTap every block you saw. Each level adds one more.\nA wrong tap costs a life (3 lives).",
    diffs: ["easy", "normal", "hard", "stages"],
    hint: "STAGES: starts easy, gets harder every level.",
    Game: BlockRecall,
  },
  pipes: {
    title: "PIPE LINK",
    blurb: "Tap a pipe to turn it.\nLink S (start) to F (finish) so the water can flow.\nLong routes, few turns and speed = more points.",
    diffs: ["easy", "normal", "hard", "stages"],
    hint: "STAGES: 10 boards, each one bigger.",
    Game: PipeLink,
  },
};

// Button / tab label for each difficulty id. STAGES starts easy and gets harder each stage.
export const DIFF_LABELS = { classic: "STREAK", timed: "TIME ATTACK", endless: "ENDLESS", easy: "EASY", normal: "NORMAL", hard: "HARD", stages: "STAGES" };

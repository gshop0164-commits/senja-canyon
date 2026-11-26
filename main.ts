// Senja Canyon's entry program (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and the program
// hands it in. It copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The game: a sunset canyon stunt racer. Fly a stunt plane through glowing rings in a
// winding red-rock canyon at golden hour, threading between rock pillars and under arches:
// throttle discipline, near-miss bonuses, fuel that turns a sortie into decisions, and
// three heats of rising difficulty. Keyboard and mouse, seeded RNG, staged screenshots.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SHOT_BYTES = 262144;

// Entry checks: refuse to hand in a game that is not there, or screenshots the gate
// would refuse (the wrong count, or one over 256 KiB).
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('refusing: game/index.html is missing');
}
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) throw new Error('refusing: screenshots/ is missing');
const shots = readdirSync(shotsDir)
  .filter((name) => !name.startsWith('.'))
  .sort();
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`refusing: screenshots/ holds ${shots.length} images, need 3 or 4`);
}
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > MAX_SHOT_BYTES) {
    throw new Error(`refusing: screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
  if (!/\.(png|jpe?g)$/i.test(name)) {
    throw new Error(`refusing: screenshots/${name} is not a PNG or JPEG`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path under
// game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

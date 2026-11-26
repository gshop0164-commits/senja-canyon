// Senja Canyon: the game loop, screens and persistence. The world runs on a fixed step;
// the renderer draws it every animation frame. ?shot=start|play|rings|end stages a
// screenshot scene instead of starting the title screen, and ?seed=N picks the canyon.
import { FIELD, STEP, BEST_KEY } from './config.js';
import { createWorld, STATUS_TITLE, STATUS_PLAY, STATUS_HEATDONE, STATUS_OVER } from './world.js';
import { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_HEATDONE, SCREEN_OVER } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');

const world = createWorld(seed);
const input = createInput(canvas);
window.__world = world;
let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) || '0') || 0;
} catch (error) {
  best = 0;
}
let throttle = 0.65;
let last = performance.now();
let acc = 0;
let started = performance.now();

function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(FIELD.width * ratio);
  canvas.height = Math.round(FIELD.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

function saveBest() {
  const score = Math.round(world.state.score);
  if (score > best) {
    best = score;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      // Private mode: the best score just does not survive the visit.
    }
  }
}

function announce() {
  const s = world.state;
  statusLine.textContent =
    screen === SCREEN_TITLE
      ? 'Senja Canyon: a sunset canyon stunt racer. Press Space to fly.'
      : `Heat ${s.heat} of 3. Score ${Math.round(s.score)}. ${Math.max(0, Math.ceil(s.timeLeft))} seconds left. Rings ${s.ringsPassed} of ${s.ringsTotal}.`;
}

if (shot) {
  // A staged screenshot: the world is already flown to the scene; draw once.
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = staged.best;
  window.__world = world;
  draw(ctx, world, screen, best, 0);
  announce();
} else {
  // The title screen flies itself: a slow autopilot keeps the canyon moving behind it.
  world.reset(1);
  world.state.status = STATUS_PLAY;
  const titlePilot = { roll: 0, pitch: 0, throttle: 0.45 };
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - started) / 1000;
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSE : SCREEN_PLAY;
    }
    if (screen === SCREEN_TITLE) {
      // Attract mode: drift through the canyon until the player starts.
      world.step(STEP, titlePilot);
      if (world.state.status !== STATUS_PLAY || world.state.z > 2600) {
        world.reset(1);
        world.state.status = STATUS_PLAY;
      }
      if (actions & ACTION_CONFIRM) {
        world.startRun();
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_PLAY) {
      throttle = Math.max(0.15, Math.min(1, throttle + input.throttleDelta() * dt));
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = world.step(STEP, { roll: input.roll(), pitch: input.pitch(), throttle });
        void events;
      }
      if (world.state.status === STATUS_HEATDONE) {
        saveBest();
        screen = SCREEN_HEATDONE;
      } else if (world.state.status === STATUS_OVER) {
        saveBest();
        screen = SCREEN_OVER;
      }
    } else if (screen === SCREEN_HEATDONE) {
      if (actions & ACTION_CONFIRM) {
        if (world.state.heat >= 3) {
          world.startRun();
        } else {
          world.nextHeat();
        }
        throttle = 0.65;
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        world.startRun();
        throttle = 0.65;
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_PAUSE) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
    }
    draw(ctx, world, screen, best, t);
    announce();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

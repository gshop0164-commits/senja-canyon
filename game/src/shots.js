// The screenshot scenes behind ?shot=start|play|rings|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the next ring, keep off the walls, hold a sane throttle), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, EVENT_HEAT, STATUS_PLAY } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 0;
const PLAY_SECONDS = 11;
const RINGS_SECONDS = 7.5;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer toward the next ring; the play pilot looks far ahead, the end pilot barely any. */
function autopilot(world, horizon) {
  const s = world.state;
  const ring = world.nextRing();
  const corr = world.corridorAt(s.z + 260);
  let targetDx = 0;
  let targetDy = 40;
  if (ring && ring.z - s.z < horizon * 340) {
    targetDx = ring.x - corr.cx;
    targetDy = ring.y - corr.cy;
  }
  const roll = Math.max(-1, Math.min(1, (targetDx - s.dx) * 0.006 - s.vx * 0.0016));
  const pitch = Math.max(-1, Math.min(1, (targetDy - s.dy) * 0.008 - s.vy * 0.0016));
  const throttle = 0.82;
  return { roll, pitch, throttle };
}

/** A reckless pilot for the end scene: full throttle, always drifting right, level flight
 * so it stays inside the canyon while it clips the wall. */
function recklessPilot() {
  return { roll: 0.55, pitch: 0, throttle: 1.0 };
}

/** Advance the world `seconds` at a time under the autopilot; stop early if it ends. */
function fly(world, seconds, horizon) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world, horizon));
    if (events & (EVENT_OVER | EVENT_HEAT)) break;
  }
}

/** Advance the world under the reckless pilot until it ends (or the limit is hit). */
function flyReckless(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, recklessPilot());
    if (events & (EVENT_OVER | EVENT_HEAT)) break;
  }
}

/**
 * Set `world` to the named scene (start, play, rings or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset(1);
  // The stepper only runs while the world is playing: stage the run as playing.
  world.state.status = STATUS_PLAY;
  if (name === 'play') {
    fly(world, PLAY_SECONDS, 900);
    return { screen: world.state.status === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(world.state.score) };
  }
  if (name === 'rings') {
    fly(world, RINGS_SECONDS, 900);
    return { screen: world.state.status === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(world.state.score) };
  }
  if (name === 'end') {
    // A reckless pilot: full throttle, always drifting right, so it clips the wall,
    // loses its hull and ends the run.
    flyReckless(world, END_LIMIT_SECONDS);
    return { screen: SCREEN_OVER, best: Math.round(world.state.score) };
  }
  fly(world, START_SECONDS, 900);
  // The cover stays at the canyon mouth: the first ring waits ahead, the plane sits
  // ready, and no ring swallows the frame.
  return { screen: SCREEN_TITLE, best: 0 };
}

export { SAMPLE };

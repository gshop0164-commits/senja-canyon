// The canyon, the plane and the rules of Senja Canyon. Pure simulation: no DOM, no canvas,
// so Node can import it for the logic test and the browser can run the same code.
// The canyon is a winding corridor of segments along +z. The plane flies at (z, dx, dy) where
// dx/dy are offsets from the corridor centreline; the camera sits on the plane, so steering
// moves the world, not the sprite.
import { mulberry32, makeNoise } from './random.js';
import { SEGMENT, HEAT, PLANE, SCORE, STEP } from './config.js';

export const EVENT_RING = 1;
export const EVENT_NEAR = 2;
export const EVENT_SCRAPE = 4;
export const EVENT_SPIRE = 8;
export const EVENT_OVER = 16;
export const EVENT_HEAT = 32;

export const STATUS_TITLE = 'title';
export const STATUS_PLAY = 'play';
export const STATUS_HEATDONE = 'heatdone';
export const STATUS_OVER = 'over';

/** Build one heat's canyon: segments, rings and rock spires, all from the seed. */
export function buildHeat(seed, heat) {
  const rng = mulberry32(seed * 7919 + heat * 104729 + 13);
  const noiseX = makeNoise(rng, 64);
  const noiseY = makeNoise(rng, 64);
  const noiseW = makeNoise(rng, 64);
  const length = HEAT.lengths[heat - 1];
  const count = Math.ceil(length / SEGMENT) + 4;
  const halfW = HEAT.halfWidth[heat - 1];
  const wind = 0.6 + heat * 0.35;
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const z = i * SEGMENT;
    // The centreline wanders on two time scales: a slow bend and a faster wiggle.
    const cx = (Math.sin(z * 0.00042 + heat * 1.7) * 420 + noiseX(z * 0.0011) * 260) * wind;
    const cy = Math.sin(z * 0.00031 + heat * 2.3) * 90 + noiseY(z * 0.0016) * 60;
    const w = halfW + noiseW(z * 0.0009) * 46;
    segments.push({
      z,
      cx,
      cy,
      halfW: Math.max(170, w),
      wallH: 300 + Math.abs(noiseY(z * 0.0007)) * 260,
      riverX: noiseX(z * 0.002 + 40) * w * 0.45,
      // Bands two segments long, so the canyon floor reads as strata, not a strobe.
      band: Math.floor(i / 2) % 2,
    });
  }
  const rings = [];
  for (let i = HEAT.ringEvery; i < count - 3; i += HEAT.ringEvery) {
    const s = segments[i];
    rings.push({
      z: s.z,
      x: s.cx + (rng() * 2 - 1) * s.halfW * 0.42,
      y: s.cy + 30 + rng() * 110,
      r: HEAT.ringRadius,
      passed: false,
      judged: false,
    });
  }
  const spires = [];
  for (let i = 5; i < count - 4; i += 1) {
    if (rng() > 0.16) continue;
    const s = segments[i];
    // Never plant a spire on a ring's segment, so a ring line is always flyable.
    if (rings.some((r) => Math.abs(r.z - s.z) < SEGMENT * 2)) continue;
    spires.push({
      z: s.z,
      x: s.cx + (rng() * 2 - 1) * s.halfW * 0.55,
      y: s.cy - 160,
      h: 70 + rng() * 110,
      r: 16 + rng() * 10,
      hit: false,
    });
  }
  return { segments, rings, spires, length };
}

export function createWorld(seed = 1) {
  const world = {
    seed,
    state: null,
    heat: null,
    /** Latest centre-frame message ("RING +125") and how long it has been up. */
    message: '',
    messageT: 0,
    /** Screen shake amount, 0..1, decaying every step. */
    shake: 0,
  };

  function reset(heat = 1) {
    world.heat = buildHeat(world.seed, heat);
    world.state = {
      status: STATUS_TITLE,
      heat,
      z: 0,
      dx: 0,
      dy: 40,
      vx: 0,
      vy: 0,
      speed: 0,
      throttle: 0.65,
      damage: 0,
      fuel: 100,
      score: 0,
      combo: 0,
      bestCombo: 0,
      timeLeft: HEAT.times[heat - 1],
      ringsPassed: 0,
      ringsTotal: world.heat.rings.length,
      reason: '',
      mercy: 0,
      elapsed: 0,
    };
    world.message = '';
    world.messageT = 0;
    world.shake = 0;
  }

  /** Corridor shape at world z: centreline, half-width and floor altitude. */
  function corridorAt(z) {
    const segs = world.heat.segments;
    const i = Math.max(0, Math.min(segs.length - 2, Math.floor(z / SEGMENT)));
    const a = segs[i];
    const b = segs[i + 1];
    const t = Math.max(0, Math.min(1, (z - a.z) / SEGMENT));
    return {
      cx: a.cx + (b.cx - a.cx) * t,
      cy: a.cy + (b.cy - a.cy) * t,
      halfW: a.halfW + (b.halfW - a.halfW) * t,
      wallH: a.wallH + (b.wallH - a.wallH) * t,
    };
  }

  /** The next ring the plane has not reached yet, or null when the heat has no more. */
  function nextRing() {
    const s = world.state;
    for (const ring of world.heat.rings) {
      if (!ring.judged && ring.z > s.z - SEGMENT) return ring;
    }
    return null;
  }

  /** Heading in degrees from the centreline's direction at the plane's z. */
  function heading() {
    const a = corridorAt(world.state.z);
    const b = corridorAt(world.state.z + 120);
    return Math.round(((Math.atan2(b.cx - a.cx, 120) * 180) / Math.PI + 360) % 360);
  }

  /**
   * One fixed step. `steer` is { roll: -1..1, pitch: -1..1, throttle: 0..1 }.
   * Returns an event bitmask (EVENT_*), so the renderer and tests can react to what happened.
   */
  function step(dt, steer) {
    const s = world.state;
    let events = 0;
    if (s.status !== STATUS_PLAY) return events;
    s.elapsed += dt;
    s.mercy = Math.max(0, s.mercy - dt);
    world.messageT = Math.max(0, world.messageT - dt);
    world.shake = Math.max(0, world.shake - dt * 2.2);

    // Throttle: the plane chases its target speed; empty fuel caps the throttle.
    const throttle = s.fuel <= 0 ? Math.min(steer.throttle, HEAT.fuelEmptyThrottle) : steer.throttle;
    s.throttle = throttle;
    const maxSpeed = HEAT.maxSpeed[s.heat - 1];
    const target = throttle * maxSpeed;
    s.speed += (target - s.speed) * Math.min(1, dt * 0.9);
    s.z += s.speed * dt;
    s.score += s.speed * dt * SCORE.distance;

    // Steering: velocity with damping, so the plane banks into turns instead of teleporting.
    const corr = corridorAt(s.z);
    s.vx += steer.roll * PLANE.steerAccel * dt;
    s.vy += steer.pitch * PLANE.pitchAccel * dt;
    s.vx *= Math.max(0, 1 - PLANE.damp * dt);
    s.vy *= Math.max(0, 1 - PLANE.damp * dt);
    s.dx += s.vx * dt;
    s.dy += s.vy * dt;
    // A gentle pull back toward the centreline keeps a drifting plane honest.
    s.dx -= s.dx * 0.12 * dt;
    s.dy += (40 - s.dy) * 0.1 * dt;
    s.dy = Math.max(PLANE.groundFloor, Math.min(PLANE.ceiling, s.dy));
    // The canyon wall is solid: a plane pressed against it stops there instead of
    // flying out of the world. Scraping still hurts while it pushes on the rock.
    const maxDx = corr.halfW - 12;
    if (s.dx > maxDx) {
      s.dx = maxDx;
      if (s.vx > 0) s.vx = 0;
    } else if (s.dx < -maxDx) {
      s.dx = -maxDx;
      if (s.vx < 0) s.vx = 0;
    }

    // Fuel drains with throttle; a ring pass refills some of it.
    s.fuel = Math.max(0, s.fuel - throttle * HEAT.fuelDrain * dt);

    // Wall and ground scrapes: damage, a speed penalty, shake and a warning.
    const scraping =
      Math.abs(s.dx) > corr.halfW - PLANE.wallMargin || s.dy <= PLANE.groundFloor + 2;
    if (scraping) {
      s.damage = Math.min(100, s.damage + PLANE.scrapeDamage * dt);
      s.speed *= Math.max(0.55, 1 - 0.5 * dt);
      s.combo = 0;
      world.shake = Math.min(1, world.shake + dt * 3);
      events |= EVENT_SCRAPE;
    }

    // Rock spires inside the corridor: one solid hit, then a second of mercy.
    for (const spire of world.heat.spires) {
      if (spire.hit || s.mercy > 0) continue;
      if (Math.abs(spire.z - s.z) > SEGMENT) continue;
      const ox = spire.x - (corr.cx + s.dx);
      const oy = spire.y + spire.h / 2 - (corr.cy + s.dy);
      if (Math.abs(ox) < spire.r + 26 && Math.abs(oy) < spire.h / 2 + 26) {
        spire.hit = true;
        s.damage = Math.min(100, s.damage + PLANE.spireDamage);
        s.speed *= 0.6;
        s.combo = 0;
        s.mercy = PLANE.spireMercy;
        world.shake = 1;
        world.message = 'ROCK HIT −25';
        world.messageT = 1.2;
        events |= EVENT_SPIRE;
      }
    }

    // Rings: judged the moment the plane's z passes them.
    for (const ring of world.heat.rings) {
      if (ring.judged || ring.z > s.z) continue;
      ring.judged = true;
      const ox = ring.x - (corr.cx + s.dx);
      const oy = ring.y - (corr.cy + s.dy);
      const dist = Math.hypot(ox, oy);
      if (dist <= ring.r) {
        ring.passed = true;
        s.ringsPassed += 1;
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        const points = SCORE.ring + (s.combo - 1) * SCORE.comboStep;
        s.score += points;
        s.timeLeft = Math.min(HEAT.times[s.heat - 1] + 10, s.timeLeft + HEAT.ringTimeBonus);
        s.fuel = Math.min(100, s.fuel + HEAT.fuelRing);
        world.message = `RING +${points}`;
        world.messageT = 1.1;
        events |= EVENT_RING;
      } else if (dist <= ring.r + 55) {
        s.score += SCORE.nearMiss;
        world.message = `NEAR MISS +${SCORE.nearMiss}`;
        world.messageT = 1.0;
        events |= EVENT_NEAR;
      } else {
        s.combo = 0;
      }
    }

    // The clock decides the heat: out of time, out of hull, or past the finish line.
    s.timeLeft -= dt;
    if (s.damage >= 100) {
      s.status = STATUS_OVER;
      s.reason = 'crash';
      events |= EVENT_OVER;
    } else if (s.timeLeft <= 0) {
      s.timeLeft = 0;
      s.status = STATUS_OVER;
      s.reason = 'time';
      events |= EVENT_OVER;
    } else if (s.z >= world.heat.length) {
      const bonus = Math.round(s.timeLeft * SCORE.timeBonus + (100 - s.damage) * SCORE.healthBonus);
      s.score += bonus;
      s.status = STATUS_HEATDONE;
      s.reason = 'finish';
      events |= EVENT_HEAT;
    }
    return events;
  }

  reset(1);

  return {
    get state() {
      return world.state;
    },
    get heat() {
      return world.heat;
    },
    get message() {
      return world.message;
    },
    get messageT() {
      return world.messageT;
    },
    get shake() {
      return world.shake;
    },
    reset,
    corridorAt,
    nextRing,
    heading,
    step,
    /** Start a fresh run from heat 1 (used by the title screen and by restart). */
    startRun() {
      reset(1);
      world.state.status = STATUS_PLAY;
    },
    /** Advance to the next heat after a heat-complete screen. */
    nextHeat() {
      const s = world.state;
      const carried = { score: s.score, bestCombo: s.bestCombo };
      reset(s.heat + 1);
      world.state.score = carried.score;
      world.state.bestCombo = carried.bestCombo;
      world.state.status = STATUS_PLAY;
    },
  };
}

export { STEP };

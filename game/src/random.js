// Seeded random numbers for Senja Canyon: one tiny generator, used everywhere the world
// needs to be the same for the same seed (track, rings, spires, clouds).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth value-noise helper: random values at integer knots, cosine-interpolated. */
export function makeNoise(rng, knots) {
  const values = [];
  for (let i = 0; i < knots; i += 1) values.push(rng() * 2 - 1);
  return function noise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = values[((xi % knots) + knots) % knots];
    const b = values[(((xi + 1) % knots) + knots) % knots];
    const u = (1 - Math.cos(xf * Math.PI)) / 2;
    return a + (b - a) * u;
  };
}

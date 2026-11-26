// Every tuning number and colour for Senja Canyon in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule depends on the
// screen size.
export const FIELD = { width: 1280, height: 720, horizonY: 324 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Length of one canyon segment, in world units, and how far ahead the renderer draws. */
export const SEGMENT = 40;
export const DRAW_SEGMENTS = 56;

/** Camera depth for the perspective projection (larger = narrower field of view). */
export const CAM_DEPTH = 0.9;

export const PLANE = {
  /** Lateral and vertical steering acceleration, and how quickly the plane settles. */
  steerAccel: 1500,
  pitchAccel: 1200,
  damp: 2.6,
  /** How far from the canyon centreline the plane may fly before it scrapes a wall. */
  wallMargin: 34,
  /** Lowest altitude offset (below the centreline) before the ground scrapes. */
  groundFloor: -150,
  /** Highest altitude offset the plane can reach. */
  ceiling: 300,
  /** Damage per second while scraping, and damage from one spire hit. */
  scrapeDamage: 14,
  spireDamage: 25,
  /** Seconds of mercy after a spire hit before another can hurt. */
  spireMercy: 1.0,
};

export const HEAT = {
  count: 3,
  /** Heat length in world units, time limit in seconds, top speed, corridor half-width. */
  lengths: [3800, 4600, 5200],
  times: [80, 85, 90],
  maxSpeed: [300, 340, 380],
  halfWidth: [300, 270, 240],
  /** Ring every N segments, and the seconds a ring pass adds to the clock. */
  ringEvery: 7,
  ringTimeBonus: 3,
  ringRadius: 92,
  /** Fuel: drains with throttle, refills on a ring pass, empty fuel caps the throttle. */
  fuelDrain: 2.1,
  fuelRing: 12,
  fuelEmptyThrottle: 0.45,
};

export const SCORE = {
  ring: 100,
  comboStep: 25,
  nearMiss: 25,
  /** Points per world unit flown, and the heat-complete bonus multipliers. */
  distance: 0.02,
  timeBonus: 10,
  healthBonus: 2,
};

export const PALETTE = {
  skyTop: '#2b1b4d',
  skyMid: '#7a2e5e',
  skyLow: '#e8703a',
  horizon: '#ffb347',
  sun: '#ffd98a',
  sunGlow: 'rgba(255, 190, 90, 0.55)',
  mesaFar: '#5c2a52',
  mesaNear: '#74352f',
  rockA: '#a34a28',
  rockB: '#93401f',
  rockRim: '#e08a4c',
  floor: '#c97e4a',
  floorDark: '#bd7442',
  river: '#2f6b7a',
  riverLight: '#5a9aa8',
  ring: '#ff9d2e',
  ringCore: '#fff3d6',
  planeRed: '#d9382b',
  planeWhite: '#f4ede1',
  planeDark: '#3a2a26',
  hud: '#fff3d6',
  hudMuted: '#e8b48a',
  panel: 'rgba(30, 14, 26, 0.82)',
  danger: '#ff5a3c',
  fuel: '#ffb347',
  ok: '#8fe388',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'senja-canyon.best';

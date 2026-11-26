// Keyboard and pointer input for Senja Canyon. Held keys steer and throttle; one-shot
// presses (start, pause) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The pointer steers too: hold
// and drag left or right, and the wheel nudges the throttle.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['KeyE']);
const THROTTLE_DOWN = new Set(['KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let pointerSteer = 0;
  let dragging = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      held.add(event.code);
    } else if (THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
    pointerSteer = 0;
  });
  target.addEventListener('pointerdown', (event) => {
    dragging = true;
    pointerSteer = 0;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  target.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = target.getBoundingClientRect();
    pointerSteer = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2.4));
  });
  target.addEventListener('pointerup', () => {
    dragging = false;
    pointerSteer = 0;
  });
  target.addEventListener('wheel', (event) => {
    if (event.deltaY < 0) held.add('__wheelUp');
    else held.add('__wheelDown');
    event.preventDefault();
  }, { passive: false });

  const has = (set) => [...set].some((code) => held.has(code));

  return {
    /** -1 for left, 1 for right, 0 for neither or both (pointer drag overrides keys). */
    roll() {
      if (dragging && pointerSteer !== 0) return pointerSteer;
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    /** -1 for down, 1 for up. */
    pitch() {
      return (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
    },
    /** Throttle change per second from held keys or the wheel; cleared after one read. */
    throttleDelta() {
      let d = (has(THROTTLE_UP) ? 0.6 : 0) - (has(THROTTLE_DOWN) ? 0.6 : 0);
      if (held.has('__wheelUp')) d += 0.25;
      if (held.has('__wheelDown')) d -= 0.25;
      held.delete('__wheelUp');
      held.delete('__wheelDown');
      return d;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

// Everything Senja Canyon draws: the sunset sky, the canyon in pseudo-3D, the rings, the
// stunt plane, the HUD and the screens. The canyon is drawn back-to-front, one segment at a
// time, with a simple perspective projection; the plane is a sprite flown over it.
import { FIELD, PALETTE, FONT, CAM_DEPTH, SEGMENT, DRAW_SEGMENTS, HEAT } from './config.js';
import { STATUS_TITLE, STATUS_PLAY, STATUS_HEATDONE, STATUS_OVER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_HEATDONE = 'heatdone';
export const SCREEN_OVER = 'over';

const { width: W, height: H, horizonY } = FIELD;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a colour toward the haze colour as a segment gets farther away. */
function fogged(hex, f) {
  const a = hexRgb(hex);
  const b = hexRgb(PALETTE.skyLow);
  const t = Math.max(0, Math.min(1, f));
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

/** Project a world point to the screen; null when it is behind the camera. */
function project(wx, wy, wz, cam) {
  const dz = wz - cam.z;
  if (dz < 6) return null;
  const scale = CAM_DEPTH / dz;
  return {
    x: W / 2 + scale * (wx - cam.x) * (W / 2),
    y: horizonY - scale * (wy - cam.y) * (H / 2),
    scale,
    fog: Math.min(1, dz / (DRAW_SEGMENTS * SEGMENT)),
  };
}

function quad(ctx, p1, p2, p3, p4, fill) {
  if (!p1 || !p2 || !p3 || !p4) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fill();
}

function drawSky(ctx, camX, t) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.skyMid);
  g.addColorStop(0.85, PALETTE.skyLow);
  g.addColorStop(1, PALETTE.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizonY + 40);
  // The low sun, with a warm glow.
  const sunX = W * 0.76;
  const sunY = horizonY - 132;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  glow.addColorStop(0, PALETTE.sunGlow);
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
  ctx.fill();
  // Slow clouds, drifting with time and parallaxed by the camera.
  ctx.fillStyle = 'rgba(255, 214, 170, 0.5)';
  for (let i = 0; i < 5; i += 1) {
    const cx = ((i * 317 + t * (6 + i * 2) - camX * 0.02) % (W + 320) + W + 320) % (W + 320) - 160;
    const cy = 66 + i * 34;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 74 + i * 9, 13 + (i % 3) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Distant mesas: two silhouette layers, parallaxed and wrapping.
  for (let layer = 0; layer < 2; layer += 1) {
    const base = horizonY - 6 - layer * 26;
    const off = ((-camX * (0.03 + layer * 0.03)) % 420 + 420) % 420;
    ctx.fillStyle = layer === 0 ? PALETTE.mesaFar : PALETTE.mesaNear;
    ctx.beginPath();
    ctx.moveTo(-40, base + 8);
    for (let x = -40 - off; x < W + 60; x += 140) {
      const h = 34 + ((Math.floor((x + off) / 140) * 37) % 52);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + 88, base - h);
      ctx.lineTo(x + 104, base + 8);
    }
    ctx.lineTo(W + 40, base + 8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRing(ctx, ring, cam) {
  const c = project(ring.x, ring.y, ring.z, cam);
  if (!c) return;
  const r = c.scale * ring.r * (W / 2);
  if (r < 3) return;
  ctx.save();
  if (ring.judged && !ring.passed) ctx.globalAlpha = 0.3;
  ctx.shadowColor = PALETTE.ring;
  ctx.shadowBlur = Math.min(34, r * 0.5);
  ctx.strokeStyle = PALETTE.ring;
  ctx.lineWidth = Math.max(3, r * 0.13);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = PALETTE.ringCore;
  ctx.lineWidth = Math.max(2, r * 0.045);
  ctx.setLineDash([r * 0.3, r * 0.22]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSpire(ctx, spire, cam) {
  const baseL = project(spire.x - spire.r, spire.y, spire.z, cam);
  const baseR = project(spire.x + spire.r, spire.y, spire.z, cam);
  const topL = project(spire.x - spire.r * 0.35, spire.y + spire.h, spire.z, cam);
  const topR = project(spire.x + spire.r * 0.35, spire.y + spire.h, spire.z, cam);
  if (!baseL || !baseR || !topL || !topR) return;
  quad(ctx, baseL, baseR, topR, topL, fogged('#4a2113', baseL.fog));
  ctx.strokeStyle = fogged(PALETTE.rockRim, baseL.fog);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(topL.x, topL.y);
  ctx.lineTo(baseL.x, baseL.y);
  ctx.stroke();
}

function drawPillar(ctx, seg, side, cam) {
  const x = seg.cx + side * (seg.halfW - 16);
  const top = seg.cy + seg.wallH * 0.82;
  const a = project(x - 15, seg.cy, seg.z, cam);
  const b = project(x + 15, seg.cy, seg.z, cam);
  const c = project(x + 11, top, seg.z, cam);
  const d = project(x - 11, top, seg.z, cam);
  if (!a || !b || !c || !d) return;
  quad(ctx, a, b, c, d, fogged(side < 0 ? '#8a3c1e' : '#6e2c14', a.fog));
  ctx.strokeStyle = fogged(PALETTE.rockRim, a.fog);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
}

function drawArch(ctx, seg, cam) {
  const y0 = seg.cy + seg.wallH * 0.68;
  const y1 = y0 + 18;
  const a = project(seg.cx - seg.halfW, y0, seg.z, cam);
  const b = project(seg.cx + seg.halfW, y0, seg.z, cam);
  const c = project(seg.cx + seg.halfW, y1, seg.z, cam);
  const d = project(seg.cx - seg.halfW, y1, seg.z, cam);
  if (!a || !b || !c || !d) return;
  quad(ctx, a, b, c, d, fogged('#7e3519', a.fog));
  ctx.strokeStyle = fogged(PALETTE.rockRim, a.fog);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
}

function drawSegment(ctx, a, b, cam) {
  const aL = project(a.cx - a.halfW, a.cy, a.z, cam);
  const aR = project(a.cx + a.halfW, a.cy, a.z, cam);
  const bL = project(b.cx - b.halfW, b.cy, b.z, cam);
  const bR = project(b.cx + b.halfW, b.cy, b.z, cam);
  if (!aL || !aR || !bL || !bR) return;
  const fog = aL.fog;
  const floorCol = fogged(a.band === 0 ? PALETTE.floor : PALETTE.floorDark, fog);
  quad(ctx, aL, aR, bR, bL, floorCol);
  // The river ribbon down the canyon floor: narrow, so it reads as a river, not a road.
  const aRivL = project(a.cx + a.riverX - 16, a.cy + 2, a.z, cam);
  const aRivR = project(a.cx + a.riverX + 16, a.cy + 2, a.z, cam);
  const bRivL = project(b.cx + b.riverX - 16, b.cy + 2, b.z, cam);
  const bRivR = project(b.cx + b.riverX + 16, b.cy + 2, b.z, cam);
  quad(ctx, aRivL, aRivR, bRivR, bRivL, fogged(a.band === 0 ? PALETTE.river : PALETTE.riverLight, fog));
  // Walls on both sides.
  const aTL = project(a.cx - a.halfW, a.cy + a.wallH, a.z, cam);
  const bTL = project(b.cx - b.halfW, b.cy + b.wallH, b.z, cam);
  const aTR = project(a.cx + a.halfW, a.cy + a.wallH, a.z, cam);
  const bTR = project(b.cx + b.halfW, b.cy + b.wallH, b.z, cam);
  quad(ctx, aL, aTL, bTL, bL, fogged(a.band === 0 ? PALETTE.rockA : PALETTE.rockB, fog));
  quad(ctx, aR, bR, bTR, aTR, fogged(a.band === 0 ? PALETTE.rockB : PALETTE.rockA, fog));
  // Strata lines across both walls, so the rock reads as layered, not flat.
  ctx.strokeStyle = fogged('#5e2a14', fog);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.2;
  for (const f of [0.36, 0.68]) {
    const l1 = project(a.cx - a.halfW, a.cy + a.wallH * f, a.z, cam);
    const l2 = project(b.cx - b.halfW, b.cy + b.wallH * f, b.z, cam);
    const r1 = project(a.cx + a.halfW, a.cy + a.wallH * f, a.z, cam);
    const r2 = project(b.cx + b.halfW, b.cy + b.wallH * f, b.z, cam);
    if (l1 && l2) {
      ctx.beginPath();
      ctx.moveTo(l1.x, l1.y);
      ctx.lineTo(l2.x, l2.y);
      ctx.stroke();
    }
    if (r1 && r2) {
      ctx.beginPath();
      ctx.moveTo(r1.x, r1.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // Sunlit rim along the wall tops.
  ctx.strokeStyle = fogged(PALETTE.rockRim, fog);
  ctx.lineWidth = 1 + (1 - fog) * 2.5;
  ctx.beginPath();
  ctx.moveTo(aTL.x, aTL.y);
  ctx.lineTo(bTL.x, bTL.y);
  ctx.moveTo(aTR.x, aTR.y);
  ctx.lineTo(bTR.x, bTR.y);
  ctx.stroke();
}

function drawWorld(ctx, world, t) {
  const s = world.state;
  const corr = world.corridorAt(s.z);
  // The camera trails the plane laterally: even pinned against a wall, the camera stays
  // inside the corridor, so the canyon never vanishes behind the frame's edge.
  const cam = { x: corr.cx + s.dx * 0.55, y: corr.cy + s.dy * 0.55 + 55, z: s.z };
  drawSky(ctx, cam.x, t);
  const segs = world.heat.segments;
  const base = Math.max(0, Math.floor(s.z / SEGMENT));
  for (let n = DRAW_SEGMENTS - 1; n >= 0; n -= 1) {
    const i = base + n;
    if (i >= segs.length - 1) continue;
    drawSegment(ctx, segs[i], segs[i + 1], cam);
    // Things that live on this segment, drawn over it before nearer ground.
    const z0 = segs[i].z;
    const z1 = segs[i + 1].z;
    for (const ring of world.heat.rings) {
      if (!ring.passed && ring.z >= z0 && ring.z < z1) drawRing(ctx, ring, cam);
    }
    for (const spire of world.heat.spires) {
      if (!spire.hit && spire.z >= z0 && spire.z < z1) drawSpire(ctx, spire, cam);
    }
    if (i % 9 === 4) drawPillar(ctx, segs[i], i % 18 === 4 ? -1 : 1, cam);
    if (i % 23 === 11) drawArch(ctx, segs[i], cam);
  }
  return cam;
}

function drawPlane(ctx, world, t) {
  const s = world.state;
  const bank = Math.max(-0.55, Math.min(0.55, s.vx / 900));
  const px = W / 2 + s.dx * 0.32;
  const py = H * 0.68 - s.dy * 0.22;
  const sc = 1 + (s.speed / 380) * 0.1;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(bank);
  ctx.scale(sc, sc);
  // Speed streaks when fast.
  if (s.speed > 220) {
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const y = -60 + i * 30 + ((t * 900 + i * 47) % 30);
      ctx.beginPath();
      ctx.moveTo(-190, y);
      ctx.lineTo(-150, y);
      ctx.moveTo(150, y);
      ctx.lineTo(190, y);
      ctx.stroke();
    }
  }
  // Wings, swept back, seen from behind.
  ctx.fillStyle = PALETTE.planeWhite;
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-138, 26);
  ctx.lineTo(-128, 40);
  ctx.lineTo(-10, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.lineTo(138, 26);
  ctx.lineTo(128, 40);
  ctx.lineTo(10, 22);
  ctx.closePath();
  ctx.fill();
  // Tail fin and stabilisers.
  ctx.fillStyle = PALETTE.planeRed;
  ctx.beginPath();
  ctx.moveTo(-4, -6);
  ctx.lineTo(0, -44);
  ctx.lineTo(8, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeWhite;
  ctx.beginPath();
  ctx.moveTo(-52, 4);
  ctx.lineTo(-8, 10);
  ctx.lineTo(-8, 20);
  ctx.lineTo(-52, 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(52, 4);
  ctx.lineTo(8, 10);
  ctx.lineTo(8, 20);
  ctx.lineTo(52, 14);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a rounded body with a white cheatline and a dark canopy.
  ctx.fillStyle = PALETTE.planeRed;
  ctx.beginPath();
  ctx.ellipse(0, 8, 26, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.planeWhite;
  ctx.fillRect(-24, 2, 48, 5);
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath();
  ctx.ellipse(0, -6, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Engine glow and wingtip lights.
  const flick = 0.7 + Math.sin(t * 31) * 0.3;
  ctx.fillStyle = `rgba(255, 157, 46, ${0.55 * flick})`;
  ctx.beginPath();
  ctx.ellipse(0, 22, 10, 6 + flick * 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#39d353';
  ctx.beginPath();
  ctx.arc(-136, 33, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(136, 33, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Damage smoke trailing off the wing.
  if (s.damage > 45) {
    ctx.fillStyle = 'rgba(60, 50, 50, 0.4)';
    for (let i = 0; i < 3; i += 1) {
      const oy = ((t * 60 + i * 23) % 70);
      ctx.beginPath();
      ctx.arc(px - 40 + i * 8, py - 30 - oy, 7 + oy * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Sparks while scraping a wall or the ground.
  if (world.shake > 0.25) {
    ctx.fillStyle = '#ffb347';
    for (let i = 0; i < 8; i += 1) {
      const a = (t * 9 + i * 1.7) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * (60 + i * 9), py + Math.sin(a) * 26, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function bar(ctx, x, y, w, h, frac, fill, label) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.max(0, Math.min(1, frac))), h - 4);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + h / 2 + 0.5);
}

function drawHUD(ctx, world, screen, best) {
  const s = world.state;
  // Slim top banner: score left, clock centre, heat and best right. The title screen
  // draws its own banner, so the HUD skips it there instead of doubling up.
  if (screen !== SCREEN_TITLE) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, W, 52);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(s.score)}`, 18, 27);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText('SENJA CANYON', 18, 12);
    const mm = Math.floor(Math.max(0, s.timeLeft) / 60);
    const ss = Math.floor(Math.max(0, s.timeLeft) % 60);
    ctx.fillStyle = s.timeLeft < 10 ? PALETTE.danger : PALETTE.hud;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, W / 2, 27);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`HEAT ${s.heat}/3`, W - 18, 19);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`BEST ${best}`, W - 18, 38);
  }
  // Instrument boxes, bottom left.
  const spd = Math.round(s.speed * 1.4);
  const alt = Math.max(0, Math.round((s.dy + 160) * 2.2));
  const hdg = world.heading();
  const boxes = [
    [`SPD`, `${spd} kt`],
    [`ALT`, `${alt} m`],
    [`HDG`, `${String(hdg).padStart(3, '0')}°`],
  ];
  ctx.textAlign = 'left';
  boxes.forEach(([label, value], i) => {
    const x = 18 + i * 128;
    ctx.fillStyle = 'rgba(30, 14, 26, 0.72)';
    ctx.fillRect(x, H - 56, 116, 42);
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, H - 55.5, 116, 42);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(label, x + 10, H - 42);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(value, x + 10, H - 24);
  });
  // Damage and fuel, bottom right.
  bar(ctx, W - 268, H - 56, 250, 18, 1 - s.damage / 100, s.damage > 60 ? PALETTE.danger : PALETTE.ok, `HULL ${Math.round(100 - s.damage)}%`);
  bar(ctx, W - 268, H - 32, 250, 18, s.fuel / 100, s.fuel < 20 ? PALETTE.danger : PALETTE.fuel, `FUEL ${Math.round(s.fuel)}%`);
  if (s.fuel < 20 && s.status === STATUS_PLAY) {
    ctx.fillStyle = Math.floor(performance.now() / 400) % 2 === 0 ? PALETTE.danger : PALETTE.hud;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL — EASE OFF THE THROTTLE', W / 2, H - 76);
  }
  if (s.combo >= 2 && screen !== SCREEN_TITLE) {
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO x${s.combo}`, W / 2, 78);
  }
  if (world.messageT > 0 && world.message && screen !== SCREEN_TITLE) {
    ctx.globalAlpha = Math.min(1, world.messageT);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(world.message, W / 2, H * 0.3);
    ctx.globalAlpha = 1;
  }
}

function card(ctx, lines, accent) {
  const w = 560;
  const h = 64 + lines.length * 34;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.textAlign = 'center';
  lines.forEach(([text, size, color], i) => {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillText(text, W / 2, y + 44 + i * 34);
  });
}

/** Draw one frame: world + plane + HUD + the screen overlay. */
export function draw(ctx, world, screen, best, t) {
  const s = world.state;
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake * 10, (Math.random() - 0.5) * world.shake * 8);
  }
  drawWorld(ctx, world, t);
  drawPlane(ctx, world, t);
  ctx.restore();
  drawHUD(ctx, world, screen, best);
  if (screen === SCREEN_TITLE) {
    // An opaque slim banner, so no HUD text ghosts through it.
    ctx.fillStyle = '#1e0e1a';
    ctx.fillRect(0, 0, W, 52);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('SENJA CANYON', W / 2, 34);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('Sunset canyon stunt racer — thread the rings, mind the rock', W / 2, H - 128);
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = Math.floor(t * 1.6) % 2 === 0 ? PALETTE.ring : PALETTE.hud;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY', W / 2, H - 98);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText('Arrows / WASD — steer and climb · W/S — throttle · P — pause', W / 2, H - 70);
    if (best > 0) {
      ctx.fillStyle = PALETTE.hud;
      ctx.fillText(`BEST SCORE ${best}`, W / 2, H - 44);
    }
  } else if (screen === SCREEN_PAUSE) {
    ctx.fillStyle = 'rgba(20, 8, 18, 0.6)';
    ctx.fillRect(0, 0, W, H);
    card(ctx, [['PAUSED', 30, PALETTE.hud], ['P or Esc to resume', 16, PALETTE.hudMuted]], PALETTE.ring);
  } else if (screen === SCREEN_HEATDONE) {
    card(
      ctx,
      [
        [`HEAT ${s.heat} CLEAR!`, 30, PALETTE.ring],
        [`Rings ${s.ringsPassed}/${s.ringsTotal} · Score ${Math.round(s.score)}`, 17, PALETTE.hud],
        ['SPACE — NEXT HEAT', 16, PALETTE.hudMuted],
      ],
      PALETTE.ring,
    );
  } else if (screen === SCREEN_OVER) {
    const title =
      s.reason === 'crash'
        ? 'CRASHED INTO THE CANYON'
        : s.reason === 'time'
          ? 'OUT OF TIME'
          : 'RUN COMPLETE';
    card(
      ctx,
      [
        [title, 28, s.reason === 'finish' ? PALETTE.ok : PALETTE.danger],
        [`Score ${Math.round(s.score)} · Best combo x${s.bestCombo} · Rings ${s.ringsPassed}/${s.ringsTotal}`, 17, PALETTE.hud],
        [`BEST ${Math.max(best, Math.round(s.score))}`, 16, PALETTE.hudMuted],
        ['SPACE — FLY AGAIN', 16, PALETTE.hudMuted],
      ],
      s.reason === 'finish' ? PALETTE.ok : PALETTE.danger,
    );
  }
  // A soft vignette so the frame reads as one picture.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20,8,18,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

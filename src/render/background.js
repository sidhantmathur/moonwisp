// Parallax background: gradient sky, three silhouette ridge layers generated
// deterministically, and slow-drifting light motes.

import { PALETTE } from './palette.js';

function hash(n) {
  let h = (n * 2654435761) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Height of a ridge layer at world column i (smooth-ish value noise).
function ridge(i, seed) {
  const a = hash(Math.floor(i) + seed * 1000);
  const b = hash(Math.floor(i) + 1 + seed * 1000);
  const t = i - Math.floor(i);
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

export class Background {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.motes = Array.from({ length: 26 }, (_, i) => ({
      x: hash(i) * viewW,
      y: hash(i + 50) * viewH,
      speed: 3 + hash(i + 100) * 8,
      size: hash(i + 150) < 0.7 ? 1 : 2,
      phase: hash(i + 200) * Math.PI * 2,
    }));
    this._sky = null;
  }

  _skyGradient(ctx) {
    if (!this._sky) {
      this._sky = ctx.createLinearGradient(0, 0, 0, this.viewH);
      this._sky.addColorStop(0, PALETTE.skyTop);
      this._sky.addColorStop(1, PALETTE.skyBottom);
    }
    return this._sky;
  }

  _drawRidge(ctx, camX, camY, factor, seed, color, baseY, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.viewH);
    const step = 8;
    for (let sx = 0; sx <= this.viewW + step; sx += step) {
      const worldX = (sx + camX * factor) / 46;
      const h = ridge(worldX, seed);
      const y = baseY - h * amp - camY * factor * 0.35;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(this.viewW, this.viewH);
    ctx.closePath();
    ctx.fill();
  }

  draw(ctx, camX, camY, time) {
    ctx.fillStyle = this._skyGradient(ctx);
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // A big low moon.
    const moonX = this.viewW * 0.78 - camX * 0.02;
    const moonY = this.viewH * 0.22 - camY * 0.02;
    ctx.fillStyle = '#e8e4f420';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cfc8e6';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9b1d6';
    ctx.beginPath();
    ctx.arc(moonX - 5, moonY + 3, 4, 0, Math.PI * 2);
    ctx.arc(moonX + 6, moonY - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    this._drawRidge(ctx, camX, camY, 0.12, 1, PALETTE.parallaxFar, this.viewH * 0.72, 105);
    this._drawRidge(ctx, camX, camY, 0.25, 2, PALETTE.parallaxMid, this.viewH * 0.86, 120);
    this._drawRidge(ctx, camX, camY, 0.45, 3, PALETTE.parallaxNear, this.viewH * 1.02, 130);

    // Drifting motes.
    ctx.fillStyle = PALETTE.mote;
    for (const m of this.motes) {
      const x = (m.x + time * m.speed - camX * 0.3) % this.viewW;
      const y = (m.y + Math.sin(time * 0.6 + m.phase) * 10 - camY * 0.3) % this.viewH;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time + m.phase);
      ctx.fillRect((x + this.viewW) % this.viewW, (y + this.viewH) % this.viewH, m.size, m.size);
    }
    ctx.globalAlpha = 1;
  }
}

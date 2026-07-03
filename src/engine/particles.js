// Pooled particle system. Emitters are just helper functions; particles are
// simple structs updated in place and drawn as filled rects (pixel look).

import { PALETTE } from '../render/palette.js';

const POOL_SIZE = 512;

export class Particles {
  constructor() {
    this.pool = Array.from({ length: POOL_SIZE }, () => ({ alive: false }));
    this._next = 0;
  }

  spawn(props) {
    const p = this.pool[this._next];
    this._next = (this._next + 1) % POOL_SIZE;
    Object.assign(p, {
      alive: true,
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0.5, age: 0,
      size: 2, color: PALETTE.dust,
      gravity: 0, drag: 0, fade: true, shrink: false,
    }, props);
    return p;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      p.vy += p.gravity * dt;
      if (p.drag) {
        p.vx -= p.vx * p.drag * dt;
        p.vy -= p.vy * p.drag * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx, viewX, viewY) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.age / p.life;
      ctx.globalAlpha = p.fade ? 1 - t : 1;
      const s = p.shrink ? Math.max(1, p.size * (1 - t)) : p.size;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - viewX - s / 2), Math.round(p.y - viewY - s / 2), Math.round(s), Math.round(s));
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }

  // --- Emitters ---

  landingDust(x, y, strength = 1) {
    const n = Math.round(4 + strength * 5);
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (Math.random() * 10 - 5), y,
        vx: (Math.random() * 2 - 1) * 55 * strength,
        vy: -Math.random() * 26 * strength,
        life: 0.28 + Math.random() * 0.22,
        size: 2 + Math.random() * 2,
        color: PALETTE.dust, drag: 5, shrink: true,
      });
    }
  }

  runDust(x, y, dir) {
    this.spawn({
      x: x + (Math.random() * 4 - 2), y,
      vx: -dir * (18 + Math.random() * 20),
      vy: -8 - Math.random() * 14,
      life: 0.25 + Math.random() * 0.15,
      size: 2, color: PALETTE.dust, drag: 4, shrink: true,
    });
  }

  jumpPuff(x, y) {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI; // downward fan
      this.spawn({
        x, y,
        vx: Math.cos(a) * 34, vy: -Math.sin(a) * 20,
        life: 0.22 + Math.random() * 0.1,
        size: 2, color: PALETTE.dust, drag: 5, shrink: true,
      });
    }
  }

  coinBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sp = 46 + Math.random() * 36;
      this.spawn({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 22,
        life: 0.35 + Math.random() * 0.25,
        size: 2, color: i % 3 ? PALETTE.coin : PALETTE.coinGlint,
        gravity: 240, drag: 2, shrink: true,
      });
    }
  }

  deathBurst(x, y, color = PALETTE.playerBody) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.spawn({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.5,
        size: 2 + Math.random() * 3,
        color: i % 4 === 0 ? PALETTE.white : color,
        gravity: 330, drag: 1.4,
      });
    }
  }

  springBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      this.spawn({
        x: x + (Math.random() * 12 - 6), y,
        vx: (Math.random() * 2 - 1) * 40,
        vy: -60 - Math.random() * 60,
        life: 0.3 + Math.random() * 0.2,
        size: 2, color: PALETTE.spring, drag: 3, shrink: true,
      });
    }
  }

  stompBurst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI;
      const sp = 40 + Math.random() * 70;
      this.spawn({
        x, y,
        vx: Math.cos(a + Math.PI) * sp, vy: -Math.abs(Math.sin(a)) * sp,
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 2, color,
        gravity: 300,
      });
    }
  }

  checkpointGlow(x, y) {
    for (let i = 0; i < 14; i++) {
      this.spawn({
        x: x + (Math.random() * 14 - 7), y: y + Math.random() * 20 - 4,
        vx: (Math.random() * 2 - 1) * 12,
        vy: -24 - Math.random() * 30,
        life: 0.6 + Math.random() * 0.4,
        size: 2, color: PALETTE.checkpointLit, drag: 1.5, shrink: true,
      });
    }
  }

  portalSwirl(x, y, t) {
    // Ambient — call sparsely from the exit portal's update.
    const a = t * 3 + Math.random() * 0.6;
    const r = 10 + Math.random() * 4;
    this.spawn({
      x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
      vx: -Math.cos(a) * 14, vy: -Math.sin(a) * 14 - 6,
      life: 0.5 + Math.random() * 0.3,
      size: 2, color: PALETTE.portal, shrink: true,
    });
  }

  lavaEmber(x, y) {
    this.spawn({
      x, y,
      vx: (Math.random() * 2 - 1) * 8,
      vy: -14 - Math.random() * 22,
      life: 0.7 + Math.random() * 0.5,
      size: 2, color: Math.random() < 0.3 ? PALETTE.lavaBright : PALETTE.lava,
      drag: 1, shrink: true,
    });
  }
}

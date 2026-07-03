// All non-player entities. Each actor: { type, x, y, w, h, px, py, update }.
// px/py are last-step positions for render interpolation.

import { TILE, tileAt } from './level.js';
import { moveEntity, groundBelow } from '../engine/physics.js';

class Actor {
  constructor(type, x, y, w, h) {
    this.type = type;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.px = x; this.py = y;
    this.dead = false;
  }
  savePrev() { this.px = this.x; this.py = this.y; }
  update(dt, game) { this.savePrev(); }
  renderX(alpha) { return this.px + (this.x - this.px) * alpha; }
  renderY(alpha) { return this.py + (this.y - this.py) * alpha; }
}

function cellBlocked(level, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(level, tx, ty);
      if (ch === 'x' || ch === 'D') return true;
    }
  }
  return false;
}

// --- Coin -------------------------------------------------------------

export class Coin extends Actor {
  constructor(s) {
    super('coin', s.tx * TILE + 3, s.ty * TILE + 3, 10, 10);
    this.baseY = this.y;
    this.phase = (s.tx * 7 + s.ty * 13) % 100 / 100 * Math.PI * 2;
    this.spawn = s;
  }
  update(dt, game) {
    this.savePrev();
    this.phase += dt * 5;
    this.y = this.baseY + Math.sin(this.phase) * 2.5;
  }
}

// --- Lava actors (v drip, | vertical bounce, = horizontal bounce) -----

export class LavaBlob extends Actor {
  constructor(s) {
    super('lava', s.tx * TILE, s.ty * TILE, TILE, TILE);
    this.mode = s.ch;
    this.startX = this.x; this.startY = this.y;
    if (s.ch === 'v') { this.vx = 0; this.vy = 60; }        // drips, then teleports back
    else if (s.ch === '|') { this.vx = 0; this.vy = 42; }   // bounces up/down
    else { this.vx = 42; this.vy = 0; }                     // '=' bounces left/right
    this.emberTimer = Math.random();
  }
  update(dt, game) {
    this.savePrev();
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (!cellBlocked(game.level, nx, ny, this.w, this.h) && ny < game.level.pixelHeight + TILE * 2) {
      this.x = nx; this.y = ny;
    } else if (this.mode === 'v') {
      this.x = this.startX; this.y = this.startY;
      this.px = this.x; this.py = this.y; // don't interpolate the teleport
    } else {
      this.vx = -this.vx; this.vy = -this.vy;
    }
    this.emberTimer -= dt;
    if (this.emberTimer <= 0) {
      this.emberTimer = 0.35 + Math.random() * 0.4;
      game.particles.lavaEmber(this.x + 2 + Math.random() * (this.w - 4), this.y + 2);
    }
  }
}

// --- Moving platforms ('~' horizontal, 'H' vertical) -------------------

export class Platform extends Actor {
  constructor(s) {
    // 3 tiles wide, half a tile thick, centered on the spawn cell.
    super('platform', (s.tx - 1) * TILE, s.ty * TILE + 4, TILE * 3, 8);
    this.axis = s.ch === '~' ? 'x' : 'y';
    this.speed = 34;
    this.dir = 1;
    this.dx = 0; this.dy = 0;
  }
  update(dt, game) {
    this.savePrev();
    const step = this.speed * this.dir * dt;
    let nx = this.x, ny = this.y;
    if (this.axis === 'x') nx += step; else ny += step;
    const pad = 1; // probe slightly beyond the leading edge
    const blocked = this.axis === 'x'
      ? cellBlocked(game.level, nx + (this.dir > 0 ? pad : -pad), this.y, this.w, this.h)
      : cellBlocked(game.level, this.x, ny + (this.dir > 0 ? pad : -pad), this.w, this.h);
    const outOfBounds = nx < 0 || nx + this.w > game.level.pixelWidth ||
      ny < 0 || ny + this.h > game.level.pixelHeight;
    if (blocked || outOfBounds) {
      this.dir = -this.dir;
      this.dx = 0; this.dy = 0;
    } else {
      this.dx = nx - this.x; this.dy = ny - this.y;
      this.x = nx; this.y = ny;
    }
  }
}

// --- Spring ------------------------------------------------------------

export class Spring extends Actor {
  constructor(s) {
    super('spring', s.tx * TILE + 1, s.ty * TILE + 8, TILE - 2, 8);
    this.anim = 0; // >0 while visually compressed
  }
  update(dt, game) {
    this.savePrev();
    this.anim = Math.max(0, this.anim - dt * 4);
  }
  trigger() { this.anim = 1; }
}

// --- Key & checkpoint & exit --------------------------------------------

export class Key extends Actor {
  constructor(s) {
    super('key', s.tx * TILE + 3, s.ty * TILE + 2, 10, 12);
    this.baseY = this.y;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(dt, game) {
    this.savePrev();
    this.phase += dt * 3;
    this.y = this.baseY + Math.sin(this.phase) * 2;
  }
}

export class Checkpoint extends Actor {
  constructor(s) {
    super('checkpoint', s.tx * TILE + 2, s.ty * TILE - 8, 12, 24);
    this.spawnTile = { tx: s.tx, ty: s.ty };
    this.lit = false;
  }
}

export class Exit extends Actor {
  constructor(s) {
    super('exit', s.tx * TILE + 1, s.ty * TILE - 10, 14, 26);
    this.t = Math.random() * 10;
    this.swirlTimer = 0;
  }
  update(dt, game) {
    this.savePrev();
    this.t += dt;
    this.swirlTimer -= dt;
    if (this.swirlTimer <= 0) {
      this.swirlTimer = 0.12;
      game.particles.portalSwirl(this.x + this.w / 2, this.y + this.h / 2, this.t);
    }
  }
}

// --- Enemy (patrolling walker, stompable) --------------------------------

export class Enemy extends Actor {
  constructor(s) {
    super('enemy', s.tx * TILE + 1, (s.ty + 1) * TILE - 12, 14, 12);
    this.dir = -1;
    this.speed = 36;
    this.vy = 0;
    this.animT = Math.random();
  }
  update(dt, game) {
    this.savePrev();
    this.animT += dt;
    this.vy = Math.min(this.vy + 500 * dt, 300);

    // Turn at walls and at ledge edges (only when grounded).
    const grounded = groundBelow(this, game.level, game);
    if (grounded) {
      const aheadX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const footY = this.y + this.h + 2;
      const wallAhead = cellBlocked(game.level, this.dir > 0 ? this.x + this.w + 1 : this.x - 2, this.y, 1, this.h);
      const groundAhead = cellBlocked(game.level, aheadX, footY, 1, 1) ||
        tileAt(game.level, Math.floor(aheadX / TILE), Math.floor(footY / TILE)) === '-';
      if (wallAhead || !groundAhead) this.dir = -this.dir;
    }

    const res = moveEntity(this, this.speed * this.dir * dt, this.vy * dt, game.level, game, {});
    if (res.hitX) this.dir = -this.dir;
    if (res.hitY && this.vy > 0) this.vy = 0;
    if (this.y > game.level.pixelHeight + TILE * 3) this.dead = true;
  }
}

// --- Factory -------------------------------------------------------------

export function createActor(spawn) {
  switch (spawn.ch) {
    case 'o': return new Coin(spawn);
    case 'v': case '|': case '=': return new LavaBlob(spawn);
    case '~': case 'H': return new Platform(spawn);
    case '^': return new Spring(spawn);
    case 'k': return new Key(spawn);
    case '*': return new Checkpoint(spawn);
    case 'E': return new Exit(spawn);
    case 'e': return new Enemy(spawn);
    default: return null;
  }
}

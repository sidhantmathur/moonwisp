// Game session for one level: owns the player, actors, camera, win/lose
// logic, timers and checkpoint respawn.

import { parseLevel, tileAt } from './level.js';
import { Player, TUNING } from './player.js';
import { createActor } from './actors.js';
import { Camera } from '../engine/camera.js';
import { moveEntity, overlaps, touchesTileType, overlappedTiles } from '../engine/physics.js';

const DEATH_DELAY = 0.9;
const WIN_DELAY = 1.1;

export class Game {
  constructor(levelDef, { input, sfx, particles, viewW, viewH, onWin, onQuit }) {
    this.level = parseLevel(levelDef);
    this.input = input;
    this.sfx = sfx;
    this.particles = particles;
    this.onWin = onWin;
    this.onQuit = onQuit;
    this.physics = { moveEntity };

    this.camera = new Camera(viewW, viewH);
    this.status = 'playing'; // 'playing' | 'dying' | 'won'
    this.hitstop = 0;
    this.stateTimer = 0;
    this.time = 0;
    this.deaths = 0;
    this.keys = 0;
    this.openedDoors = new Set();
    this.collected = new Set(); // spawn indices of taken coins/keys (persist across deaths)

    const at = this.level.spawns.find((s) => s.ch === '@') || { tx: 1, ty: 1 };
    this.spawnPoint = { tx: at.tx, ty: at.ty };
    this.checkpoint = { ...this.spawnPoint };
    this.player = new Player(this.checkpoint);
    this._buildActors();

    this.coinsTotal = this.level.spawns.filter((s) => s.ch === 'o').length;
    this.camera.snapTo(this.player, this.level);
    this.toast = { text: this.level.name, t: 2.2 };
  }

  _buildActors() {
    this.actors = [];
    this.level.spawns.forEach((s, i) => {
      if (s.ch === '@') return;
      if (this.collected.has(i)) return;
      const a = createActor(s);
      if (a) {
        a.spawnIndex = i;
        // Re-light checkpoints already reached.
        if (a.type === 'checkpoint' &&
            a.spawnTile.tx === this.checkpoint.tx && a.spawnTile.ty === this.checkpoint.ty) {
          a.lit = true;
        }
        this.actors.push(a);
      }
    });
  }

  get coinsLeft() {
    return this.actors.filter((a) => a.type === 'coin' && !a.dead).length;
  }

  solidPlatforms() {
    return this.actors.filter((a) => a.type === 'platform');
  }

  update(dt) {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    if (this.status === 'playing') {
      this.time += dt;
      if (this.input.justPressed('restart')) return this._die(true);
    }

    // Actors always animate (even during death/win transitions).
    for (const a of this.actors) {
      if (!a.dead) a.update(dt, this);
    }
    this.actors = this.actors.filter((a) => !a.dead);

    if (this.status === 'playing') {
      this.player.update(dt, this);
      this._interactions();
      this.camera.follow(this.player, this.level, dt, this.player.facing);
    } else {
      this.stateTimer -= dt;
      this.camera.follow(this.player, this.level, dt, this.player.facing);
      if (this.stateTimer <= 0) {
        if (this.status === 'dying') {
          this._respawn();
        } else if (this.status === 'won') {
          this.status = 'complete'; // fire onWin exactly once
          if (this.onWin) this.onWin({ timeMs: Math.round(this.time * 1000), deaths: this.deaths });
        }
      }
    }
  }

  _interactions() {
    const p = this.player;

    // Grid lava, and falling out of the world (parser returns '!' below bottom).
    if (touchesTileType(p, this.level, '!', 3)) return this._die();

    // Doors: touching a locked door with a key opens the contiguous door run.
    if (this.keys > 0) {
      const doors = overlappedTiles(p, this.level, 'D', 3)
        .filter((d) => !this.openedDoors.has(d.tx + ',' + d.ty));
      if (doors.length > 0) {
        this.keys--;
        this._openDoorFrom(doors[0]);
        this.sfx.play('door');
        this.camera.shake(0.15);
      }
    }

    for (const a of this.actors) {
      if (a.dead || !overlaps(p, a)) continue;
      switch (a.type) {
        case 'coin': {
          a.dead = true;
          this.collected.add(a.spawnIndex);
          this.particles.coinBurst(a.x + a.w / 2, a.y + a.h / 2);
          this.sfx.play('coin');
          if (this.level.goal === 'coins' && this.coinsLeft === 0) this._win();
          break;
        }
        case 'key':
          a.dead = true;
          this.collected.add(a.spawnIndex);
          this.keys++;
          this.particles.coinBurst(a.x + a.w / 2, a.y + a.h / 2);
          this.sfx.play('key');
          break;
        case 'lava':
          return this._die();
        case 'enemy': {
          const stomping = p.vy > 40 && p.y + p.h < a.y + a.h * 0.7;
          if (stomping) {
            a.dead = true;
            p.bounce(TUNING.stompBounce);
            this.particles.stompBurst(a.x + a.w / 2, a.y + a.h / 2, '#b366e0');
            this.sfx.play('stomp');
            this.hitstop = 0.05;
            this.camera.shake(0.12);
          } else {
            return this._die();
          }
          break;
        }
        case 'spring': {
          // Fires when falling onto it or walking over it (vy is 0 when
          // grounded) — but not when jumping up past it from below.
          if (p.vy >= 0 && p.y + p.h <= a.y + a.h) {
            p.bounce(TUNING.springVel);
            a.trigger();
            this.particles.springBurst(a.x + a.w / 2, a.y);
            this.sfx.play('spring');
            this.camera.shake(0.08);
          }
          break;
        }
        case 'checkpoint': {
          if (!a.lit) {
            a.lit = true;
            this.checkpoint = { ...a.spawnTile };
            this.particles.checkpointGlow(a.x + a.w / 2, a.y);
            this.sfx.play('checkpoint');
          }
          break;
        }
        case 'exit': {
          if (this.level.goal === 'exit') this._win();
          break;
        }
      }
    }
  }

  _openDoorFrom(start) {
    // Flood-fill contiguous 'D' tiles so multi-tile doors open as one.
    const stack = [start];
    while (stack.length) {
      const { tx, ty } = stack.pop();
      const key = tx + ',' + ty;
      if (this.openedDoors.has(key)) continue;
      if (tileAt(this.level, tx, ty) !== 'D') continue;
      this.openedDoors.add(key);
      stack.push({ tx: tx + 1, ty }, { tx: tx - 1, ty }, { tx, ty: ty + 1 }, { tx, ty: ty - 1 });
    }
  }

  _die(isRestart = false) {
    if (this.status !== 'playing') return;
    this.status = 'dying';
    this.stateTimer = isRestart ? 0.25 : DEATH_DELAY;
    this.deaths++;
    if (!isRestart) {
      this.hitstop = 0.06;
      this.camera.shake(0.5);
      this.particles.deathBurst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
      this.sfx.play('death');
    }
  }

  _respawn() {
    this.status = 'playing';
    this.keys = 0;
    this._buildActors();
    this.player.respawnAt(this.checkpoint);
    this.camera.snapTo(this.player, this.level);
  }

  _win() {
    if (this.status !== 'playing') return;
    this.status = 'won';
    this.stateTimer = WIN_DELAY;
    this.hitstop = 0.08;
    this.sfx.play('win');
    this.particles.coinBurst(this.player.x + this.player.w / 2, this.player.y - 6);
  }
}

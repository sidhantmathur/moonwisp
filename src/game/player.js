// Player movement with the full juice kit: coyote time, jump buffering,
// variable jump height, apex float, squash & stretch.
//
// Every tunable lives in TUNING. The baseline (run 118 px/s, jump apex
// ~4.8 tiles, range ~8 tiles) intentionally matches the Eloquent JS physics
// the classic levels were designed around — don't shrink the jump envelope
// or the classic pack becomes impossible.

export const TUNING = {
  maxRun: 118,          // px/s
  accel: 950,           // ground acceleration
  decel: 1300,          // ground deceleration (no input)
  turnBoost: 1.9,       // extra accel when reversing direction
  airAccel: 720,
  airDecel: 260,

  gravity: 500,
  fallGravityMult: 1.35, // heavier on the way down = snappier arcs
  apexGravityMult: 0.55, // floaty right at the top of the jump
  apexThreshold: 40,     // |vy| below this counts as "at apex"
  apexAirBoost: 1.12,    // slight horizontal speed bonus at apex
  maxFall: 300,

  jumpVel: -278,
  jumpCut: 0.42,        // multiply vy by this when jump released early
  coyoteTime: 0.1,      // s of grace after walking off a ledge
  bufferTime: 0.13,     // s a jump press is remembered before landing
  springVel: -400,
  stompBounce: -220,

  hitW: 12,
  hitH: 22,
};

export class Player {
  constructor(spawn) {
    this.w = TUNING.hitW;
    this.h = TUNING.hitH;
    this.respawnAt(spawn);
  }

  respawnAt(spawn) {
    // spawn is a tile coord; feet at the bottom of the '@' cell.
    this.x = spawn.tx * 16 + (16 - this.w) / 2;
    this.y = (spawn.ty + 1) * 16 - this.h;
    this.px = this.x; this.py = this.y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.wasOnGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.standingOn = null;
    this.scaleX = 1; this.scaleY = 1;
    this.runTime = 0;
    this.dustTimer = 0;
    this.state = 'idle';
    this.peakFall = 0;
  }

  update(dt, game) {
    const { input, level, sfx, particles, camera } = game;
    const T = TUNING;
    this.px = this.x; this.py = this.y;

    const left = input.held('left');
    const right = input.held('right');
    const move = (right ? 1 : 0) - (left ? 1 : 0);
    if (move !== 0) this.facing = move;

    // Timers.
    this.coyote = this.onGround ? T.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = input.justPressed('jump') ? T.bufferTime : Math.max(0, this.buffer - dt);

    // --- Horizontal ---
    const atApex = !this.onGround && Math.abs(this.vy) < T.apexThreshold;
    const maxRun = T.maxRun * (atApex ? T.apexAirBoost : 1);
    let accel = this.onGround ? T.accel : T.airAccel;
    if (move !== 0 && Math.sign(this.vx) === -move) accel *= T.turnBoost;
    if (move !== 0) {
      this.vx += move * accel * dt;
      this.vx = Math.max(-maxRun, Math.min(maxRun, this.vx));
    } else {
      const decel = this.onGround ? T.decel : T.airDecel;
      const drop = decel * dt;
      if (Math.abs(this.vx) <= drop) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * drop;
    }

    // --- Jump ---
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = T.jumpVel;
      this.jumping = true;
      this.buffer = 0;
      this.coyote = 0;
      this.standingOn = null;
      this.squash(0.72, 1.32);
      particles.jumpPuff(this.x + this.w / 2, this.y + this.h);
      sfx.play('jump');
    }
    if (this.jumping && input.justReleased('jump') && this.vy < 0) {
      this.vy *= T.jumpCut; // variable jump height
      this.jumping = false;
    }

    // --- Gravity ---
    let g = T.gravity;
    if (this.vy > 0) g *= T.fallGravityMult;
    else if (atApex) g *= T.apexGravityMult;
    this.vy = Math.min(this.vy + g * dt, T.maxFall);
    if (this.vy > 0) this.peakFall = Math.max(this.peakFall, this.vy);

    // --- Platform carry (platforms already moved this step) ---
    if (this.standingOn) {
      this.x += this.standingOn.dx || 0;
      this.y += this.standingOn.dy || 0;
    }

    // --- Move & collide ---
    const { moveEntity } = game.physics;
    const res = moveEntity(this, this.vx * dt, this.vy * dt, level, game, {
      platforms: game.solidPlatforms(),
      dropThrough: input.held('down'), // hold ↓ to drop through one-ways
    });
    if (res.hitX) this.vx = 0;
    if (res.hitY) {
      if (this.vy > 0) this.vy = 0;
      else if (this.vy < 0) { this.vy = 0; this.jumping = false; }
    }

    this.wasOnGround = this.onGround;
    this.onGround = res.onGround;
    this.standingOn = res.onPlatform;

    // Elevator scoop: a platform rising into the player carries them on top.
    if (!this.standingOn) {
      for (const plat of game.solidPlatforms()) {
        const overlapping = this.x < plat.x + plat.w && this.x + this.w > plat.x &&
          this.y < plat.y + plat.h && this.y + this.h > plat.y;
        if (overlapping && (plat.dy || 0) < 0) {
          this.y = plat.y - this.h - 0.001;
          this.vy = Math.min(this.vy, 0);
          this.onGround = true;
          this.standingOn = plat;
          break;
        }
      }
    }

    // Landing: dust + squash scaled by fall speed, tiny shake on big hits.
    if (this.onGround && !this.wasOnGround) {
      const impact = Math.min(1, this.peakFall / T.maxFall);
      this.squash(1 + 0.4 * impact, 1 - 0.38 * impact);
      particles.landingDust(this.x + this.w / 2, this.y + this.h, 0.5 + impact);
      if (impact > 0.85) camera.shake(0.22);
      if (impact > 0.3) sfx.play('land');
      this.peakFall = 0;
    }

    // Run animation clock + dust while sprinting on the ground.
    if (this.onGround && Math.abs(this.vx) > 8) {
      this.runTime += dt * Math.max(0.5, Math.abs(this.vx) / T.maxRun);
      if (Math.abs(this.vx) > T.maxRun * 0.6) {
        this.dustTimer -= dt;
        if (this.dustTimer <= 0) {
          this.dustTimer = 0.09;
          particles.runDust(this.x + this.w / 2 - this.facing * 4, this.y + this.h, this.facing);
        }
      }
    }

    // Squash & stretch eases back to 1 (render-only, hitbox untouched).
    this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 14);
    this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 14);

    // Animation state.
    if (!this.onGround) this.state = this.vy < -20 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 8) this.state = 'run';
    else this.state = 'idle';
  }

  squash(sx, sy) {
    this.scaleX = sx;
    this.scaleY = sy;
  }

  bounce(vel) {
    this.vy = vel;
    this.jumping = false; // spring/stomp bounces aren't jump-cuttable
    this.squash(0.7, 1.35);
  }

  // Interpolated render position.
  renderX(alpha) { return this.px + (this.x - this.px) * alpha; }
  renderY(alpha) { return this.py + (this.y - this.py) * alpha; }
}

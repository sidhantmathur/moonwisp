// Lerped follow camera with facing lookahead, vertical deadzone,
// level-bounds clamping and trauma-based shake.

export class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0; // center, world px
    this.y = 0;
    this.lookahead = 0;
    this.trauma = 0;
    this.shakeEnabled = true;
    this._shakeX = 0;
    this._shakeY = 0;
  }

  snapTo(target, level) {
    this.x = target.x + target.w / 2;
    this.y = target.y + target.h / 2;
    this.lookahead = 0;
    this._clamp(level);
  }

  follow(target, level, dt, facing = 1) {
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;

    // Horizontal: lerp toward target + lookahead in facing direction.
    const wantLook = facing * 28;
    this.lookahead += (wantLook - this.lookahead) * Math.min(1, dt * 2.5);
    this.x += (cx + this.lookahead - this.x) * Math.min(1, dt * 8);

    // Vertical: deadzone so small hops don't bob the camera; snap faster when
    // falling far so the ground is visible before landing.
    const dy = cy - this.y;
    const dead = 24;
    if (Math.abs(dy) > dead) {
      const excess = dy - Math.sign(dy) * dead;
      const speed = dy > 0 ? 11 : 7;
      this.y += excess * Math.min(1, dt * speed);
    }

    this._clamp(level);

    // Shake decays quadratically (trauma model).
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
      const mag = this.trauma * this.trauma * 10;
      this._shakeX = (Math.random() * 2 - 1) * mag;
      this._shakeY = (Math.random() * 2 - 1) * mag;
    } else {
      this._shakeX = this._shakeY = 0;
    }
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  _clamp(level) {
    const hw = this.viewW / 2;
    const hh = this.viewH / 2;
    if (level.pixelWidth <= this.viewW) {
      this.x = level.pixelWidth / 2;
    } else {
      this.x = Math.max(hw, Math.min(level.pixelWidth - hw, this.x));
    }
    if (level.pixelHeight <= this.viewH) {
      this.y = level.pixelHeight / 2;
    } else {
      this.y = Math.max(hh, Math.min(level.pixelHeight - hh, this.y));
    }
  }

  // Top-left of the view in world px, including shake.
  viewX() { return Math.round(this.x - this.viewW / 2 + (this.shakeEnabled ? this._shakeX : 0)); }
  viewY() { return Math.round(this.y - this.viewH / 2 + (this.shakeEnabled ? this._shakeY : 0)); }
}

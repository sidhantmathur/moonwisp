// Keyboard + gamepad + touch, mapped to named actions with per-tick edge
// detection. Call input.tick() exactly once per fixed physics step; between
// ticks, key events accumulate into a queue so nothing is dropped even if
// several render frames pass between steps.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  Escape: 'pause', KeyP: 'pause',
  KeyR: 'restart',
  Enter: 'confirm',
};

export class Input {
  constructor() {
    this.down = new Set();       // actions currently held
    this.pressed = new Set();    // actions that went down since last tick
    this.released = new Set();
    this._queuedPress = new Set();
    this._queuedRelease = new Set();
    this.anyKeyListeners = [];
    this._gamepadDown = new Set();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const action = KEYMAP[e.code];
      for (const fn of this.anyKeyListeners) fn(e);
      if (!action) return;
      // Keep the page from scrolling on arrows/space.
      e.preventDefault();
      this.down.add(action);
      this._queuedPress.add(action);
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      this.down.delete(action);
      this._queuedRelease.add(action);
    });
    window.addEventListener('blur', () => {
      for (const a of this.down) this._queuedRelease.add(a);
      this.down.clear();
    });
  }

  // Simulated input from touch buttons.
  press(action) {
    if (!this.down.has(action)) {
      this.down.add(action);
      this._queuedPress.add(action);
    }
  }
  release(action) {
    if (this.down.has(action)) {
      this.down.delete(action);
      this._queuedRelease.add(action);
    }
  }

  onAnyKey(fn) {
    this.anyKeyListeners.push(fn);
    return () => {
      this.anyKeyListeners = this.anyKeyListeners.filter((f) => f !== fn);
    };
  }

  _pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return;
    const map = {
      left: pad.axes[0] < -0.4 || (pad.buttons[14] && pad.buttons[14].pressed),
      right: pad.axes[0] > 0.4 || (pad.buttons[15] && pad.buttons[15].pressed),
      down: pad.axes[1] > 0.5 || (pad.buttons[13] && pad.buttons[13].pressed),
      jump: (pad.buttons[0] && pad.buttons[0].pressed) || (pad.buttons[1] && pad.buttons[1].pressed),
      pause: pad.buttons[9] && pad.buttons[9].pressed,
      confirm: pad.buttons[0] && pad.buttons[0].pressed,
    };
    for (const [action, active] of Object.entries(map)) {
      if (active && !this._gamepadDown.has(action)) {
        this._gamepadDown.add(action);
        this.press(action);
      } else if (!active && this._gamepadDown.has(action)) {
        this._gamepadDown.delete(action);
        this.release(action);
      }
    }
  }

  tick() {
    this._pollGamepad();
    this.pressed = this._queuedPress;
    this.released = this._queuedRelease;
    this._queuedPress = new Set();
    this._queuedRelease = new Set();
  }

  held(action) { return this.down.has(action); }
  justPressed(action) { return this.pressed.has(action); }
  justReleased(action) { return this.released.has(action); }
}

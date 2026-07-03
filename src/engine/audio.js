// Tiny WebAudio synth — every sound is generated, no audio files.
// The AudioContext is created lazily on the first user gesture.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // A single enveloped oscillator note.
  _note({ type = 'square', freq = 440, to = null, dur = 0.1, vol = 1, delay = 0, curve = 'exp' }) {
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.3, vol = 1, delay = 0, from = 1200, to = 150 }) {
    const t0 = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  play(name) {
    if (!this.enabled || !this._ensure()) return;
    switch (name) {
      case 'jump':
        this._note({ type: 'square', freq: 240, to: 460, dur: 0.12, vol: 0.5 });
        break;
      case 'land':
        this._noise({ dur: 0.08, vol: 0.25, from: 700, to: 120 });
        break;
      case 'coin':
        this._note({ type: 'sine', freq: 1046, dur: 0.07, vol: 0.5 });
        this._note({ type: 'sine', freq: 1568, dur: 0.18, vol: 0.5, delay: 0.06 });
        break;
      case 'death':
        this._noise({ dur: 0.45, vol: 0.7, from: 2000, to: 80 });
        this._note({ type: 'sawtooth', freq: 300, to: 40, dur: 0.45, vol: 0.4 });
        break;
      case 'spring':
        this._note({ type: 'square', freq: 200, to: 800, dur: 0.2, vol: 0.5 });
        break;
      case 'stomp':
        this._noise({ dur: 0.15, vol: 0.5, from: 900, to: 200 });
        this._note({ type: 'square', freq: 350, to: 120, dur: 0.15, vol: 0.35 });
        break;
      case 'key':
        this._note({ type: 'triangle', freq: 880, dur: 0.08, vol: 0.5 });
        this._note({ type: 'triangle', freq: 1174, dur: 0.2, vol: 0.5, delay: 0.07 });
        break;
      case 'door':
        this._note({ type: 'triangle', freq: 220, to: 440, dur: 0.3, vol: 0.4 });
        this._noise({ dur: 0.25, vol: 0.2, from: 500, to: 100 });
        break;
      case 'checkpoint':
        this._note({ type: 'sine', freq: 660, dur: 0.1, vol: 0.4 });
        this._note({ type: 'sine', freq: 990, dur: 0.24, vol: 0.4, delay: 0.09 });
        break;
      case 'win': {
        const seq = [523, 659, 784, 1046];
        seq.forEach((f, i) =>
          this._note({ type: 'triangle', freq: f, dur: 0.16, vol: 0.5, delay: i * 0.09 }));
        break;
      }
      case 'ui':
        this._note({ type: 'sine', freq: 700, dur: 0.05, vol: 0.3 });
        break;
    }
  }
}

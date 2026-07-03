// localStorage persistence: per-level best times/completion and settings.

const KEY = 'platforming-game-v2';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage disabled — play on without saving
  }
}

export const storage = {
  data: Object.assign({ progress: {}, settings: { sound: true, shake: true, timer: true } }, load()),

  levelKey(packId, levelIndex) {
    return `${packId}:${levelIndex}`;
  },

  getBest(packId, levelIndex) {
    return this.data.progress[this.levelKey(packId, levelIndex)] || null; // {timeMs, deaths}
  },

  recordWin(packId, levelIndex, timeMs, deaths) {
    const key = this.levelKey(packId, levelIndex);
    const prev = this.data.progress[key];
    const improved = !prev || timeMs < prev.timeMs;
    this.data.progress[key] = {
      timeMs: improved ? timeMs : prev.timeMs,
      deaths: improved ? deaths : prev.deaths,
    };
    save(this.data);
    return improved;
  },

  get settings() {
    return this.data.settings;
  },

  saveSettings() {
    save(this.data);
  },
};

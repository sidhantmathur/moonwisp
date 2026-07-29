// Boot + app state machine: Title → LevelSelect → Playing ⇄ Paused → Win,
// plus the level editor and its playtest mode.

import { createLoop } from './engine/loop.js';
import { Input } from './engine/input.js';
import { Sfx } from './engine/audio.js';
import { Particles } from './engine/particles.js';
import { Game } from './game/rules.js';
import { buildSprites } from './render/sprites.js';
import { Background } from './render/background.js';
import { drawWorld } from './render/world.js';
import { drawHud } from './render/hud.js';
import { storage } from './ui/storage.js';
import { initScreens } from './ui/screens.js';
import { initEditor } from './ui/editor.js';
import { PACKS } from '../levels/packs.js';

export const VIEW_W = 640;
export const VIEW_H = 360;

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const app = {
  mode: 'title', // title | select | playing | paused | won | editor | editortest
  input: new Input(),
  sfx: new Sfx(),
  particles: new Particles(),
  sprites: buildSprites(),
  background: new Background(VIEW_W, VIEW_H),
  storage,
  packs: PACKS,
  game: null,
  current: null, // { packId, levelIndex } while playing a pack level
  screens: null,
  editor: null,
  viewW: VIEW_W,
  viewH: VIEW_H,
};

app.sfx.enabled = storage.settings.sound;

function makeGame(levelDef) {
  app.particles.clear();
  const game = new Game(levelDef, {
    input: app.input,
    sfx: app.sfx,
    particles: app.particles,
    viewW: VIEW_W,
    viewH: VIEW_H,
    onWin: handleWin,
  });
  game.camera.shakeEnabled = storage.settings.shake;
  return game;
}

app.startLevel = (packId, levelIndex) => {
  const pack = PACKS.find((p) => p.id === packId);
  const def = pack.levels[levelIndex];
  app.current = { packId, levelIndex };
  app.game = makeGame(def);
  app.mode = 'playing';
  app.screens.show('none');
};

app.startCustomLevel = (rows, opts = {}) => {
  app.current = null;
  app.game = makeGame({ name: opts.name || 'Playtest', rows, goal: opts.goal });
  app.mode = opts.fromEditor ? 'editortest' : 'playing';
  app.screens.show('none');
};

app.quitToMenu = () => {
  app.game = null;
  app.mode = 'select';
  app.screens.show('select');
};

app.quitToTitle = () => {
  app.game = null;
  app.mode = 'title';
  app.screens.show('title');
};

app.resume = () => {
  if (!app.game) return;
  app.mode = app.game._fromEditor ? 'editortest' : 'playing';
  app.screens.show('none');
};

app.restartLevel = () => {
  if (app.current) {
    app.startLevel(app.current.packId, app.current.levelIndex);
  } else if (app.game) {
    const rows = app.game.level.rows;
    const wasEditor = app.mode === 'editortest' || app.game._fromEditor;
    app.startCustomLevel(rows, { fromEditor: wasEditor, name: app.game.level.name, goal: app.game.level.goal });
  }
};

app.openEditor = () => {
  app.game = null;
  app.mode = 'editor';
  app.screens.show('none');
  app.editor.open();
};

app.closeEditor = () => {
  app.editor.close();
  app.quitToMenu();
};

app.endPlaytest = () => {
  app.game = null;
  app.mode = 'editor';
  app.screens.show('none');
  app.editor.open();
};

// Quit from the pause menu: editor playtests return to the editor.
app.quitFromPause = () => {
  if (app.game && app.game._fromEditor) app.endPlaytest();
  else app.quitToMenu();
};

app.applySettings = () => {
  app.sfx.enabled = storage.settings.sound;
  if (app.game) app.game.camera.shakeEnabled = storage.settings.shake;
  storage.saveSettings();
};

function handleWin({ timeMs, deaths }) {
  if (app.mode === 'editortest') {
    app.endPlaytest();
    return;
  }
  let improved = false;
  let hasNext = false;
  if (app.current) {
    improved = storage.recordWin(app.current.packId, app.current.levelIndex, timeMs, deaths);
    const pack = PACKS.find((p) => p.id === app.current.packId);
    hasNext = app.current.levelIndex + 1 < pack.levels.length;
  }
  app.mode = 'won';
  app.screens.show('win', { timeMs, deaths, improved, hasNext });
}

app.nextLevel = () => {
  if (!app.current) return app.quitToMenu();
  app.startLevel(app.current.packId, app.current.levelIndex + 1);
};

// --- Fixed-step update / interpolated render --------------------------------

let renderTime = 0;

function update(dt) {
  app.input.tick();

  switch (app.mode) {
    case 'playing':
    case 'editortest': {
      if (app.input.justPressed('pause')) {
        app.mode = 'paused';
        app.screens.show('pause');
        return;
      }
      app.game.update(dt);
      app.particles.update(dt);
      break;
    }
    case 'paused':
      if (app.input.justPressed('pause')) app.resume();
      break;
    case 'won':
      app.particles.update(dt);
      if (app.game) app.game.update(dt); // let particles/actors settle behind the overlay
      break;
    default:
      break;
  }
}

function render(alpha, t) {
  renderTime = t;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (app.game) {
    app.background.draw(ctx, app.game.camera.viewX(), app.game.camera.viewY(), t);
    drawWorld(ctx, app.game, app.sprites, alpha, t);
    if (app.mode === 'playing' || app.mode === 'paused' || app.mode === 'editortest') {
      drawHud(ctx, app.game, app.sprites, storage.settings, 1 / 60);
    }
  } else if (app.mode === 'editor') {
    app.editor.render(ctx, t);
  } else {
    // Title / level select: slow-panning ambient background.
    app.background.draw(ctx, t * 18, Math.sin(t * 0.1) * 30, t);
  }
}

// --- Canvas scaling ----------------------------------------------------------

function resize() {
  const holder = document.getElementById('frame');
  const availW = holder.clientWidth;
  const availH = holder.clientHeight;
  let scale = Math.min(availW / VIEW_W, availH / VIEW_H);
  if (scale >= 1) scale = Math.floor(scale); // integer scale keeps pixels crisp
  canvas.style.width = `${Math.round(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.round(VIEW_H * scale)}px`;
}
window.addEventListener('resize', resize);

// --- Boot ---------------------------------------------------------------------

app.screens = initScreens(app);
app.editor = initEditor(app);
resize();
app.screens.show('title');

const loop = createLoop({ update, render });
loop.start();

// Console/debug handle (also handy for automated playtesting):
//   __moonwisp.step(0.5) advances the simulation half a second; __moonwisp.frame()
//   renders once. Works even when rAF is suspended (hidden tabs).
app.step = (seconds = 1 / 120) => {
  const steps = Math.max(1, Math.round(seconds * 120));
  for (let i = 0; i < steps; i++) update(1 / 120);
};
app.frame = () => render(1, performance.now() / 1000);
window.__moonwisp = app;

// Mark editor-spawned games so pause/resume returns to the right mode.
const origStartCustom = app.startCustomLevel;
app.startCustomLevel = (rows, opts = {}) => {
  origStartCustom(rows, opts);
  if (app.game) app.game._fromEditor = !!opts.fromEditor;
};

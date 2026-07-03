// DOM-based UI screens (title, level select, pause, win) + touch controls.
// Everything here lives inside #ui / #touch; the canvas is drawn separately
// by src/main.js.

import { formatTime } from '../render/hud.js';

export function initScreens(app) {
  const uiRoot = document.getElementById('ui');
  const touchRoot = document.getElementById('touch');

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch-device');

  let unsubAnyKey = null;
  let currentName = 'title';
  let activePackId = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function playUi() {
    app.sfx.play('ui');
  }

  function button(label, opts = {}) {
    const b = el('button', opts.className, label);
    b.type = 'button';
    b.addEventListener('click', () => {
      playUi();
      opts.onClick && opts.onClick();
    });
    return b;
  }

  // --- Title -----------------------------------------------------------

  const titleScreen = el('div', 'screen');
  {
    titleScreen.appendChild(el('h1', null, 'WISP'));
    titleScreen.appendChild(el('p', 'tagline', 'a tiny platformer'));
    const row = el('div', 'btn-row');
    const playBtn = button('Play', { className: 'primary', onClick: () => app.quitToMenu() });
    row.appendChild(playBtn);
    row.appendChild(button('Level Editor', { className: 'amber', onClick: () => app.openEditor() }));
    titleScreen.appendChild(row);
    titleScreen.appendChild(el('p', 'hint', 'press any key'));
    titleScreen._autofocus = playBtn;
  }

  // --- Level select ------------------------------------------------------

  const selectScreen = el('div', 'screen');
  const selectHeading = el('h2', null, 'Select Level');
  const tabRow = el('div', 'tab-row');
  const levelGrid = el('div', 'level-grid');
  const selectSettings = buildSettingsRow();
  {
    selectScreen.appendChild(selectHeading);
    selectScreen.appendChild(tabRow);
    selectScreen.appendChild(levelGrid);
    const footerRow = el('div', 'btn-row');
    footerRow.appendChild(button('Editor', { onClick: () => app.openEditor() }));
    footerRow.appendChild(button('Back', { onClick: () => app.quitToTitle() }));
    selectScreen.appendChild(footerRow);
    selectScreen.appendChild(selectSettings);
  }

  function buildSettingsRow() {
    const row = el('div', 'settings-row');
    row.appendChild(checkboxLabel('Sound', 'sound'));
    row.appendChild(checkboxLabel('Screen shake', 'shake'));
    row.appendChild(checkboxLabel('Timer', 'timer'));
    return row;
  }

  function checkboxLabel(text, key) {
    const label = el('label');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = !!app.storage.settings[key];
    input.addEventListener('change', () => {
      app.storage.settings[key] = input.checked;
      app.applySettings();
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(text));
    return label;
  }

  function syncSettingsRow(row) {
    const inputs = row.querySelectorAll('input[type="checkbox"]');
    const keys = ['sound', 'shake', 'timer'];
    inputs.forEach((input, i) => {
      input.checked = !!app.storage.settings[keys[i]];
    });
  }

  function rebuildSelectScreen() {
    tabRow.innerHTML = '';
    levelGrid.innerHTML = '';
    const packs = app.packs || [];
    if (!packs.find((p) => p.id === activePackId)) {
      activePackId = packs.length ? packs[0].id : null;
    }
    for (const pack of packs) {
      const tab = el('button', 'tab' + (pack.id === activePackId ? ' active' : ''), pack.name);
      tab.type = 'button';
      tab.addEventListener('click', () => {
        playUi();
        activePackId = pack.id;
        rebuildSelectScreen();
      });
      tabRow.appendChild(tab);
    }
    const pack = packs.find((p) => p.id === activePackId);
    if (!pack) return;
    pack.levels.forEach((level, idx) => {
      const best = app.storage.getBest(pack.id, idx);
      const card = el('button', 'level-card');
      card.type = 'button';
      card.appendChild(el('span', 'num', `#${idx + 1}`));
      card.appendChild(el('span', 'name', level.name || `Level ${idx + 1}`));
      if (best) {
        card.appendChild(el('span', 'best', formatTime(best.timeMs)));
        card.appendChild(el('span', 'check', '✓'));
      }
      card.addEventListener('click', () => {
        playUi();
        app.startLevel(pack.id, idx);
      });
      levelGrid.appendChild(card);
    });
  }

  // --- Pause -------------------------------------------------------------

  const pauseScreen = el('div', 'screen');
  const pauseSettings = buildSettingsRow();
  {
    pauseScreen.appendChild(el('h2', null, 'Paused'));
    const row = el('div', 'btn-row');
    const resumeBtn = button('Resume', { className: 'primary', onClick: () => app.resume() });
    row.appendChild(resumeBtn);
    row.appendChild(button('Restart', { onClick: () => app.restartLevel() }));
    row.appendChild(button('Quit', { onClick: () => app.quitFromPause() }));
    pauseScreen.appendChild(row);
    pauseScreen.appendChild(pauseSettings);
    pauseScreen._autofocus = resumeBtn;
  }

  // --- Win -----------------------------------------------------------------

  const winScreen = el('div', 'screen');
  const winStats = el('div', 'stat-row');
  const winBadge = el('div', 'badge', '★ new best!');
  const winButtons = el('div', 'btn-row');
  {
    winScreen.appendChild(el('h2', null, 'Level clear!'));
    winScreen.appendChild(winStats);
    winScreen.appendChild(winBadge);
    winScreen.appendChild(winButtons);
  }

  function buildWinScreen(data) {
    winStats.innerHTML = '';
    const timeStat = el('div');
    timeStat.appendChild(el('span', 'label', 'time'));
    timeStat.appendChild(document.createTextNode(formatTime(data.timeMs)));
    const deathStat = el('div');
    deathStat.appendChild(el('span', 'label', 'deaths'));
    deathStat.appendChild(document.createTextNode(String(data.deaths)));
    winStats.appendChild(timeStat);
    winStats.appendChild(deathStat);

    winBadge.classList.toggle('hidden', !data.improved);

    winButtons.innerHTML = '';
    let primary = null;
    if (data.hasNext) {
      primary = button('Next level', { className: 'primary', onClick: () => app.nextLevel() });
      winButtons.appendChild(primary);
    }
    const replayBtn = button('Replay', { className: primary ? null : 'primary', onClick: () => app.restartLevel() });
    if (!primary) primary = replayBtn;
    winButtons.appendChild(replayBtn);
    winButtons.appendChild(button('Level select', { onClick: () => app.quitToMenu() }));
    winScreen._autofocus = primary;
  }

  // --- Assembly ------------------------------------------------------------

  uiRoot.appendChild(titleScreen);
  uiRoot.appendChild(selectScreen);
  uiRoot.appendChild(pauseScreen);
  uiRoot.appendChild(winScreen);

  const screens = {
    title: titleScreen,
    select: selectScreen,
    pause: pauseScreen,
    win: winScreen,
  };

  function hideAll() {
    for (const key in screens) screens[key].classList.add('hidden');
  }

  function show(name, data) {
    if (unsubAnyKey) {
      unsubAnyKey();
      unsubAnyKey = null;
    }

    currentName = name;
    hideAll();

    if (name === 'none') {
      document.body.dataset.mode = app.mode;
      return;
    }

    document.body.dataset.mode = name;

    if (name === 'title') {
      screens.title.classList.remove('hidden');
      unsubAnyKey = app.input.onAnyKey((e) => {
        if (e.code === 'Escape') return;
        app.quitToMenu();
      });
      titleScreen._autofocus && titleScreen._autofocus.focus();
    } else if (name === 'select') {
      rebuildSelectScreen();
      syncSettingsRow(selectSettings);
      screens.select.classList.remove('hidden');
    } else if (name === 'pause') {
      syncSettingsRow(pauseSettings);
      screens.pause.classList.remove('hidden');
      pauseScreen._autofocus && pauseScreen._autofocus.focus();
    } else if (name === 'win') {
      buildWinScreen(data || {});
      screens.win.classList.remove('hidden');
      winScreen._autofocus && winScreen._autofocus.focus();
    }
  }

  // --- Touch controls --------------------------------------------------

  function makeTouchButton(id, label, action) {
    const b = el('div', 'touch-btn', label);
    b.id = id;
    const press = (e) => {
      e.preventDefault();
      app.input.press(action);
    };
    const release = (e) => {
      e.preventDefault();
      app.input.release(action);
    };
    b.addEventListener('touchstart', press, { passive: false });
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('pointerleave', release);
    b.addEventListener('touchend', release, { passive: false });
    b.addEventListener('touchcancel', release, { passive: false });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  touchRoot.appendChild(makeTouchButton('touch-left', '◀', 'left'));
  touchRoot.appendChild(makeTouchButton('touch-right', '▶', 'right'));
  touchRoot.appendChild(makeTouchButton('touch-jump', '↥', 'jump'));

  return { show };
}

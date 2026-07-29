// Every sprite in the game, generated at boot. Characters are pixel-art
// string grids (see INK in palette.js for the letter → color map); tiles are
// drawn procedurally with deterministic grain so the look is stable.

import { PALETTE, INK } from './palette.js';
import { TILE } from '../game/level.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function gridToCanvas(rows) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = INK[ch] || PALETTE.white;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Deterministic per-pixel hash for tile grain.
function grain(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ---------------------------------------------------------------------------
// Player — 14 x 22. A little mint wisp in a bent-tip wizard hat (door purple,
// gold band), big head over a small round body, belly patch, stub arms, scarf
// with a trailing tail. Facing right; the renderer mirrors it for left.

const P_HEAD = [
  '.........dd...',
  '.......ddd....',
  '......dddd....',
  '.....ddddd....',
  '.....ddddd....',
  '....dccddd....',
  '.dddddddddddd.',
  '.bbbwwbbbwwbb.',
  '.bbbwpbbbwpbb.',
  '.bbbbbbbbbbbB.',
  '..bbbbppbbbB..',
  '.ssssssssssss.',
  'ss.ssssssssss.',
  '..bbnnnnnnbB..',
  '.bbbnnnnnnbBB.',
  'bbbbnnnnnnbBBB',
  '..bbnnnnnnbB..',
  '..bbbbbbbbBB..',
];

const LEGS = {
  stand: [
    '...bbb..bbb...',
    '...bbb..bbb...',
    '...BBB..BBB...',
    '...BBB..BBB...',
  ],
  run1: [
    '..bbb....bbb..',
    '.bbb......bbb.',
    '.BBB......BBB.',
    '..............',
  ],
  run2: [
    '...bbb.bbb....',
    '...bbb..bbb...',
    '...BBB..BBB...',
    '..............',
  ],
  run3: [
    '.....bbbb.....',
    '....bbbbbb....',
    '....BBBBBB....',
    '..............',
  ],
  jump: [
    '...bbb..bbb...',
    '...Bbb..bbB...',
    '....BB..BB....',
    '..............',
  ],
  fall: [
    '..bbb....bbb..',
    '..bBB....BBb..',
    '..BB......BB..',
    '..............',
  ],
};

function playerFrame(legs) {
  return gridToCanvas([...P_HEAD, ...LEGS[legs]]);
}

// ---------------------------------------------------------------------------
// Small actors

const COIN_FRAMES = [
  [
    '...cccc...',
    '..cggggc..',
    '.cggccccc.',
    '.cgcccccC.',
    '.cgcccccC.',
    '.cgcccccC.',
    '.ccccccCC.',
    '.cccccCCC.',
    '..ccCCCC..',
    '...CCCC...',
  ],
  [
    '....ccc...',
    '...cggc...',
    '..cgcccC..',
    '..cgcccC..',
    '..cgcccC..',
    '..cgcccC..',
    '..ccccCC..',
    '..cccCCC..',
    '...cCCC...',
    '....CCC...',
  ],
  [
    '....cc....',
    '....gc....',
    '....gcC...',
    '....gcC...',
    '....gcC...',
    '....gcC...',
    '....cCC...',
    '....cCC...',
    '....CC....',
    '....CC....',
  ],
  [
    '...ccc....',
    '...cggc...',
    '..CcccgC..',
    '..Ccccgc..',
    '..Ccccgc..',
    '..Ccccgc..',
    '..CCcccc..',
    '..CCCccc..',
    '...CCCc...',
    '....CCC...',
  ],
];

const ENEMY_FRAMES = [
  [
    '..e......e..',
    '.ee.e..e.ee.',
    '.eeeeeeeee..',
    'eeeeeeeeeeee',
    'eyyeeeeeyye.',
    'eyEeeeeeyEe.',
    'eeeeeeeeeeee',
    'eeEeeEeeEee.',
    'EeeEEeEEeeE.',
    'EEEEEEEEEEEE',
    '.EE.EE.EE...',
    'EE..EE..EE..',
  ],
  [
    '.e.......e..',
    '.ee.e..e.ee.',
    '.eeeeeeeee..',
    'eeeeeeeeeeee',
    'eyyeeeeeyye.',
    'eyEeeeeeyEe.',
    'eeeeeeeeeeee',
    'eeEeeEeeEee.',
    'EeeEEeEEeeE.',
    'EEEEEEEEEEEE',
    '..EE.EE.EE..',
    '..EE..EE..EE',
  ],
];

const KEY_GRID = [
  '..kkkk....',
  '.kk..kk...',
  '.kk..kk...',
  '..kkkk....',
  '....kk....',
  '....kk....',
  '....kkkk..',
  '....kk....',
  '....kkkk..',
  '....kk....',
  '....kk....',
  '..........',
];

const SPRING_UP = [
  'SSSSSSSSSSSSSS',
  'S............S',
  '.zzzzzzzzzzzz.',
  '..zz......zz..',
  '.zzzzzzzzzzzz.',
  '..zz......zz..',
  'ZZZZZZZZZZZZZZ',
  'ZZZZZZZZZZZZZZ',
];
const SPRING_DOWN = [
  '..............',
  '..............',
  '..............',
  'SSSSSSSSSSSSSS',
  '.zzzzzzzzzzzz.',
  '.zzzzzzzzzzzz.',
  'ZZZZZZZZZZZZZZ',
  'ZZZZZZZZZZZZZZ',
];

const FLAG_OFF = [
  '.ff.........',
  '.fff........',
  '.ffff.......',
  '.fffff......',
  '.ffff.......',
  '.fff........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  '.ff.........',
  'ffff........',
  'ffff........',
];
const FLAG_ON = FLAG_OFF.map((r) => r.replace(/f(?=f*\.)/g, 'F').replace(/f/g, 'F'));

const PORTAL_FRAMES = [
  [
    '....oooo......',
    '..oo....oo....',
    '.o..OOOO..o...',
    '.o.OO..OO.o...',
    'o..O....O..o..',
    'o.OO.OO.OO.o..',
    'o.O..OO..O.o..',
    'o.O..OO..O.o..',
    'o.OO.OO.OO.o..',
    'o..O....O..o..',
    '.o.OO..OO.o...',
    '.o..OOOO..o...',
    '..oo....oo....',
    '....oooo......',
  ],
  [
    '....oooo......',
    '..oo....oo....',
    '.o...OO...o...',
    '.o..OOOO..o...',
    'o..OO..OO..o..',
    'o.OO....OO.o..',
    'o.O.OOOO.O.o..',
    'o.O.OOOO.O.o..',
    'o.OO....OO.o..',
    'o..OO..OO..o..',
    '.o..OOOO..o...',
    '.o...OO...o...',
    '..oo....oo....',
    '....oooo......',
  ],
];

// ---------------------------------------------------------------------------
// Tiles (16x16, procedural)

function drawWallTile(mask) {
  // mask bits: 1=open above, 2=open right, 4=open below, 8=open left
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 0, TILE, TILE);
  // grain
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const g = grain(x, y, mask * 31);
      if (g < 0.1) {
        ctx.fillStyle = PALETTE.wallDark;
        ctx.fillRect(x, y, 1, 1);
      } else if (g > 0.965) {
        ctx.fillStyle = PALETTE.wallRim;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Edge rims where exposed to air — reads as moonlight from above.
  if (mask & 1) {
    ctx.fillStyle = PALETTE.wallRimBright;
    ctx.fillRect(0, 0, TILE, 2);
    ctx.fillStyle = PALETTE.wallRim;
    ctx.fillRect(0, 2, TILE, 1);
  }
  if (mask & 4) {
    ctx.fillStyle = PALETTE.wallDark;
    ctx.fillRect(0, TILE - 2, TILE, 2);
  }
  if (mask & 2) {
    ctx.fillStyle = PALETTE.wallRim;
    ctx.fillRect(TILE - 1, 0, 1, TILE);
  }
  if (mask & 8) {
    ctx.fillStyle = PALETTE.wallRim;
    ctx.fillRect(0, 0, 1, TILE);
  }
  return c;
}

function drawBgWallTile() {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.bgWall;
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = PALETTE.bgWallDark;
  ctx.fillRect(0, 7, TILE, 1);
  ctx.fillRect(0, 15, TILE, 1);
  ctx.fillRect(4, 0, 1, 8);
  ctx.fillRect(11, 8, 1, 8);
  return c;
}

function drawLavaTile(frame, surface) {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.lava;
  ctx.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const g = grain(x, y, frame * 97);
      if (g < 0.12) {
        ctx.fillStyle = PALETTE.lavaDeep;
        ctx.fillRect(x, y, 1, 1);
      } else if (g > 0.92) {
        ctx.fillStyle = PALETTE.lavaBright;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  if (surface) {
    ctx.fillStyle = PALETTE.lavaBright;
    for (let x = 0; x < TILE; x += 4) {
      ctx.fillRect(x, frame ? 0 : 1, 3, 1);
    }
    ctx.fillRect(0, frame ? 1 : 0, TILE, 1);
  }
  return c;
}

function drawOnewayTile() {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.onewayRim;
  ctx.fillRect(0, 0, TILE, 2);
  ctx.fillStyle = PALETTE.oneway;
  ctx.fillRect(0, 2, TILE, 3);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(1, 5, 2, 2);
  ctx.fillRect(13, 5, 2, 2);
  return c;
}

function drawDoorTile() {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.door;
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = PALETTE.doorRim;
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillRect(0, 0, 1, TILE);
  ctx.fillStyle = PALETTE.doorDark;
  ctx.fillRect(TILE - 1, 0, 1, TILE);
  ctx.fillRect(0, TILE - 1, TILE, 1);
  ctx.fillRect(6, 5, 4, 4);
  ctx.fillRect(7, 9, 2, 3);
  return c;
}

function drawPlatformSprite() {
  const c = makeCanvas(TILE * 3, 8);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.onewayRim;
  ctx.fillRect(0, 0, TILE * 3, 2);
  ctx.fillStyle = PALETTE.oneway;
  ctx.fillRect(0, 2, TILE * 3, 4);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(0, 6, TILE * 3, 2);
  ctx.fillStyle = PALETTE.portal;
  ctx.fillRect(2, 3, 2, 2);
  ctx.fillRect(TILE * 3 - 4, 3, 2, 2);
  return c;
}

// ---------------------------------------------------------------------------

export function buildSprites() {
  return {
    player: {
      idle: [playerFrame('stand')],
      run: [playerFrame('run1'), playerFrame('run2'), playerFrame('run3'), playerFrame('run2')],
      jump: playerFrame('jump'),
      fall: playerFrame('fall'),
    },
    coin: COIN_FRAMES.map(gridToCanvas),
    enemy: ENEMY_FRAMES.map(gridToCanvas),
    key: gridToCanvas(KEY_GRID),
    spring: { up: gridToCanvas(SPRING_UP), down: gridToCanvas(SPRING_DOWN) },
    checkpoint: { off: gridToCanvas(FLAG_OFF), on: gridToCanvas(FLAG_ON) },
    portal: PORTAL_FRAMES.map(gridToCanvas),
    platform: drawPlatformSprite(),
    wall: Array.from({ length: 16 }, (_, m) => drawWallTile(m)),
    bgWall: drawBgWallTile(),
    oneway: drawOnewayTile(),
    door: drawDoorTile(),
    lava: [drawLavaTile(0, false), drawLavaTile(1, false)],
    lavaSurface: [drawLavaTile(0, true), drawLavaTile(1, true)],
    lavaBlob: [drawLavaTile(0, true), drawLavaTile(1, true)],
  };
}

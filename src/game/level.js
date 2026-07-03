// ASCII level format — the single source of truth for the alphabet.
//
// Grid tiles (static, part of the terrain):
//   x  solid wall            #  background wall (decorative, non-solid)
//   !  lava                  -  one-way platform (jump up through it)
//   D  locked door (solid until opened with a key)
//
// Actors (spawned entities):
//   @  player start          o  coin
//   v  dripping lava         |  lava, bounces vertically
//   =  lava, bounces horizontally
//   ~  moving platform (horizontal)   H  moving platform (vertical)
//   ^  spring                k  key
//   e  patrolling enemy (stompable)   *  checkpoint
//   E  exit portal
//
// Anything else is empty space (unknown chars warn once to the console).

export const TILE = 16;

export const GRID_CHARS = new Set(['x', '#', '!', '-', 'D']);
export const ACTOR_CHARS = new Set(['@', 'o', 'v', '|', '=', '~', 'H', '^', 'k', 'e', '*', 'E']);

const warned = new Set();

export function parseLevel(def) {
  // def: { name, goal: 'coins' | 'exit', rows: [string] } or a bare rows array.
  const rows = Array.isArray(def) ? def : def.rows;
  const name = def.name || 'Untitled';
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const tiles = new Array(width * height).fill(' ');
  const spawns = [];

  for (let ty = 0; ty < height; ty++) {
    const row = rows[ty];
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      if (ch === ' ') continue;
      if (GRID_CHARS.has(ch)) {
        tiles[ty * width + tx] = ch;
      } else if (ACTOR_CHARS.has(ch)) {
        spawns.push({ ch, tx, ty });
      } else if (!warned.has(ch)) {
        warned.add(ch);
        console.warn(`level "${name}": unknown char "${ch}" treated as empty`);
      }
    }
  }

  const goal = def.goal || (spawns.some((s) => s.ch === 'E') ? 'exit' : 'coins');
  return {
    name,
    goal,
    rows,
    width,
    height,
    tiles,
    spawns,
    pixelWidth: width * TILE,
    pixelHeight: height * TILE,
  };
}

// Out-of-bounds: sides and top are walls, below the bottom is lava
// (falling off the level kills you).
export function tileAt(level, tx, ty) {
  if (ty >= level.height) return '!';
  if (tx < 0 || tx >= level.width || ty < 0) return 'x';
  return level.tiles[ty * level.width + tx];
}

export function setTile(level, tx, ty, ch) {
  if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return;
  level.tiles[ty * level.width + tx] = ch;
}

// Serialize a tile grid + spawns back to ASCII rows (used by the editor).
export function levelToRows(level, actors) {
  const grid = [];
  for (let ty = 0; ty < level.height; ty++) {
    const row = new Array(level.width).fill(' ');
    for (let tx = 0; tx < level.width; tx++) {
      const ch = level.tiles[ty * level.width + tx];
      if (ch !== ' ') row[tx] = ch;
    }
    grid.push(row);
  }
  for (const s of actors || level.spawns) {
    if (s.ty >= 0 && s.ty < level.height && s.tx >= 0 && s.tx < level.width) {
      grid[s.ty][s.tx] = s.ch;
    }
  }
  return grid.map((r) => r.join('').replace(/\s+$/, ''));
}

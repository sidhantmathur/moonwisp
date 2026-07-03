// AABB physics against the tile grid. Entities are {x, y, w, h} in pixels
// (x, y = top-left). Movement resolves one axis at a time; at 120 Hz nothing
// moves close to a tile per step, so no swept tests are needed.

import { TILE, tileAt } from '../game/level.js';

const EPS = 0.001;

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Doors are opened per-tile; track open tiles in game.openedDoors as "tx,ty".
function solidAtTile(level, tx, ty, game) {
  const ch = tileAt(level, tx, ty);
  if (ch === 'x') return true;
  if (ch === 'D') return !(game && game.openedDoors && game.openedDoors.has(tx + ',' + ty));
  return false;
}

// Move an entity by (dx, dy), clipping against solid tiles and (optionally)
// one-way platforms and rider-carrying solids (moving platforms).
// Returns { hitX, hitY, onGround, onPlatform } — onPlatform is the platform
// actor stood on, if any.
export function moveEntity(e, dx, dy, level, game, opts = {}) {
  const res = { hitX: false, hitY: false, onGround: false, onPlatform: null };
  const platforms = (opts.platforms || []).filter((p) => p !== e);

  // --- X axis ---
  e.x += dx;
  if (dx !== 0) {
    const dir = Math.sign(dx);
    const edgeX = dir > 0 ? e.x + e.w : e.x;
    const tx = Math.floor(edgeX / TILE);
    const ty0 = Math.floor((e.y + EPS) / TILE);
    const ty1 = Math.floor((e.y + e.h - EPS) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (solidAtTile(level, tx, ty, game)) {
        e.x = dir > 0 ? tx * TILE - e.w - EPS : (tx + 1) * TILE + EPS;
        res.hitX = true;
        break;
      }
    }
    if (!res.hitX) {
      for (const p of platforms) {
        if (overlaps(e, p)) {
          e.x = dir > 0 ? p.x - e.w - EPS : p.x + p.w + EPS;
          res.hitX = true;
          break;
        }
      }
    }
  }

  // --- Y axis ---
  const prevBottom = e.y + e.h;
  e.y += dy;
  if (dy !== 0) {
    const dir = Math.sign(dy);
    const edgeY = dir > 0 ? e.y + e.h : e.y;
    const ty = Math.floor(edgeY / TILE);
    const tx0 = Math.floor((e.x + EPS) / TILE);
    const tx1 = Math.floor((e.x + e.w - EPS) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(level, tx, ty);
      let solid = solidAtTile(level, tx, ty, game);
      // One-way platforms: only solid when falling onto their top surface
      // (feet were at or above the platform top before this step).
      if (!solid && ch === '-' && dir > 0 && !opts.dropThrough) {
        solid = prevBottom <= ty * TILE + 0.5;
      }
      if (solid) {
        if (dir > 0) {
          e.y = ty * TILE - e.h - EPS;
          res.onGround = true;
        } else {
          e.y = (ty + 1) * TILE + EPS;
        }
        res.hitY = true;
        break;
      }
    }
    if (!res.hitY) {
      for (const p of platforms) {
        if (overlaps(e, p)) {
          if (dir > 0 && prevBottom <= p.y + 4) {
            e.y = p.y - e.h - EPS;
            res.onGround = true;
            res.onPlatform = p;
            res.hitY = true;
          } else if (dir < 0) {
            e.y = p.y + p.h + EPS;
            res.hitY = true;
          }
          break;
        }
      }
    }
  }

  // Standing check even when not moving down this step (dy could be 0 while riding).
  if (!res.onPlatform && dy >= 0) {
    const feet = { x: e.x, y: e.y + e.h, w: e.w, h: 2 };
    for (const p of platforms) {
      if (overlaps(feet, p) && e.y + e.h <= p.y + 4) {
        res.onPlatform = p;
        res.onGround = true;
        break;
      }
    }
  }

  return res;
}

// True if the entity's rect (shrunk by pad px) overlaps any grid tile == ch.
export function touchesTileType(e, level, ch, pad = 2) {
  const x0 = Math.floor((e.x + pad) / TILE);
  const x1 = Math.floor((e.x + e.w - pad) / TILE);
  const y0 = Math.floor((e.y + pad) / TILE);
  const y1 = Math.floor((e.y + e.h - pad) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(level, tx, ty) === ch) return true;
    }
  }
  return false;
}

// Tiles of a given type overlapped by the entity (for door opening).
export function overlappedTiles(e, level, ch, pad = 0) {
  const out = [];
  const x0 = Math.floor((e.x - pad) / TILE);
  const x1 = Math.floor((e.x + e.w + pad) / TILE);
  const y0 = Math.floor((e.y - pad) / TILE);
  const y1 = Math.floor((e.y + e.h + pad) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(level, tx, ty) === ch) out.push({ tx, ty });
    }
  }
  return out;
}

export function groundBelow(e, level, game, platforms = []) {
  const feet = { x: e.x, y: e.y + e.h + EPS, w: e.w, h: 1 };
  const ty = Math.floor((feet.y + 0.5) / TILE);
  const tx0 = Math.floor((e.x + EPS) / TILE);
  const tx1 = Math.floor((e.x + e.w - EPS) / TILE);
  const onTileBoundary = Math.abs(e.y + e.h - ty * TILE) < 1.5;
  if (onTileBoundary) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(level, tx, ty);
      if (solidAtTile(level, tx, ty, game)) return true;
      if (ch === '-') return true;
    }
  }
  for (const p of platforms) {
    if (p !== e && overlaps(feet, p)) return true;
  }
  return false;
}

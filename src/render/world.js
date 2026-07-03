// Draws the game world: tiles, actors, player, particles.

import { TILE, tileAt } from '../game/level.js';
import { PALETTE } from './palette.js';

function wallMask(level, tx, ty) {
  // bits: 1=open above, 2=open right, 4=open below, 8=open left
  const solid = (x, y) => {
    const ch = tileAt(level, x, y);
    return ch === 'x' || ch === 'D';
  };
  let m = 0;
  if (!solid(tx, ty - 1)) m |= 1;
  if (!solid(tx + 1, ty)) m |= 2;
  if (!solid(tx, ty + 1)) m |= 4;
  if (!solid(tx - 1, ty)) m |= 8;
  return m;
}

export function drawWorld(ctx, game, sprites, alpha, time) {
  const { level, camera, player } = game;
  const vx = camera.viewX();
  const vy = camera.viewY();

  const tx0 = Math.max(0, Math.floor(vx / TILE));
  const tx1 = Math.min(level.width - 1, Math.floor((vx + camera.viewW) / TILE));
  const ty0 = Math.max(0, Math.floor(vy / TILE));
  const ty1 = Math.min(level.height - 1, Math.floor((vy + camera.viewH) / TILE));
  const lavaFrame = Math.floor(time * 4) % 2;

  // --- Tiles ---
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = level.tiles[ty * level.width + tx];
      if (ch === ' ') continue;
      const dx = tx * TILE - vx;
      const dy = ty * TILE - vy;
      switch (ch) {
        case '#':
          ctx.drawImage(sprites.bgWall, dx, dy);
          break;
        case 'x':
          ctx.drawImage(sprites.wall[wallMask(level, tx, ty)], dx, dy);
          break;
        case '!': {
          const surface = tileAt(level, tx, ty - 1) !== '!';
          ctx.drawImage((surface ? sprites.lavaSurface : sprites.lava)[lavaFrame], dx, dy);
          if (surface) {
            ctx.fillStyle = PALETTE.lavaGlow;
            ctx.fillRect(dx - 2, dy - 5, TILE + 4, 5);
          }
          break;
        }
        case '-':
          ctx.drawImage(sprites.oneway, dx, dy);
          break;
        case 'D':
          if (!game.openedDoors.has(tx + ',' + ty)) {
            ctx.drawImage(sprites.door, dx, dy);
          }
          break;
      }
    }
  }

  // --- Actors ---
  const coinFrame = Math.floor(time * 8) % 4;
  const enemyFrame = Math.floor(time * 6) % 2;
  const portalFrame = Math.floor(time * 5) % 2;
  for (const a of game.actors) {
    if (a.dead) continue;
    const ax = Math.round(a.renderX(alpha) - vx);
    const ay = Math.round(a.renderY(alpha) - vy);
    switch (a.type) {
      case 'coin':
        ctx.drawImage(sprites.coin[(coinFrame + (a.spawnIndex || 0)) % 4], ax, ay);
        break;
      case 'lava':
        ctx.drawImage(sprites.lavaBlob[lavaFrame], ax, ay);
        ctx.fillStyle = PALETTE.lavaGlow;
        ctx.fillRect(ax - 2, ay - 3, TILE + 4, 3);
        break;
      case 'platform':
        ctx.drawImage(sprites.platform, ax, ay);
        break;
      case 'spring':
        ctx.drawImage(a.anim > 0.4 ? sprites.spring.down : sprites.spring.up, ax - 1, ay);
        break;
      case 'key':
        ctx.drawImage(sprites.key, ax, ay);
        break;
      case 'checkpoint':
        ctx.drawImage(a.lit ? sprites.checkpoint.on : sprites.checkpoint.off, ax, ay);
        break;
      case 'exit':
        ctx.drawImage(sprites.portal[portalFrame], ax, ay - 2);
        break;
      case 'enemy':
        ctx.drawImage(sprites.enemy[enemyFrame], ax, ay);
        break;
    }
  }

  // --- Player (hidden while dying — the burst already replaced them) ---
  if (game.status !== 'dying') {
    const frame = playerSprite(player, sprites, time);
    const px = player.renderX(alpha) + player.w / 2;
    const py = player.renderY(alpha) + player.h; // feet
    ctx.save();
    ctx.translate(Math.round(px - vx), Math.round(py - vy));
    ctx.scale(player.facing * player.scaleX, player.scaleY);
    ctx.drawImage(frame, -frame.width / 2, -frame.height);
    ctx.restore();
  }

  // --- Particles ---
  game.particles.draw(ctx, vx, vy);
}

function playerSprite(player, sprites, time) {
  switch (player.state) {
    case 'run': return sprites.player.run[Math.floor(player.runTime * 10) % 4];
    case 'jump': return sprites.player.jump;
    case 'fall': return sprites.player.fall;
    default: return sprites.player.idle[0];
  }
}

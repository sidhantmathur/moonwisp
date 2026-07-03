// In-canvas HUD: coin count, keys, timer, level-name toast.

import { PALETTE } from './palette.js';

export function formatTime(ms) {
  const total = Math.floor(ms / 10); // centiseconds
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function drawHud(ctx, game, sprites, settings, dt) {
  const W = game.camera.viewW;
  ctx.font = 'bold 9px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'top';

  // Coins.
  const left = game.coinsLeft;
  const got = game.coinsTotal - left;
  ctx.drawImage(sprites.coin[0], 8, 7);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`${got}/${game.coinsTotal}`, 24, 9);

  // Keys.
  for (let i = 0; i < game.keys; i++) {
    ctx.drawImage(sprites.key, 24 + ctx.measureText(`${got}/${game.coinsTotal}`).width + 8 + i * 12, 7);
  }

  // Timer.
  if (settings.timer) {
    const label = formatTime(game.time * 1000);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.textAlign = 'right';
    ctx.fillText(label, W - 8, 9);
    ctx.textAlign = 'left';
  }

  // Goal hint + level toast.
  if (game.toast.t > 0) {
    game.toast.t -= dt;
    const a = Math.min(1, game.toast.t / 0.5);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(game.toast.text, W / 2, 26);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText(game.level.goal === 'coins' ? 'collect every coin' : 'reach the portal', W / 2, 40);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

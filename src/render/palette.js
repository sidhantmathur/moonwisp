// The entire game palette. Retint the whole game from this one file.
// Moody, low-saturation base with hot accents (Celeste/Towerfall-ish).

export const PALETTE = {
  // Sky / background
  skyTop: '#0d0a1a',
  skyBottom: '#2a1e3f',
  parallaxFar: '#231a38',
  parallaxMid: '#1b1430',
  parallaxNear: '#140e26',
  mote: '#6f6394',

  // Terrain
  wall: '#3d4258',
  wallDark: '#2e3244',
  wallDarker: '#23273660',
  wallRim: '#6a7190',
  wallRimBright: '#9aa3c4',
  bgWall: '#262a3a',
  bgWallDark: '#1f2331',
  oneway: '#57506e',
  onewayRim: '#8d84ad',

  // Hazards
  lava: '#ff5e2e',
  lavaBright: '#ffd23e',
  lavaDeep: '#b31e33',
  lavaGlow: '#ff5e2e55',

  // Player
  playerBody: '#4ee3b5',
  playerBodyDark: '#2aa583',
  playerScarf: '#e05f7c',
  playerEye: '#f7fbff',
  playerPupil: '#132030',

  // Actors
  coin: '#ffd23e',
  coinDark: '#d98e1b',
  coinGlint: '#fff7d0',
  spring: '#c9d1e8',
  springBase: '#6a7190',
  springCoil: '#e05f7c',
  key: '#ffd23e',
  door: '#7c5cbf',
  doorDark: '#513d80',
  doorRim: '#b49aef',
  enemy: '#b366e0',
  enemyDark: '#7c3fa8',
  enemyEye: '#ffe9f5',
  checkpoint: '#6f6394',
  checkpointLit: '#4ee3b5',
  portal: '#4ec3e3',
  portalCore: '#d9f6ff',

  // UI / FX
  hudText: '#e8e4f4',
  hudDim: '#8d84ad',
  dust: '#8d84ad',
  spark: '#ffd23e',
  white: '#ffffff',
};

// Single-letter keys used by the pixel-art string grids in sprites.js.
export const INK = {
  b: PALETTE.playerBody,
  B: PALETTE.playerBodyDark,
  s: PALETTE.playerScarf,
  w: PALETTE.playerEye,
  p: PALETTE.playerPupil,
  c: PALETTE.coin,
  C: PALETTE.coinDark,
  g: PALETTE.coinGlint,
  e: PALETTE.enemy,
  E: PALETTE.enemyDark,
  y: PALETTE.enemyEye,
  k: PALETTE.key,
  d: PALETTE.door,
  D: PALETTE.doorDark,
  r: PALETTE.doorRim,
  S: PALETTE.spring,
  Z: PALETTE.springBase,
  z: PALETTE.springCoil,
  o: PALETTE.portal,
  O: PALETTE.portalCore,
  f: PALETTE.checkpoint,
  F: PALETTE.checkpointLit,
  l: PALETTE.lava,
  L: PALETTE.lavaBright,
  v: PALETTE.lavaDeep,
};

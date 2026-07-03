# WISP

A tiny, moody pixel platformer. Pure canvas, vanilla JS, zero dependencies,
zero build step — every sprite, sound, and level is generated from code.

**Play it: https://sidhantmathur.github.io/Platforming-Game/**

## Controls

|  |  |
|--|--|
| Move | ← → or A / D |
| Jump | ↑ / W / Z / Space (hold for higher, tap for a hop) |
| Drop through platforms | hold ↓ |
| Restart level | R |
| Pause | Esc |

Gamepads and touch screens work too.

## What's inside

- Movement tuned to feel good: coyote time, jump buffering, variable jump
  height, apex float, squash & stretch, screen shake, particles.
- Two level packs: **Moonside** (the new campaign — reach the portal) and
  **Classic 2021** (the original levels this repo started as — collect every coin).
- Springs, moving platforms, one-way platforms, patrolling enemies you can
  stomp, keys and doors, checkpoints, and four flavors of lava.
- An **in-browser level editor** (Level Select → Editor): paint tiles, playtest
  instantly, copy the level as plain text.
- Best times and progress saved locally.

## Make your own levels

Levels are plain ASCII — a wall is `x`, a coin is `o`, lava is `!`. That means
an LLM can write, mutate, and reason about levels as text: paste
[LEVELS.md](LEVELS.md) into your model of choice and ask for a level, then
paste the result into the in-game editor and play it.

## Running locally

It's a static site — serve the repo root with anything:

```
python3 -m http.server
```

## History

This repo began in 2021 as the platformer from *Eloquent JavaScript* ch. 15
with custom levels. The 2026 rewrite kept exactly one thing: the ASCII level
format (and the old levels, playable as the Classic pack). The original lives
in git history.

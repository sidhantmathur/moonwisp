# MOONWISP level format

Levels are plain ASCII grids: each level is an array of equal-length strings,
one character per 16px tile. This file is a complete spec — paste it into any
LLM and ask for a level.

## Alphabet

| char | thing | notes |
|------|-------|-------|
| ` ` (space) | empty | |
| `x` | solid wall | |
| `#` | background wall | decorative, non-solid |
| `!` | lava | kills on touch |
| `-` | one-way platform | jump up through it; hold ↓ to drop through |
| `D` | locked door | solid; a key opens a contiguous run of `D` tiles |
| `@` | player start | exactly one per level |
| `o` | coin | the goal in `coins` levels, optional score otherwise |
| `v` | dripping lava | falls, then teleports back to its start |
| `\|` | bouncing lava (vertical) | patrols up/down until blocked |
| `=` | bouncing lava (horizontal) | patrols left/right until blocked |
| `~` | moving platform (horizontal) | 3 tiles wide, spawns centered on the char |
| `H` | moving platform (vertical) | same, oscillates in its shaft |
| `^` | spring | bounces the player ~9 tiles up |
| `k` | key | consumed one per door |
| `e` | enemy | patrolling walker; stomp it from above |
| `*` | checkpoint | respawn point after touching it |
| `E` | exit portal | the goal in `exit` levels |

Unknown characters are treated as empty (with a console warning).

## Physics envelope (design within these numbers)

- One tile = 16px. The player is 12×22px — every passage needs **2 tiles of clearance**.
- Max jump height ≈ 4.7 tiles → required climbs should be **≤ 4 tiles**.
- Max jump distance ≈ 8 tiles → required gaps should be **≤ 6 tiles**.
- Spring bounce ≈ 9 tiles up → required spring climbs **≤ 8 tiles**.
- Falling off the bottom of the level is death. The sides and top are invisible walls.
- Coyote time and jump buffering are on — be generous anyway; no pixel-perfect jumps.
- Moving platforms travel until they hit a solid tile or the level edge, then reverse.
  Place them in corridors that define the route you intend.
- Enemies turn around at walls and ledge edges; give them a shelf to patrol.

## Level structure

Levels live in [levels/packs.js](levels/packs.js):

```js
{
  name: 'First Light',
  goal: 'exit',      // 'exit' = touch E; 'coins' = collect every o
  rows: [
    "                    ",
    "   o        E       ",
    "  xxx     xxxxx     ",
    " @                  ",
    "xxxxxxxxxxxxxxxxxxxx",
  ],
}
```

## Authoring tips

- Sketch the intended route first; sprinkle coins as breadcrumbs along it.
- Introduce one new idea per level, and show a hazard safely before it can kill.
- No leaps of faith: the landing should be visible before the player commits.
- Use `#` sparingly for depth (ruins, interiors); it reads as background.
- Playtest in the in-game editor (Level Select → Editor): paste your rows into
  the textarea and hit Playtest.

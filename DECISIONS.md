# Decisions

Calls made where the brief was open, with the reasoning. Newest items are at
the bottom of each section.

## Stack and structure

- **Versions.** Three.js 0.186, TypeScript 7 (strict, `noUnusedLocals`,
  `exactOptional…` off), Vite 8, Vitest 5, Playwright 1.63 driving the
  installed Chrome (`channel: 'chrome'`), so no browser download is needed.
- **Data files are typed TypeScript modules, not JSON.** They are still pure
  data (no logic), but typos in a move id or a missing field fail the type
  check instead of failing at runtime, and editors autocomplete field names.
  Vite hot-reloads them on save during `npm run dev`.
- **Simulation is a separate module tree** (`src/sim`) that imports nothing
  from three.js or the DOM. It runs headless in Vitest, including a full
  level playthrough.
- **One world object, advanced by `step(world, inputs[])`.** Every player is a
  slot and a fighter; input arrives as an array of per-player `InputState`.
  All randomness comes from a seeded RNG stored in the world, so two worlds
  with the same seed and inputs stay identical (a test checks this), which is
  what lockstep or rollback netcode needs.
- **Slow motion lives in the app loop, not the simulation.** When the
  simulation sets `world.slowmo`, the loop steps it at a quarter of real
  time. The simulation still advances one fixed frame per step, so it stays
  deterministic.

## Combat rules

- **The combo only advances while it connects**, as in Streets of Rage 2. A
  whiffed jab gets full recovery and the next press starts `jab_1` again.
  The chain window is data (`chain.from`, `requireHit`).
- **Input buffer is 6 frames, counted only on frames the fighter actually
  steps.** Otherwise a press made during a long hitstop (up to 12 frames) would
  expire before the fighter could use it, and combos would drop exactly when
  they should feel best.
- **Hitstop is per fighter.** The attacker and the victim freeze; everyone
  else keeps moving. The victim gets one extra frame so the impact pose reads,
  and shakes during the freeze.
- **Depth tolerance.** A hit connects only if `|dz| <= move.zRange (default
  0.34 m) + target.zRadius`. An earlier 0.42 m default made telegraphed enemy
  attacks impossible to sidestep.
- **Hits are collected, then applied.** Two fighters who hit each other on the
  same frame both get hit (a trade). A target takes at most one hit per frame.
- **Any hit on an airborne fighter knocks it down.** Knocked-down fighters are
  invulnerable until they have got up, so there are no juggles or
  wake-up loops. Get-up invulnerability is 50 frames for players and 16 for
  enemies.
- **Armour.** `light` armour (the bruiser's wind-ups) ignores the stun of light
  hits only. `full` armour (boss attacks) ignores all stun. Bosses take 50%
  damage while armoured and full damage in recovery.
- **Bosses can't be locked down.** After a streak of hits without acting (6
  for Sobekhan, 5 for Apep), a boss answers with a quick armoured counter.
  Knockdown hits floor a boss only while it is not armoured.
- **When a boss dies, the rest of its encounter collapses with it** (thrower
  and grunt reinforcements are knocked out), so the victory beat isn't
  interrupted by clean-up.
- **Enemy weapons never wear out.** When dropped, they become a normal item
  with full durability. A dropped item vanishes after 15 seconds and blinks
  for the last 2.5. Items placed in the level stay until picked up.
- **Picking up only works empty-handed.** With a weapon, attack attacks.
- **The blade runner's knife is a khopesh.** The brief lists three weapon types
  and asks for blade runners to drop their knife, so the knife is the
  khopesh (the setting's blade).

## Player survival

- **3 lives in total.** The HUD counts ×3, ×2, ×1. Losing the last one is game
  over.
- **Respawn in place:** the player drops back in at the same x with full health
  and 150 frames of invulnerability. On landing, a pulse knocks down every
  enemy within 3.8 m and does no damage.
- **Continues are unlimited.** A continue restarts the current environment
  with 3 lives and keeps the score. The results screen shows how many
  continues were used, and it affects the rank.
- **+50% health at the start of each environment**, capped at full.
- **No stage timer.** The brief doesn't ask for one, and it would fight the
  12–15 minute target.
- **The clock on the results screen counts all play time**, including stages
  replayed after a continue (it is carried over with the score).

## Camera and playfield

- **Camera: 16° downward pitch, 19° vertical FOV, 22.5 m from the look-at
  point, 16:9 letterboxed.** With a true perspective camera there is a hard
  trade-off: an object's size on screen is proportional to its distance below
  the horizon line. A thick floor band with little size change from the back
  of the lane to the front therefore needs the horizon above the frame. These
  numbers give a ~7 m deep lane (z −3…+3) covering about 45% of the screen,
  with roughly 30% size change front to back. The environments are composed
  for that view: background vistas (lower city tiers, the seabed, the hall of
  colossi) sit below the horizon instead of on it.
- **Environments are composed for the belt camera.** Anything that must read
  in the back of the scene, such as the throne, the sun disc and the cobra
  guardians, is kept below the top of the frame at its depth (about 4 m at
  z −8). Taller elements (colossi, colonnades) are allowed to crop at the
  frame edge to sell their scale. Thin background details are sized for
  their distance: at 40 m a 5 cm vine is under a pixel wide and reads as
  a glitch, so far-wall vines use stems 10–40 cm thick.
- **Fixed aspect ratio.** The simulation knows the exact visible width at any
  depth (`viewHalfWidthAt(z)`, shared with the renderer). That width keeps
  players on screen, locks arenas, and implements "nobody attacks from
  off-screen".
- **Facing cheat.** Characters only face left or right, but their yaw is
  cheated 14° toward the camera so faces, chests and fists read. A turn takes
  a few frames and passes through the camera-facing side.
- **Camera follows the lead player at +1.4 m and never scrolls back.** For
  co-op, it is already clamped so the rear player can't fall off the left
  edge.
- **Environment transitions:** the player walks off the right edge, the screen
  fades out, the next environment is built while the screen is black, and the
  player walks in under a stage title card.
- **The tram doesn't move in world space.** The car is static and everything
  outside it (tube ribs, glass, seabed, kelp, coral) scrolls. Those layers are
  built with a 20 m period so the scroll never shows a seam. Distant layers
  scroll with parallax factors. Enemies drop in from the roof.

## Enemies and bosses

- **Attack tokens are per target (max 2).** A fighting boss permanently holds
  one, so during boss fights at most one add attacks alongside the boss.
- **Flanking:** enemies waiting for a token pick the side of the player with
  fewer enemies and hold a distance and depth offset, re-rolled every 1–3 s.
- **Telegraphs:** every enemy attack has at least 9 frames of startup with an
  anticipation pose, a warning-orange glow on the attacker (violet for Apep)
  and a glint flare at the hand when the wind-up starts. Thrower jars show a
  red target ring where they will land.
- **Enemy variety:** besides the five archetypes there is a palette variant,
  "Scarab Elite" (more health, faster), so the late game isn't only new
  archetypes.
- **Final boss reinforcements:** two throwers when phase 2 starts, then one
  more every 9 s while fewer than 2 are alive, up to 6 in total.
- **Phase-2 Apep is fast but readable.** His combo opener keeps 11 frames of
  startup, and his idle windows between attacks are 22–44 frames. In
  play-tests the faster 9-frame opener produced hits that were hard to react
  to.
- **An encounter clears when its last enemy has hit the ground,** not the
  instant its health reaches zero. The GO arrow therefore never appears
  during a boss's slow-motion death flight.

## Rendering

- **Characters use rigid skinning.** Every costume piece is bound to one bone
  (cloth strips blend across their spring-chain bones), then merged by
  material into four skinned meshes (matte, metal, gloss, glow) plus an
  inverted-hull outline, all sharing one skeleton. That is about 5 draw calls
  per character, and a GLB with the same joint names could drop straight in.
- **Per-character uniforms, shared programs.** Each character gets its own
  material instances (for flash, fade, glow and rim) but a constant
  `customProgramCacheKey`, so shaders compile once per type.
- **Fades use ordered dithering (Bayer 4×4 discard), not alpha blending.** No
  sorting problems and no shader recompiles. Defeated enemies also blink, in
  the Streets of Rage manner.
- **Rim light and outline instead of a toon ramp.** The PBR look is kept for
  gold and stone, and characters still separate from the background. Each
  environment sets its own rim colour.
- **Environment geometry is merged per material** and given world-space box
  UVs, so textures tile at a constant texel density on any wall size. Fish,
  kelp and crowds are instanced and animated in the vertex shader.
- **Lamp proxies:** each environment lists its lamps, and 4 real point lights
  are reassigned every frame to the lamps nearest the camera. The shader
  light count never changes, so there are no recompiles.
- **Post-processing:** scene into a half-float target with 4× MSAA, then
  UnrealBloom at half resolution, then one custom pass (exposure, fitted ACES,
  per-environment lift/gamma/gain, saturation, contrast, vignette, grain,
  fades and flashes).
- **Dynamic resolution:** the pixel ratio drops in 0.1 steps (to 0.6) when the
  median frame time exceeds 19 ms and recovers when frames are fast. The cap
  is `min(devicePixelRatio, 1.25)`.
- **All textures are generated on canvases at load:** stone, carved and painted
  hieroglyph reliefs (30 hand-coded glyphs), floors, cloth, containers, neon
  signs, window lights and particle sprites. Height fields become normal maps.

## Audio

- **Placeholder SFX are synthesised sample by sample at start-up.** Placeholder
  music is a small step sequencer with one pattern per slot. Any manifest entry
  with files replaces the placeholder. SFX with several files pick one at
  random.
- **Identical sounds fired within 25 ms are throttled** so multi-hit frames
  don't clip.

## Input

- **8-way quantisation** of the left stick uses 22.5° sectors after a 0.3
  radial deadzone. The d-pad overrides the stick.
- **Keyboard presses are latched until the next simulation sample**, so a tap
  shorter than a frame still registers.
- **A gamepad is assigned to the first free player slot when a button is
  pressed on it**, since browsers only expose pads after a press. Unplugging
  the active pad mid-game pauses the game with a message.
- **Menus: Esc / B always go back and never activate the highlighted item.**
  Enter, Space, attack, jump, A and Start confirm. The cursor stays where it
  was when you return from the Controls screen.

## Testing

- **The headless playthrough test and the in-browser Playwright run use the
  same bot.** The bot only produces `InputState`, like a controller. In the
  browser run a virtual standard-mapping gamepad is injected through
  `navigator.getGamepads`, the bot's decisions are written to its buttons
  and stick every simulation step, and the game reads them through its normal
  gamepad code.

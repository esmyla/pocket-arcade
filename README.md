# Pocket Arcade

A local-first assortment of small games for flights and spare moments. Working name and visual direction.

## Play and develop

`npm run dev` builds the collection and serves it at http://127.0.0.1:5175.
`npm run build` rebuilds `dist/`; `npm run preview` serves the existing build.
`npm run deploy` builds and force-pushes `dist/` to the `gh-pages` branch, which GitHub Pages serves at
https://esmyla.github.io/pocket-arcade/ (a minute or so after the push).
`npm test` checks 100 packing puzzles, 200 solvable sliding puzzles, rotation/placement rules, snake collisions, and that
the first 80 Sum Run levels are deterministic and beaten by a solver-driven bot through the real simulation.

No dependencies for the arcade itself: HTML, CSS, JavaScript, Canvas, browser storage and a service worker.
The build uses the sibling CrackRunner project's installed Vite/TypeScript dependencies and builds that app
before copying its output into the suite. Source of truth for that game remains `../CrackRunner/`.
After editing, rebuild and reload; there is no hot reload in this initial arcade server.

## Games

- **Sum Run:** you're a number running down a track. Eat numbers smaller than you (they add to you), dodge red
  ones that are bigger, and outgrow the boss at the finish. Drag or ←/→ to steer. Levels are generated from the
  level number (`app/games/sum-core.js`), so level N is always the same track. Every level is solved by a lane DP
  that proves it can be won; the boss is tuned against a greedy player, so early levels reward simple greed and
  later ones need planning. Mechanics unlock as you go: saws (4), door rows (5), math gates (7), walls (11),
  jump pads (15), moving numbers (20). Six themed worlds of ten levels, then endless encore worlds.
  Stars (1–3) pay coins for three permanent upgrades (Big Appetite, Snack Magnet, Thick Skin) and eight skins.
  Progress saves locally under `pocket:sumSave`. Add `?bot` to the page URL for an autopilot run, `?debug` to
  expose `window.sumDebug()`.
- **Crack Runner:** existing endless runner embedded in a removable frame. New open-track HUD with a small
  corner score, a tiny Grandma companion at the bottom, and no header taking away track space.
- **Bag Check:** generated 6×5 polyomino suitcase puzzles. Tap to select/place/remove; rotate, unpack, or request
  an outline of the selected item's original solution position. All generated puzzles have an original solution.
  Current suitcase and completed trip number save locally.
- **One More Floor:** one-button tower stacking. Overhangs fall away, perfect placements earn a streak, and
  each third perfect restores some width. Speed grows gradually; a missed placement ends the round.
  Personal best saves locally. Space or the Place button operates the game.

- **Snack Snake:** a 12×12 snake game with arrows/WASD, swipe and on-screen direction buttons. Snacks grow
  the snake and gradually increase speed. Edge/body collisions end the round; personal best saves locally.
- **Match Break:** a shuffled 16-card memory game. Find eight pairs; best is the lowest turn count.
  Mismatches turn back after a short delay that stops during pause.
- **Slide Fifteen:** a 4×4 sliding puzzle shuffled only through legal moves, so every board is solvable.
  Tap or use arrows, undo moves, or start another puzzle. Board and move count save on every move.
- **Pop Garden:** 30 active seconds of catching flowers and avoiding bees. Every fifth consecutive flower
  gives bonus points. The timer, spawn rate and flower lifetimes stop while paused; best saves locally.

Each game has pause/resume, automatic pause when hidden, a shared sound preference and an arcade return.
Crack Runner keeps its own pause controls, and the suite forwards its shared sound preference to it.

## Offline

A successful service-worker install caches the entire collection, including the embedded runner, in one batch.
“Ready offline” appears after activation. All shipped runtime assets are local; no remote fonts or accounts.
The first visit needs a connection. A manifest supports standalone installation where the browser offers it.
Use localhost for local development or HTTPS for deployment. Keep the same origin to retain browser saves.
Browser storage can be cleared/evicted; an airplane-mode test on actual target devices is still needed.

The service worker normalizes folder navigation to its cached index.html, including /games/crack/.
Builds create a new cache version and replace older Pocket Arcade caches. Reload after a new build installs.

## Next additions

Kick the AI is an existing separate project, not integrated in this prototype. No sibling code was changed.
Next work: tune both new games after human playtests, turn packing tiles into recognizable luggage items,
bring in Kick the AI as a fourth game, and test installation/offline persistence on real iPhone and Android devices.

No accounts, ads, purchases, network scoreboards, timers that punish absence, or daily streaks.

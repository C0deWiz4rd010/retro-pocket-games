# 16 – Verbesserungsplan: Mobile-First Maximierung & Politur aller 85 Spiele

Stand: 2026-07-31. Ziel: Retro Pocket von „technisch sehr weit + viele Spiele" zu einem
fokussierten, mobil-erstklassigen Pocket-Arcade-Produkt heben. Umfasst Plattform/Produkt-Flow,
Mobile-First UX & Performance, Engine/Architektur-Refactor, Content-Qualität (Rewards/Mastery/
Daily/Achievements/i18n) sowie detaillierte Gameplay-Politur pro Spiel.

Umsetzung in Phasen; pro Feature Commit + Push auf `develop`; Release (`develop → main` → GitHub
Pages) erst am Ende.

## Ist-Stand (verifiziert)

- 85 Spiele, `src/games/<id>/index.ts` (+ teils `core.ts` für pure Logik/Tests). 12 Concept-Games
  liegen in `_shared/conceptArcade.ts`.
- Feste virtuelle Auflösung pro Spiel (360×600/640 portrait, 640×360/400 landscape) via
  `PixiManager.setVirtual`; Letterbox-Scale erzeugt Ränder statt echtem Fullscreen-Fit. Der
  optionale per-game `resize()` wird nicht genutzt.
- Nur 9 handgeschriebene Klassiker haben potenziell reiche Metadaten; alle 76 `mk()`-Spiele haben
  **keine** `reward`/`masteryGoals`/`dailyRules`/`polish`.
- Mobile-Basis vorhanden: 48px Targets, Safe-Area-Vars, 100dvh, `controlProfiles`, Haptics,
  Bottom-Tabs, Console/Launcher-Skins.
- Grundlage: `docs/11-product-audit.md` (Home-Flow, Cartridge-Mastery, Reward-Rebalance,
  Cartridge-Boot, Run-Summary, Daily-Rules pro Spiel).

## Phasen

### Phase 0 — Baseline & Audit
- Build + `tsc` + `vitest` + `eslint` grün bestätigen; Smoke `scripts/smoke.mjs`.
- Quality-Tag pro Spiel (`polish.release`: classic/new/featured + interne Note polished/solid/
  needs-pass/prototype).

### Phase 1 — Mobile-First Engine-Foundation (Fundament, blockiert Per-Game-Politur)
1. Responsive Canvas: optionaler `fit`-Modus; `PixiManager` erlaubt fluide virtuelle Höhe im
   Portrait → weniger Letterbox-Ränder. Per-game `resize()` aktivieren und in %-Layout-Spielen
   nutzen.
2. Touch-Controls-Overhaul: Controls verdecken das Spielfeld nicht (reservierte Zone bzw.
   transparente Zonen); Größe/Position (links/rechts/compact)/Opazität live aus Settings; Tap/
   Drag-Zonen visuell andeuten; `pointermove`-Latenz < 50 ms.
3. Landscape-Handling: `orientation:landscape`-Spiele (asteroids, tron, …) responsives
   Landscape-Layout + klare Rotate-Prompt.
4. Performance: PerfMonitor-getriebenes FX-Downgrade, Partikel-Caps, ScreenFX Auto-Off unter Last;
   60 fps auf Mid-Range verifizieren.
5. Safe-Area/HUD: alle HUD/Controls/Overlays innerhalb `--safe-*`; Test 390×844, 430×932, Notch,
   Android-Gesture-Bar.

### Phase 2 — Plattform / Produkt-Flow
1. Home-Flow neu ordnen (`App.renderHome`): Header (Profil/Level/Chips/Install) → Daily + Continue
   → Shelves (Recent/Favorites/Recommended) → Collections → Library; Mobile Bottom-Tabs schärfen.
2. Cartridge-Boot: optionale `renderGameStart(meta)` vor GameHost (Ziel, Controls, Best, Mission,
   Play/Practice/Favorite); Continue/Retry überspringt.
3. Run-Summary (Game Over): Score + Best-Delta, XP-Breakdown (Base/Skill/Improvement/Daily/
   Mastery), Token-Gain prominent, „Next best action", Share-Card-Vorschau.
4. Cartridge-Mastery: Bronze/Silver/Gold + 3 Missionen auf Card, Boot und Summary.
5. Pause verbessern: Mobile Bottom-Sheet, Quick-Toggles (SFX/Music/Haptics/CRT/Left-Hand),
   Controls sichtbar.
6. Navigation entschlacken: Hauptbereiche + Collections statt aller 85 Titel.

### Phase 3 — Content-Systeme (skaliert über alle 85)
1. `reward` (RewardProfile) für alle Spiele → normalisierte XP statt Rohscore; Reward-Formel in
   RewardService.
2. `masteryGoals` (min 3) + `dailyRules` je Spiel.
3. Achievements: min 3/Spiel (First/Skill/Style) + Meta-Badges; Progress-Bars.
4. i18n-Vollständigkeit: fehlende Keys en/de, neue Produkt-Strings, per-game Blurbs/Tips.

### Phase 4 — Engine/Architektur-Refactor
1. `GameHost` in Services splitten: `RunSession`, `HudController`, `OverlayController`,
   `RewardService`, `LeaderboardService`, `GameChrome`.
2. `_shared` ausbauen: gemeinsame `juice`/burst/backdrop/HUD-Helfer real nutzen;
   `conceptArcade.ts` (12 Spiele) in Einzelmodule aufsplitten.
3. Registry-Kommentare/Zähler auf 85 aktualisieren; UTF-8 der Docs prüfen.

### Phase 5 — Per-Game Gameplay-Politur (Wellen nach Genre)

Universelle Quality-Bar je Spiel: (a) sauberer Start/End-Zustand, (b) gezieltes Juice-Feedback
(burst/shake/floating text) nur bei bedeutsamen Events, (c) Schwierigkeits-Rampe/Progression,
(d) 3 Mechanik-Features, (e) passende Mobile-Controls (korrektes Profil, keine Verdeckung),
(f) `reward`+`mastery`+`daily` gesetzt, (g) min 3 Achievements, (h) `tsc`+`eslint`+`vitest` grün,
(i) 60 fps.

- Welle A Klassiker-Kern (9): snake, tetris, pong, breakout, invaders, flappy, g2048, minesweeper,
  asteroids
- Welle B Klassiker-mk (11): pacman, frogger, galaga, centipede, missile, bomberman, qbert, doodle,
  simon, lander, tron
- Welle C Concept-Arcade (12): pixeldash, neonrider, blockcollapse, spaceblaster, jumpquest,
  retrosnake, dotcollector, memorymatch, brickbreaker, turbodrift, colorswitch, galacticinvaders
- Welle D Brain/Logic (9): memory, lightsout, sliding, sokoban, mastermind, flood, connectfour,
  tictactoe, reversi
- Welle E Puzzle (2): match3, columns
- Welle F Skill/Action (9): dodger, helicopter, runner, whackamole, stacker, pinball, maze, reflex,
  tunnel
- Welle G Vol III–VI Minis (20): battleship, sudoku, checkers, bubble, blackjack, hangman, yahtzee,
  rps, targettap, chainreaction, quickmath, higherlower, colorclash, orbit, lockpick, numberhunt,
  wordmix, pulsecatch, memorypath, hotcold
- Welle H Neon Vol VII (10): neonrush, crystalvault, lasermaze, starforge, driftracer, runereactor,
  cometsweep, prismdash, gearlock, echorunner
- Welle I Originals Vol VIII (3): polara, dualoop, cometputt

### Phase 6 — Verification & Release
- `tsc` + `vitest` + `eslint` + `build` grün; Smoke aller Kit-Typen; Visual-QA (390×844, 430×932,
  768×1024, Landscape); PWA offline/install/update; A11y (Focus-Trap, Reduced-Motion, Colorblind,
  Targets).
- `develop → main` → GitHub Pages (`.github/workflows/deploy.yml`).

## Verification pro Batch

```
npx tsc --noEmit && npx vitest run && npx eslint <geänderte dirs> && npm run build
node scripts/smoke.mjs   # nach Engine/Host-Änderungen
```

## Git-Workflow
- Arbeit auf `develop`, ein Commit + Push je Schritt/Feature (`git push origin develop`).
- Release am Ende: `develop → main` (triggert Deploy-Workflow → GitHub Pages).

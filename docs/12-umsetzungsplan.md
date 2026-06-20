# Umsetzungsplan – neuerVorgang.md (Punkte 9–35)

Konkreter Implementierungsplan für jeden Punkt aus `docs/neuerVorgang.md`. Aufwand-Tags:
**[QW] Quick Win** (≤2 h) · **[ME] Medium Effort** (½–2 Tage) · **[BF] Big Feature** (mehrere Tage).

Branch-Workflow: jedes Feature → eigener Commit auf `develop` → push. Finaler Release = `develop` → `main` merge (triggert `deploy.yml` → GitHub Pages).

Konventionen im Code (bereits etabliert): Spiele = `src/games/<id>/index.ts` (View/Controller) + reines `core.ts` (vitest); Host = `src/app/{App,GameHost}.ts`; Stores = `src/store/*`; Styles = `src/styles/components.css`; Registry/Metadaten = `src/core/Registry.ts`.

---

## 9. Pause-Menü [ME]
**Datei:** `src/app/GameHost.ts` (Overlay-DOM), `src/styles/components.css`, neue `src/ui/PauseMenu.ts`.
- Trigger: `Escape`/`P` (Desktop), `pause`-Action, Header-Button (Mobile). `InputManager` emittiert bereits `pause`.
- Layout (vertikale Karten-Liste, zentriert, abgedunkelter Backdrop): **Resume · Restart · Controls · Sound on/off · Haptics on/off · Accessibility · Spielregeln · Quit to Hub**.
- Verhalten: Spiel-Loop pausieren (`GameHost` setzt `running=false`), `requestAnimationFrame` stoppen; bei Resume Countdown 3-2-1.
- Sound/Haptics-Toggles persistiert in `settings`-Store (siehe #14/#27). Controls/Spielregeln aus `GameMeta.controls.hints` + `blurb`/`tutorialSteps`.
- **Schritte:** (1) `settings`-Store anlegen, (2) PauseMenu-Komponente, (3) GameHost-Pause-Hook, (4) CSS, (5) Test: Pause stoppt `update()`.

## 10. Touch-Steuerung & Mobile Feel [BF]
**Datei:** `src/core/InputManager.ts`, neue `src/ui/TouchControls.ts`, `src/core/controlProfiles.ts`.
- Pro `ControlProfile` passende Overlay-Steuerung rendern: **swipe** (Snake/2048), **tap-zones** (Flappy/Simon), **virtual D-Pad + A/B** (Pacman/Invaders), **virtual joystick** (Asteroids/Lander), **drag** (Breakout/Pong).
- Große Touch-Ziele ≥ 48px, Daumen-Zonen unten-links/rechts, Safe-Area via `env(safe-area-inset-*)`.
- Haptic Feedback `navigator.vibrate()` (gated über settings, #14/#27). Input-Latenz: `pointerdown` statt `click`, `touch-action: none`.
- Fullscreen-Button (`requestFullscreen`), Orientation-Hinweis bei Mismatch (`GameMeta.orientation`). One-Hand-Modus = D-Pad+A/B beide unten.
- **Mapping je Spiel** ergänzt die bestehende `controlsForGame()`-Logik. **Quick-Win-Teilstücke [QW]:** `touch-action:none`, Safe-Areas, Fullscreen-Button.

## 11. Desktop-Steuerung & Rebinding [ME]
**Datei:** `src/core/InputManager.ts` (hat `configure({keyMap})`), neue `src/ui/KeyBindings.ts`, `settings`-Store.
- Einheitliche Default-Map (Tabelle unten), Rebinding-UI in Settings, persistiert in `settings.keyMap`.
- Gamepad bereits via `pollGamepad()`. Mouse: Pointer-Events vorhanden.

| Aktion | Primär | Alt | Gamepad |
|---|---|---|---|
| up/down/left/right | Pfeile | WASD | D-Pad/Stick |
| a (Aktion/Sprung/Feuer) | Space/Z | J | A (0) |
| b (Sekundär) | X | K | B (1) |
| start (Hold/Confirm) | Enter | — | Start (9) |
| select (Mode/Hint) | Shift | — | Select (8) |
| pause | Escape/P | — | — |

## 12. Visuelles Design-System [ME] – *teilweise vorhanden in `components.css`*
**Datei:** `src/styles/tokens.css` (neu, CSS-Variablen) + `components.css`.
- Tokens (konkret): `--bg-0:#05060f; --bg-1:#0a0a18; --surface:#14141f; --surface-2:#1d1d2b;`
  Neon: `--neon-cyan:#00f7ff; --neon-pink:#ff2e97; --neon-green:#3ddc84; --neon-yellow:#ffd200; --neon-purple:#c084fc; --neon-orange:#ff7b00;`
  `--glow: 0 0 12px var(--accent); --radius:12px; --radius-sm:6px; --border:1px solid rgba(255,255,255,.08);`
  Schrift: `--font-ui:'Inter',sans-serif; --font-mono:'VT323',monospace;` Schatten: `--shadow-1`, `--shadow-2`.
- Komponenten-Klassen: `.btn`, `.btn--neon`, `.card`, `.tile`, `.hud`, `.dialog`, `.badge`, `.xp-bar`, `.token`, `.toast--achievement`, `.leaderboard`, `.pixel-frame`.
- Accessibility: `@media (prefers-reduced-motion)` → Animationen aus; `body.high-contrast` Variante.

## 13. Animationen & Arcade-Feedback [ME]
**Datei:** neue `src/ui/feedback.ts` (zentrale FX-Funktionen) + `motion` (bereits Dependency).
- Mapping Ereignis → FX (konkret): Button Press = scale 0.94 + tick-sound; Game Start = wipe-in + "READY?"; Game Over = shake + desaturate + "GAME OVER"; Level Up = burst + "LEVEL n"; Achievement = slide-in Toast + shine; Token = fly-to-counter; Highscore = gold confetti + "NEW BEST!"; Combo = scale-pop "xN"; Perfect = rainbow flash; Damage = red vignette + shake; Collect = spark; Daily complete = stamp; Unlock = cabinet-door open.
- Bereits in Spielen: Partikel-`burst`, Screenshake, Toasts. Hier zentralisieren + `prefers-reduced-motion` respektieren.

## 14. Sounddesign [ME]
**Datei:** `src/core/AudioManager.ts` (vorhanden, `sfx(name)`), neue `settings`-Felder.
- Lightweight: WebAudio-synthetisierte Sounds (keine Assets) ODER kleine `.ogg` (<5 KB) lazy-loaded. Gruppen: `ui`, `game`, `music`.
- Konkrete SFX: ui-tick, start-rise, gameover-fall, collect-coin, damage-thud, combo-arp, achievement-fanfare, levelup-chime. Optional Background-Loop pro Kategorie (sehr leise).
- Mute-Toggle + Master/SFX/Music-Lautstärke in Settings, persistiert; `prefers-reduced` ↔ default leise.

## 15. Progression-System [BF] – *Stores teils vorhanden (`profile.ts`, `achievements.ts`)*
**Datei:** `src/store/profile.ts`, neue `src/store/progression.ts`.
- Spielerlevel via XP-Kurve: `xpForLevel(n) = round(80 * n^1.45)` (L2≈220, L5≈900, L10≈2700, L20≈8200).
- XP-Quelle: Score→XP `floor(score/10)` (cap pro Run), +Daily/Achievement-Boni. Token-Ökonomie: `tokens += floor(score/200) + dailyBonus`; Ausgaben nur kosmetisch.
- Daily Rewards (7-Tage-Loop, eskalierend), Streaks (siehe #17), Mastery pro Spiel (Bronze/Silber/Gold = bestehende `masteryGoals`), Profil-Titel/Themes/Avatare/Badges als kosmetische Unlocks (Token-Kosten-Tabelle). **Kein Pay-to-Win.**

## 16. Achievement-System [ME] – *`achievements.ts` vorhanden*
**Datei:** `src/store/achievements.ts` (Definitionen + Unlock-Trigger), Toast via #13.
- Kategorien + 30 Achievements (Auszug, vollständige Liste im Store): Skill ("Tetris 4-Line", "Pacman ohne Tod-Welle"), Collection ("10 Spiele gespielt"), Daily ("3 Tage Streak"), Streak ("7-Tage"), Hidden ("Konami"), Mastery ("Gold in 5 Spielen"), Fun ("Snake beißt sich nach 1s"). Felder: `id,name,desc,condition(stats),reward{xp,tokens},rarity,gameId?`.
- Unlock-Check zentral nach jedem `gameOver` + Daily-Tick.

## 17. Daily Challenge [ME] – *`daily.ts` vorhanden*
**Datei:** `src/app/daily.ts` (Modifier-Logik vorhanden), neue Missions-Struktur.
- Tägliche (3) + wöchentliche (3) Missionen, Spezial-Events (Wochenende), Modifikatoren (`turbo/zen/sudden` existieren), Belohnungen (XP/Tokens), Streak-Bonus, Leaderboard- & Share-Card-Verknüpfung.
- 20 Beispiel-Challenges als Daten (z. B. "Erreiche 500 in Snake", "Clear 5 Tetris-Lines am Stück", "Überlebe Welle 3 in Invaders").

## 18. Lokale Leaderboards [ME] – *`leaderboardMath.ts` vorhanden*
**Datei:** `src/store/leaderboard.ts`.
- Boards: pro Spiel · pro Kategorie · daily · weekly · all-time · persönliche Bestleistung · **Ghost Score** ("Beat your yesterday") · lokales Rival-System · Score-Tier (Bronze→Diamond per Perzentil).
- UI: Tabs + Tier-Badge + "+X über gestern". Motivation ohne Online: Ghost/Rival/Tiers.

## 19. Share-Cards [ME]
**Datei:** neue `src/ui/ShareCard.ts` (Canvas→PNG), Web Share API.
- Layout: Neon-Rahmen, Spielname + Glyph, Score groß, Rank/Tier, Daily-Status, Achievement-Highlight, optional QR (klein, lazy lib). Export `canvas.toBlob()` → `navigator.share({files})` mit Fallback Download.
- Konkrete Texte: "🏆 Neuer Rekord in {game}: {score}!", "🔥 {n}-Tage-Streak gehalten", "💎 {tier} erreicht in {game}".

## 20. Profil-System [ME] – *`profile.ts` vorhanden*
**Datei:** neue `src/ui/ProfilePage.ts`.
- Wireframe: Header (Avatar · Titel · Level + XP-Bar · Tokens) → Stats-Grid (Lieblingsspiel, meistgespielt, höchste Kombo, Gesamtspielzeit, Daily-Streak, Mastered n/82) → Achievements-Gitter → Kosmetik-Anpassung.

## 21. Onboarding [ME]
**Datei:** neue `src/ui/Onboarding.ts`, gated über `settings.onboardingDone`.
- 5 Screens mit Text: (1) "Willkommen bei Retro Pocket – 82 Arcade-Klassiker in der Hosentasche", (2) "Tippe ein Cabinet, um zu spielen", (3) "Sammle XP & steige im Level auf", (4) "Tokens schalten Kosmetik frei – nie Pay-to-Win", (5) "Daily Challenge + Installieren als App". Skip-Button.

## 22. PWA-Qualität [ME] – *`vite-plugin-pwa` aktiv*
**Datei:** `vite.config.ts` (PWA-Manifest), `src/app/` Update-Hinweis.
- Install-Prompt (`beforeinstallprompt` einfangen), Offline (Workbox precache vorhanden prüfen), App-Icon/Splash/Theme-Color im Manifest, Update-Toast ("Neue Version – neu laden"), App-Version-Anzeige (`__APP_VERSION__` via define), Storage-Management + **Backup/Export & Import** (JSON aus `idb-keyval`).

## 23. Performance [ME] – *Code-Splitting pro Spiel vorhanden (lazy `loader`)*
**Prioritätenliste:** (1) Lazy-Loading je Spiel ✓ prüfen, (2) Bundle-Analyse (`rollup-plugin-visualizer`), (3) Pixi-Renderer wiederverwenden, (4) Sprite/Asset-Optim, (5) Audio-Preload nur on-demand, (6) `requestAnimationFrame`-dt-Clamp ✓, (7) Memory: `destroy({children:true})` ✓ in allen Spielen, (8) FPS-Monitor (Dev-Overlay), (9) Lighthouse-Ziel ≥ 90.

## 24. Code-Architektur [ME] – *großteils vorhanden*
- Vorhanden: Registry, GameMeta, InputManager, AudioManager, GameFX, `_shared/juice.ts`. **Ergänzen:** `AchievementManager`, `RewardManager`, `StorageManager`, `ChallengeManager`, `LeaderboardManager`, `ShareManager`, UI-Component-Lib (`src/ui/*`). Interfaces in `src/core/types.ts` erweitern.

## 25. Einheitliche Game-API [ME]
**Datei:** `src/core/types.ts` (hat `Game`/`GameContext`/`GameFactory`).
- `Game` erweitern um optional `pause()/resume()/restart()/getScore()/getState()`; Metadaten (id/name/category/difficulty/duration/controls/description/thumbnail/achievements/dailyChallengeSupport) bereits in `GameMeta`. Adapter, damit bestehende Factories kompatibel bleiben.

## 26. Teststrategie [ME] – *vitest vorhanden (34 Tests)*
- Konkrete Tests: Snake-Wrap ✓, Score/XP/Token-Berechnung, Achievement-Unlock-Bedingungen, Daily-Reset (Zeitzone), Leaderboard-Sort/Tier, Storage-Roundtrip (idb mock), Registry-Integrität (jedes `loader` lädt), Input-Mapping, GameOver-Dialog. Ziel: Core-Logik jedes neuen Managers getestet.

## 27. Accessibility [ME]
**Priorität:** (1) `prefers-reduced-motion`, (2) Pause bei `visibilitychange`/Fokusverlust, (3) große Touch-Ziele, (4) Tastaturbedienung komplett, (5) hoher Kontrast + farbenblind-Paletten, (6) kein reines Farbfeedback (Form/Icon zusätzlich), (7) lesbare Schriftgrößen, (8) ARIA/Screenreader-Texte für Menüs.

## 28. Monetarisierung (fair) [BF, später]
- Kosmetik-Shop (Token + optional Echtgeld), Premium "Supporter"-Badge, Spenden-Link, Sound/Avatar/Cabinet-Skin-Packs, freiwillige Reward-Ads. **Nie:** Pay-to-Win, Energy-Limits, bezahlte Highscores.

## 29. Einzelanalyse Minigames [BF] – *läuft bereits*
- Snake/Brick Breaker/Galactic Invaders u. a. bereits erweitert (siehe Memory). Übrige Neon-Originals (Pixel Dash, Neon Rider, Dot Collector, Block Collapse, Space Blaster, Jump Quest, Memory Match, Turbo Drift, Color Switch) = **Batch 5+** mit je 3 Feature-Ideen + 3 Sofortverbesserungen + 1 Erweiterung.

## 30. 20 neue Minigames [BF, später]
- Ideenliste als `docs/13-neue-games.md` (Name/Genre/Pitch/Steuerung/Score/Difficulty/Besonderheit). Umsetzung nach Kern-Polish.

## 31. Balancing [QW-Doku]
- Formeln aus #15 zentral in `src/store/balance.ts`: XP/Token-Formeln, Multiplier-Tabellen, Mastery-Schwellen (bereits `reward`/`masteryGoals` in Registry).

## 32. Retention [ME]
- Priorisiert: Daily Challenge (#17) → Streaks (#15) → "Beat your score"/Ghost (#18) → Weekly Cup → Mastery Road → saisonale Themes → Retro-Album (Sammlung).

## 33. Roadmap [QW-Doku]
- **Sofort (1–3 T):** Pause-Menü, Touch-Quick-Wins, Settings-Store, restliche Game-Polish-Batches. **Kurzfristig (1 Wo):** Design-Tokens, Feedback-System, Sound-Toggle, Daily-Missionen. **MVP-Polish (2–3 Wo):** Progression, Achievements, Leaderboards, Share-Cards, Profil, Onboarding, A11y. **Update (1–2 Mo):** PWA-Vollausbau, 20 neue Games. **Langfristig (3–6 Mo):** Monetarisierung, Events, Cabinets.

## 34. 7-Tage-Plan (Solo)
| Tag | Hauptziel | Betroffen | Ergebnis | Test | Prio |
|---|---|---|---|---|---|
| 1 | Pause-Menü + Settings-Store | GameHost, ui/PauseMenu, store/settings | Pausieren/Resume/Toggles | Pause stoppt update | Hoch |
| 2 | Touch-Controls je Profil | InputManager, ui/TouchControls | Mobile spielbar | Manuell + Safe-Area | Hoch |
| 3 | Design-Tokens + Feedback-System | styles/tokens, ui/feedback | Einheitliche FX | reduced-motion | Hoch |
| 4 | Sound-Toggle + SFX-Gruppen | AudioManager, settings | Mute/Lautstärke | Mute persistiert | Mittel |
| 5 | Progression (Level/XP/Tokens) | store/progression | Level steigt | XP-Kurven-Test | Hoch |
| 6 | Achievements + Toasts | store/achievements, ui/feedback | 30 Achievements | Unlock-Tests | Mittel |
| 7 | Leaderboards + Share-Card | store/leaderboard, ui/ShareCard | Boards + PNG-Share | Sort/Tier-Test | Mittel |

## 35. Ausgabeformat / Top-20-Prioritätenliste
1. **[QW]** Settings-Store (Basis für #9/#10/#11/#14/#27)
2. **[ME]** Pause-Menü (#9)
3. **[QW]** `touch-action:none` + Safe-Areas + Fullscreen (#10/#22)
4. **[ME]** Touch-Controls je Control-Profil (#10)
5. **[ME]** Design-Tokens `tokens.css` (#12)
6. **[ME]** Zentrales Feedback-/FX-System (#13)
7. **[QW]** `prefers-reduced-motion` global (#27)
8. **[QW]** Pause bei Fokusverlust (#27)
9. **[ME]** Sound-Toggle + Lautstärke + Gruppen (#14)
10. **[ME]** Desktop-Rebinding-UI (#11)
11. **[BF]** Progression: Level/XP-Kurve/Token-Ökonomie (#15)
12. **[ME]** Achievement-System + 30 Achievements (#16)
13. **[ME]** Daily-/Weekly-Missionen (#17)
14. **[ME]** Leaderboards (Ghost/Rival/Tiers) (#18)
15. **[ME]** Share-Cards (PNG + Web Share) (#19)
16. **[ME]** Profilseite (#20)
17. **[ME]** Onboarding (5 Screens) (#21)
18. **[ME]** PWA: Install-Prompt, Update-Toast, Export/Import (#22)
19. **[BF]** Restliche ~57 Spiele-Polish-Batches (#29)
20. **[BF]** 20 neue Minigames (#30)

---
*Annahmen:* Solo-Dev, lokal-first (kein Online-Backend), bestehende Stack (Vite + Pixi + TS + idb-keyval + motion). Reihenfolge der Umsetzung folgt der Top-20-Liste; jedes Feature wird einzeln auf `develop` gepusht.

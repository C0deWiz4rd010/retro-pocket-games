# 11 - Product Audit: Retro Pocket auf Indie-Mobile-PWA-Level

Stand: 2026-06-15. Grundlage: Codebasis, Registry, Launcher, GameHost, Store-Module, PWA-Konfiguration, Tests und Build.

## Kurzurteil

Retro Pocket hat bereits den Kern eines echten Produkts: eine installierbare, lokale Pocket-Arcade mit 74 Spielen, eigenem Launcher, Daily Challenge, Profil, XP, Tokens, Achievements, Leaderboards, Share-Cards, Touch-Steuerung, PWA-Installationslogik und zentralem GameHost. Die starke Idee ist nicht "viele Minispiele", sondern "eine kleine eigene Arcade-Konsole, die im Browser wohnt".

Der groesste naechste Schritt ist Kuratierung. Aktuell konkurrieren 74 Spiele, Meta-Systeme und Navigationseintraege um Aufmerksamkeit. Das Projekt wirkt technisch erstaunlich weit, aber noch nicht wie ein fokussiertes Mobile-Game-Produkt, weil Einstieg, Spielauswahl, Belohnung, Fortschritt und Rueckkehrgruende noch zu wenig als zusammenhaengende Spielerreise choreografiert sind.

## 1. Gesamtanalyse

### Staerkste Idee

Eine offline-faehige "Pocket Console" mit vielen kurzen Arcade-Ritualen, lokalem Fortschritt und null Account-Zwang. Das ist staerker als jede einzelne Spielidee, weil es ein Versprechen ist: Antippen, spielen, Fortschritt spueren, spaeter wiederkommen.

### Was bereits gut ist

- Der Launcher ist schon mehr als ein Grid: Daily-Hero, 7-Tage-Streak, Stats, Continue, Favoriten, Suche, Filter und Library existieren in `src/app/App.ts`.
- Der zentrale `GameHost` kapselt HUD, Touch Controls, Pause, Game Over, Score-Speicherung, Daily-Modifier, Achievements, Leaderboards, Share-Cards, Haptics und Wake Lock.
- Die Registry in `src/core/Registry.ts` hat Metadaten pro Spiel: Gruppe, Orientierung, Accent, Glyph, Tags, Default-HUD, Tutorial-Steps und Lazy Loader.
- Input ist sauber normalisiert: Keyboard, Touch, Swipe, Tap, Pointer, Gamepad ueber `InputManager` und `controlProfiles`.
- PWA-Basis ist solide: Manifest, Shortcuts, Workbox, Offline-Ready-Toast, Install-Banner, Wake Lock.
- Tests und Build sind aktuell gruen: 34 Vitest-Tests und Production-Build erfolgreich.

### Wo es noch unfertig wirkt

- Die Sidenav listet neben den Hauptzielen alle Spiele. Bei 74 Titeln wird Navigation zum Katalog und verliert Orientierung.
- Game Cards sind visuell konsistent, aber zu generisch. Viele Karten zeigen Cover-Motive statt einer klaren "Cartridge"-Identitaet.
- Spielstart ist sehr direkt. Es fehlt eine kurze "Cartridge Boot"-Zwischenstufe mit Ziel, Controls, Best Score, heutiger Mission und Start.
- Game Over zeigt Score, XP und Aktionen, erklaert aber noch zu wenig, warum der Run gut war und was als naechstes reizvoll ist.
- XP und Token basieren aktuell linear auf Score. Unterschiedliche Score-Skalen machen Balancing unfair.
- Daily Modifier sind generisch ueber `timeScale` und `scoreMult`. Das ist elegant, kann aber manche Genres unfair oder komisch machen.
- Viele Achievements decken Klassiker ab; die neuen stark ausgebauten Spiele brauchen eigene Mastery-Ziele.
- Tests decken Kernlogik einzelner Systeme ab, aber noch nicht Launcher-Flows, GameHost-FSM, PWA-Install-UX, A11y und Smoke fuer repraesentative Spiele.

### Was fuer ein echtes Mobile-Game-Produkt fehlt

- Eine klare First-Session: "Installieren spaeter", "Daily spielen", "Lieblingsspiel merken", "erstes Badge", "naechster Run".
- Eine Mastery-Schicht pro Spiel: Bronze/Silver/Gold, persoenliche Missionen, Spiel-spezifische Statistiken.
- Normalisierte Belohnungen: XP nach Session-Laenge, Schwierigkeit, Verbesserung und Tagesbonus statt Rohscore.
- Eine bessere Katalog-IA: Home entscheidet, Sidenav navigiert, Suche findet, Collections kuratieren.
- Qualitaetsampeln pro Spiel: polished, solid, needs pass, prototype.
- Visuelle Identitaet pro Spiel: Cartridge-Farbe, Mini-Key-Art, Controls, Session-Laenge, Best-Metric, Skill-Typ.

### Wie Retro Pocket einzigartiger wird

Positioniere es als "lokale Pocket-Konsole", nicht als Spielesammlung. Jedes Spiel ist eine Cartridge, der Launcher ist das Regal, Daily ist die "heutige Cartridge", Profile ist die Player Card, Achievements sind Badges, Leaderboards sind Hall of Scores. Der Respekt vor dem Spieler ist Teil der Marke: offline, local-first, kein Login, kein Pay-to-Win.

### Die 3 Features mit groesstem Impact

1. **Cartridge Mastery**: Jede Game Card zeigt Mastery-Rang, 3 Missionen, Best-Metric und einen "naechster sinnvoller Versuch"-CTA.
2. **Neuer Home-Flow**: Daily + Continue + Recommended vor Library; Sidenav auf Hauptbereiche reduzieren; Mobile Bottom Tabs.
3. **Reward Rebalance**: XP/Tokens normalisieren und Belohnungen sichtbar erklaeren: Base, Skill, Improvement, Daily, Mastery.

## 2. Produktidentitaet und Vision

### Besserer Elevator Pitch

Retro Pocket ist deine installierbare Mini-Arcade: 74 schnelle Retro-Spiele, offline spielbar, mit Daily Challenges, lokalen Highscores und einer kleinen Fortschrittswelt, die sich anfuehlt wie eine eigene Handheld-Konsole im Browser.

### Zielgruppe

- Mobile Kurzspieler: 30 Sekunden bis 3 Minuten, Bahn, Sofa, Pause.
- Retro-Fans: Klassiker mit modernem Feedback, ohne Emulator-Overhead.
- Completionists: Badges, Streaks, Mastery, lokale Rekorde.
- Web-/PWA-Fans: technische Qualitaet, Offline, keine Stores.

### Emotionale Kernidee

"Ich habe eine kleine Arcade in der Tasche, die mir jeden Tag einen kurzen, befriedigenden Run gibt."

### Visuelle Markenrichtung

Neon-Pixel, aber nicht Dauer-Cyberpunk. Verwende mehrere "Cabinet Families": Neon City fuer Action, CRT Amber fuer Klassiker, Candy Cabinet fuer Puzzle, Blueprint Grid fuer Brain, Vapor Track fuer Racing. Das reduziert Einfarbigkeit und macht Spielgruppen erkennbar.

### Tonalitaet

Kurz, spielerisch, arcade-authentisch, nie werblich. Gute UI-Texte: "Insert Run", "Beat your Best", "New Badge", "Continue Cartridge", "Pocket saved". Schlechte UI-Texte: lange Feature-Erklaerungen.

### Slogans

- "74 games. One pocket."
- "Your browser just became an arcade."
- "Tiny runs. Big score energy."
- "Install once. Play anywhere."
- "A whole arcade, no queue."

### Systemnamen

- XP: **Arcade Energy** oder **Pixel XP**. Empfehlung: Pixel XP, weil direkt verstaendlich.
- Level: **Neon Rank**.
- Tokens: **Pocket Chips**.
- Achievements: **Badges** oder **Cabinet Badges**.
- Daily Challenge: **Daily Cartridge**.
- Leaderboards: **Hall of Scores**.
- Profile: **Player Card**.
- Favorites: **Pocket Shelf**.
- Recently Played: **Continue Queue**.
- Share Cards: **Score Prints**.
- Streak: **Hot Streak**.
- Game Collections: **Cabinets**.

## 3. Launcher-Hub: konkrete Zielstruktur

### Aktueller Zustand

Der Hub in `App.renderHome()` ist bereits stark, aber die Reihenfolge sollte spielerischer werden. Aktuell: Daily, Daily-History, Stats, Continue, Favorites, Library, Suche, Filter, Welcome. Besser: Profile/Install sichtbar im Header, Daily und Continue als Primaerentscheidung, dann Kuratierung, dann Library.

### Neue Hierarchie

1. Header: Profil kompakt, Levelbar, Pocket Chips, Install/Offline-Status, Settings.
2. Primary Action Zone: Daily Cartridge links, Continue/Quick Play rechts.
3. Player Shelves: Recently Played, Favorites, Recommended.
4. Collections: Quick Runs, Skill, Puzzle, Brain, Shooter, Classics, New Neon.
5. Full Library: Suche, Filter, Sortierung, alle Spiele.

### Text-Wireframe Desktop

```text
[Left Rail]
Home | Daily | Pocket Shelf | Badges | Hall of Scores | Player Card | Settings
Collections: Quick Runs, Classics, Neon Originals, Puzzle, Brain, Action

[Top Bar]
RETRO POCKET             Lv 12 [Pixel XP bar]  320 Pocket Chips  Install/Offline  Settings

[Hero Grid]
[Daily Cartridge]
Game art, modifier, streak, reward, Play Today

[Continue Cartridge]
Last game, best, last run, Continue / Retry

[Surprise Me]
One-tap random, filtered by preferred genres

[Shelves]
Continue Queue: 8 horizontal cards
Pocket Shelf: favorites
Recommended For You: based on last played group, missing badges, daily gaps

[Collections]
Quick Runs | Skill Tests | Brain Cabinet | Puzzle Cabinet | Shooter Bay | Classics

[Full Library]
Search by name, tag, control, session length
Filter chips + sort: Recommended, Recently Played, New, Mastery, A-Z
Game grid
```

### Text-Wireframe Mobile

```text
[Top]
RETRO POCKET       Lv 12   Chips   Settings

[Daily Cartridge]
Full-width, one clear CTA

[Continue / Quick Play]
Two compact cards: Continue last, Surprise me

[Shelves]
Recently Played horizontal
Favorites horizontal
Recommended horizontal

[Library]
Sticky search
Filter chips
2-column cards

[Bottom Tabs]
Home | Daily | Shelf | Scores | Profile
```

### Konkrete Hub-Verbesserungen

- Daily Hero: Zeige Reward vor Start: "+40 Pixel XP, +3 Pocket Chips, Badge progress". Nach Abschluss: "Done", Score, Rang, Countdown.
- Continue: Verwende nicht nur `lastPlayed`, sondern zeige "last run score", "best", "improvement needed".
- Recommended: Algorithmus v1: ungespielte Favoriten-Gruppe, Spiele mit fast fertigem Badge, Daily-aehnliche Spiele, niedrige Mastery.
- Favoriten: Als "Pocket Shelf" direkt unter Continue, aber nur wenn belegt. Erste Session: Button "Add your first favorite" nach erstem Game Over.
- Game-Kategorien: Nicht nur Registry-Gruppen, sondern spielerische Collections: Quick Runs, One Thumb, Brain Burners, Score Chasers, Chill Puzzle, Classics, Neon Originals.
- Suche: Aktuell nur Titel. Erweitern auf `title`, `blurb`, `tags`, `group`, `kit`, `controls.hints`, Difficulty und Session-Length.
- Filter: Mehrfachfilter statt Single-Group: Genre, Control, Orientation, Difficulty, Played/Unplayed, Has Badge, Favorite.
- Game Cards: Mastery-Ring, Control-Glyph, Session-Length, Best-Metric, "New", "Daily eligible", "1 badge near".

## 4. Sidenav: bessere Navigation

### Problem

Die Sidenav dupliziert alle 74 Spiele. Das ist als Katalog nuetzlich, aber als Navigation zu laut. Auf Desktop nimmt sie viel kognitive Last weg, auf Mobile wird sie zu einer langen Liste.

### Desktop-Struktur

```text
RETRO POCKET / Player mini-card

Primary
- Home
- Daily Cartridge
- Continue
- Pocket Shelf

Progress
- Player Card
- Badges
- Hall of Scores

Cabinets
- Quick Runs
- Classics
- Neon Originals
- Puzzle
- Brain
- Action

System
- Settings
- About
```

Icons: Home, Calendar/Star fuer Daily, PlayCircle fuer Continue, Bookmark/Star fuer Shelf, User fuer Player, Trophy fuer Badges, BarChart fuer Scores, Grid fuer Cabinets, Settings, Info.

Aktiver Zustand: kein simples Border-Left bei Launcher-Skin, sondern leuchtender "selected cartridge slot": dezenter Hintergrund, Accent-Bar, kleines Pixellicht, Icon in Primary-Farbe. Zeige bei Daily einen Done/Hot-Streak-Indikator.

### Mobile-Struktur

Bottom Navigation statt permanente Sidenav:

```text
Home | Daily | Shelf | Scores | Profile
```

Settings, Achievements und About liegen in Profile oder einem More-Sheet. Die Drawer-Sidenav bleibt als "All Cabinets" erreichbar, aber nicht als Standard-Navigation. Spiele werden mobil ueber Home, Suche, Collections und Shelf gestartet.

### Wann Sidenav, wann Bottom Tabs

- Desktop/Tablet ab 900px: Rail, aber nur fuer Hauptbereiche und Collections.
- Mobile: Bottom Tabs fuer Top-Level-Ziele; Drawer nur fuer seltene Ziele und komplette Collection-Liste.
- Console-Skin: Drawer passt, weil es sich wie ein Device-Menue anfuehlt.
- Launcher-Skin: Rail auf Desktop, Bottom Tabs auf Mobile.

## 5. Spielstart-Flow

Aktuell startet `#/play/:id` direkt. Fuer ein Produktgefuehl sollte ein optionaler Preflight eingefuehrt werden:

```text
[Cartridge Boot]
Title + animated cover
Today's mission / next badge
Best score + local rank
Controls: D-pad/A/B or Tap/Swipe
Estimated session: 1-3 min
[Play] [Practice] [Favorite]
```

Implementierung: `GameHost.start()` nicht veraendern, sondern vor `new GameHost(...)` eine `renderGameStart(meta)`-View einfuehren. Quick-start aus Continue und Retry darf weiter direkt starten.

## 6. Game Over und Pause

Game Over sollte vom Score-Screen zum "Run Summary" werden:

- Score und Best Delta.
- XP Breakdown: Base, Score, Improvement, Daily, Badge.
- Token Gain sichtbar. Aktuell wird `tokenGain` berechnet, aber im Game-Over-Panel nicht prominent gezeigt.
- "Next best action": Retry fuer Beat Best, Next Daily, Similar Game, Badge almost done.
- Share Card Vorschau statt nur Button.

Pause:

- Mobile als Bottom Sheet, Desktop als Center Dialog.
- Zeige Controls direkt im Pause-Menue.
- Quick toggles: SFX, Music, Haptics, CRT, Left Hand.
- "Save and quit" nur wenn echte Save-State-Unterstuetzung existiert; sonst "Quit run" mit klarer Warnung.

## 7. Controls

Das `controlProfiles`-System ist gut. Naechste Stufe:

- Controls pro Spiel auf Game Card und Start Sheet anzeigen.
- Touch-Zonen visuell anpassbar: left/right, opacity, size, compact.
- Pointer-Mode verbessern: bei Drag-Spielen keine D-pad-Simulation zeigen, sondern Thumb-Zone/Track-Pad.
- Desktop: Keyboard Remapping in Settings, nicht nur Help Overlay.
- Gamepad: "Controller connected" Toast und Button-Glyphs.
- Accessibility: One-button mode fuer geeignete Spiele, hold-to-repeat konfigurierbar, reduced precision mode fuer Tap-Spiele.

## 8. PWA-Installationsgefuehl

Der Install-Banner nach zweiter Session ist gut. Besser waere eine Mini-Reise:

- First run: keine Install-Frage.
- Nach erstem positiven Moment: "Retro Pocket works offline" Toast.
- Nach zweiter Rueckkehr oder Daily-Abschluss: Install-Banner.
- Nach Installation: eigener "Installed Mode" Toast, Home-Screen-Shortcut-Hinweis, Offline-Status-Chip.
- Manifest Shortcuts sind schon da; im Hub sichtbar machen: "Long-press app icon for Daily/Surprise".
- iOS: eigene Add-to-Home-Screen-Anleitung, weil `beforeinstallprompt` dort nicht funktioniert.

## 9. Feedback, Sound und Animation

- Sound-Mix in Kategorien aufteilen: UI blip, coin, hit, powerup, gameover, achievement, daily complete.
- Pro Cabinet ein kurzer musikalischer Akzent statt ein globaler Einheitsloop.
- Screen shake nur fuer Schaden/Explosion, nicht fuer jedes Feedback.
- Haptics: light fuer tap, medium fuer hit, success fuer achievement, warning fuer near death.
- Motion-Regel: starke Animation nur bei Start, Best Score, Level Up, Badge, Daily Done.
- Reduced Motion ist vorhanden; pruefen, ob alle CSS-Keyframes und Pixi-FX respektiert werden.

## 10. Progression, XP, Tokens, Achievements

### XP-Rebalance

Ersetze `xpGain = max(5, score / 10)` durch:

```text
xp = basePerRun
   + normalizedScoreTier
   + improvementBonus
   + dailyBonus
   + masteryBonus
```

Lege pro Spiel `rewardProfile` in der Registry an:

```ts
reward: { targetScore: 1000, sessionMin: 1, sessionMax: 3, difficulty: 1.0 }
```

So gibt Snake nicht automatisch weniger/mehr XP als Space Blaster nur wegen anderer Score-Skala.

### Token-System

Tokens sollten nicht nur Rohscore-Waehrung sein. Sie brauchen faire Quellen und kosmetische Senken:

- Quellen: Daily, Badges, first win, new best, weekly set, mastery rank.
- Senken: Themes, shell colors, card backs, HUD skins, sound packs, profile frames.
- Kein Pay-to-Win: keine Extraleben, keine Score-Multiplikatoren fuer Standard-Leaderboards.

### Achievements

- Pro Spiel mindestens 3 Badges: First Clear/Score, Skill, Style.
- Meta-Badges: "Play 5 one-thumb games", "Try all Classics", "7-day Daily", "No-miss run".
- Progress-Badges mit sichtbarer Leiste.
- Hidden Badges nur sparsam.

## 11. Daily Challenge, Leaderboards, Share Cards

Daily:

- Fuehre `dailyRules` pro Spiel ein. Manche Spiele vertragen Turbo, andere eher "one life", "small board", "double coins".
- Separate Daily Score History statt Ueberschreiben normaler Best Scores, sonst fuehlen Modifikatoren unfair an.
- Daily Completion sollte immer belohnen, Daily Excellence zusaetzlich.
- Zeige "same challenge for everyone" explizit im Daily-Sheet.

Leaderboards:

- Lokale Hall of Scores ist gut. Ergaenze pro Spiel Tabs: Best, Daily, Recent, Friends/local profiles spaeter.
- Name Entry nicht erst im Game Over erklaeren; Profile kann Standardnamen setzen.
- Top-3 visuell wie Arcade-Cabinet-Plakette.

Share Cards:

- Vorschau im Game Over.
- Varianten: New Best, Daily Done, Badge Unlock, Level Up.
- Immer mit Game Cover, Score, Best Delta, QR/URL optional, "local-first" Claim.

## 12. Code-Architektur

Staerken:

- Zentrale Registry, GameHost, Input, Store, PWA-UX und Settings sind gute Produktgrenzen.
- Dynamic Imports pro Spiel sind richtig.
- Pixi liegt in eigenem Chunk; Spiele werden gesplittet.

Risiken:

- `GameHost` ist sehr gross und kennt HUD, Controls, Pause, Game Over, Score, Daily, Achievements, Leaderboard, Share und Perf. Auf Dauer in Services splitten:
  - `RunSession`
  - `HudController`
  - `OverlayController`
  - `RewardService`
  - `LeaderboardService`
  - `GameChrome`
- `conceptArcade.ts` buendelt 12 Spiele in einer grossen Datei. Gut fuer schnellen Ausbau, aber schlecht fuer Ownership und gezielte Politur. Langfristig je Spiel eigene Datei oder Shared Helpers + einzelne Module.
- Registry-Kommentare sind veraltet ("20 classics"), obwohl 74 Spiele existieren.
- Encoding wirkt in Terminal-Ausgabe teils fehlerhaft. Pruefe UTF-8-Konfiguration fuer Docs/Source.

## 13. Tests und QA

Naechste Testschicht:

- Unit: Reward-Normalisierung, Daily Rules, Search/Filter, Favorite/Recent, GameHost state transitions.
- Component/DOM: Home zeigt Daily, Stats, Continue, Favorites; Search findet Blurb/Tags; mobile bottom tabs.
- E2E/Smoke: Start jedes Kit-Typs, Pause, Resume, Game Over, Score gespeichert.
- Visual QA: 390x844, 430x932, 768x1024, 1366x768, landscape.
- PWA: offline after first load, install banner, update banner, shortcuts.
- A11y: focus trap in overlays, Escape/back behavior, aria labels, colorblind themes, reduced motion, touch target size.

## 14. Accessibility

- Dialoge brauchen echten Focus Trap, nicht nur initial focus.
- Back/Escape muss Overlays schliessen, nicht immer App verlassen.
- Touch Buttons sollten bei `largeTargets` groesser werden.
- Colorblind-Modus muss auch Pixi-Spielgrafik beeinflussen, nicht nur CSS.
- High Contrast sollte Tile Covers, HUD, Controls und Game Objects pruefen.
- Keyboard-only: Home, Suche, Filter, Game Cards, Pause, Game Over komplett bedienbar.
- Screenreader: Canvas-Spiele brauchen kurze Rollenbeschreibung und Controls im Start/Pause-Sheet.

## 15. Monetarisierung ohne Pay-to-Win

Empfehlung: Premium-kosmetisch oder Supporter-Modell, niemals Power.

Optionen:

- Einmaliger "Supporter Pass": extra Themes, cabinet skins, sound packs, profile frames.
- Optionaler Tip Jar / Ko-fi Link im About.
- Cosmetic Packs: CRT Amber Pack, Candy Cabinet Pack, Space Cabinet Pack.
- Export/Import Cloud spaeter als optionales Pro-Feature, aber Basis bleibt lokal.
- Keine Ads, keine Energie-Timer, keine Score-Booster fuer Leaderboards.

## 16. Pro-Spiel-Audit: naechster konkreter Upgrade

### Neon Originals und ausgebaute neue Spiele

| Spiel | Naechster Upgrade |
|---|---|
| Pixel Dash | Missionen: no-hit, coin route, dash chain; Ghost-trail fuer Best Run. |
| Neon Rider | Lane-readability und near-miss-Mastery; Nitro-Risiko klarer visualisieren. |
| Block Collapse | Vorschau auf Gruppenwert, Combo-Ketten und "best move" Training nach Game Over. |
| Space Blaster | Enemy-Telegraphs, Weapon-Cooldown-HUD, Boss alle X Wellen. |
| Jump Quest | Plattformtypen, vertikale Kamera-Politur, Gem-route-Missions. |
| Retro Snake | Wrap als Identitaet: Portal-FX, "wrap combo", Badge fuer 10 Wraps ohne Crash. |
| Dot Collector | Chaser-Persoenlichkeiten, Power-pellet Timing, Maze-clear Badge. |
| Memory Match | Card-back cosmetics, perfect-memory Badge, peek-cost besser erklaeren. |
| Brick Breaker | Powerups mit Icons, Level-Banner, Ball-Trajectory-Lernfeedback. |
| Turbo Drift | Driftwinkel/Perfect-Gate-Meter, Streckenvarianten, Replay-Ghost. |
| Color Switch | Farbblind-Symbole auf Farben, Ring-Telegraph, Combo-FX. |
| Galactic Invaders | Formation-Patterns, Barrier-Damage readability, UFO callout. |

### Klassiker

| Spiel | Naechster Upgrade |
|---|---|
| Snake | Skins, speed tiers, apples with modifiers, "Classic vs Wrap" mode. |
| Tetris | DAS/ARR settings, ghost piece toggle, next queue polish, line-clear FX. |
| Pong | Paddle assist setting, local 2P mode, rally milestones. |
| Breakout | Ball angle clarity, brick HP labels, level progression. |
| Space Invaders | Audio march tempo, invader personalities, wave cards. |
| Flappy | Better first-run difficulty ramp, medal thresholds. |
| 2048 | Undo as practice-only, best tile history, swipe feedback. |
| Minesweeper | Flag mode toggle, long-press timing setting, safe-first-tap. |
| Asteroids | Hyperspace ability, debris readability, thrust trail. |
| Pac-Man | Ghost state clarity, maze variants, fruit timing. |
| Frogger | Lane timing telegraphs, home slots, water readability. |
| Galaga | Capture/rescue mechanic if missing or stronger if present. |
| Centipede | Mushroom field clarity, spider warning, segment hit FX. |
| Missile Command | City health UI, explosion radius preview, panic siren. |
| Bomberman | Bomb radius preview, enemy AI tiers, destructible reward pacing. |
| Q*bert | Isometric touch controls tutorial, tile-state readability. |
| Doodle Jump | Platform variety and offscreen warning. |
| Simon | Audio pitches, sequence replay accessibility, mistake review. |
| Lunar Lander | Velocity/angle gauges, landing pad multiplier readability. |
| Tron | Local 2P/hotseat, trail contrast, round structure. |

### Brain, Puzzle und Skill Volumes

| Spiel | Naechster Upgrade |
|---|---|
| Memory | Completion timer and fewer-move mastery. |
| Lights Out | Hint economy, optimal-move badge. |
| 15 Puzzle | Shuffle validity indicator, move counter tiers. |
| Sokoban | Level select and undo; score not just completion. |
| Mastermind | Better feedback legend, hard mode. |
| Flood-It | Remaining-moves tension, colorblind symbols. |
| Connect Four | AI difficulty tiers, threat highlights in tutorial. |
| Tic-Tac-Toe | Faster rounds, perfect-play lesson, impossible AI badge. |
| Reversi | Legal-move hints toggle, corner strategy tutorial. |
| Gem Match | Cascades, special gems, objective rounds. |
| Columns | Existing core tests good; add preview/hold and chain callouts. |
| Meteor Dodge | Hitbox clarity, warning shadows, survival medals. |
| Copter | Cave readability, input smoothing, one-thumb calibration. |
| Pixel Runner | Distinguish from Pixel Dash via different verb: rhythm jumps or wall runs. |
| Whack-a-Mole | Fake targets, combo window, accessibility for tap speed. |
| Stacker | Perfect-center feedback, tower wobble, height milestones. |
| Pinball | Table lanes, objectives, nudge control. |
| Maze Run | Fog-of-war option, path memory badge. |
| Reflex Grid | Reaction-time histogram, accessibility floor. |
| Tunnel Flyer | Better depth cues, shield pickups, near-miss scoring. |
| Battleship | Salvo mode, hit history clarity, ship placement UX. |
| Sudoku | Notes mode, conflict highlighting, difficulty labels. |
| Checkers | Move hints, forced capture explanation, AI levels. |
| Bubble Shooter | Aim guide, ceiling danger meter, bank-shot badge. |
| Blackjack | Strategy hints in practice, clear non-gambling framing. |
| Hangman | Word categories, streaks, keyboard layout. |
| Dice Poker | Scorecard explanation, reroll animation, suggested category optional. |
| RPS Duel | Pattern-reading tells, best-of format polish. |
| Target Tap | Target types, miss penalty clarity, motor accessibility. |
| Chain Reaction | Cascade preview, replay last chain, board-size modes. |
| Quick Math | Difficulty ramp, input keypad ergonomics. |
| Higher Lower | Probability hint in practice, streak pressure FX. |
| Color Clash | Colorblind-safe shapes, Stroop tutorial. |
| Orbit Dodge | Orbit radius control clarity, danger arcs. |
| Lockpick | Haptic timing, pin sequence variants. |
| Number Hunt | Layout readability, ordered path preview after fail. |
| Word Mix | Letter drag/tap alternatives, word packs. |
| Pulse Catch | Timing zone calibration, rhythm audio cue. |
| Memory Path | Path replay speed setting, pattern categories. |
| Hot Cold | Signal visualization, fewer random-feeling misses. |
| Neon Rush | Differentiate from Pixel Dash with shield/boost buildcraft. |
| Crystal Vault | Move economy, cascade scoring preview. |
| Laser Maze | Beam telegraphs, stealth rating, route replay. |
| Star Forge | Combo grammar, wrong-star penalty clarity. |
| Drift Racer | Merge identity with Turbo Drift or separate as precision racer. |
| Rune Reactor | Chain reaction readability, rune glossary. |
| Comet Sweep | Blast-radius preview, core damage states. |
| Prism Dash | Color state always visible near player, gate preview. |
| Gear Lock | Differentiate from Lockpick with multi-gear rhythm patterns. |
| Echo Runner | Memory path plus pressure; add echo replay and mistake marker. |

## 17. Langfristige Roadmap

### Naechste 2 Wochen: Produktklarheit

- Sidenav reduzieren, Mobile Bottom Tabs einfuehren.
- Game Cards um Mastery, Controls, Best-Metric und Session-Length erweitern.
- Game Start Sheet einfuehren.
- XP/Token-Breakdown im Game Over sichtbar machen.
- Search auf Tags/Blurb/Controls erweitern.

### 3-6 Wochen: Retention

- Cartridge Mastery pro Spiel: Bronze/Silver/Gold + 3 Missionen.
- Reward-Normalisierung pro Spiel.
- Daily Rules pro Spiel statt nur globaler TimeScale.
- Badges fuer die 12 neuen Neon-Spiele.
- PWA Install Journey inklusive iOS-Anleitung.

### 2-3 Monate: Qualitaet

- GameHost in kleinere Controller/Services splitten.
- conceptArcade-Spiele modularisieren.
- Visual QA und E2E-Smoke fuer alle Kit-Typen.
- A11y-Pass fuer Dialoge, Controls und Colorblind-Modi.
- Per-Spiel Politur nach Qualitaetsampel.

### 3-6 Monate: Signature Features

- Player Card mit kosmetischen Unlocks.
- Cabinet Themes und Score Print Gallery.
- Local profiles oder pass-and-play.
- Optionaler Supporter Pass mit Cosmetics.
- Import/Export Save Data.

## 18. Priorisierte Backlog-Liste

1. `Registry`: `sessionLength`, `rewardProfile`, `collections`, `masteryGoals`, `dailyRules` ergaenzen.
2. `App`: Sidenav auf Hauptziele kuerzen; Collections statt 74 Eintraege.
3. `App`: Mobile Bottom Tabs fuer Home/Daily/Shelf/Scores/Profile.
4. `App`: Search ueber Titel, Blurb, Tags, Group, Kit, Controls.
5. `GameHost`: Game Over um tokenGain und XP-Breakdown erweitern.
6. `GameHost`: OverlayController und RewardService extrahieren.
7. `Daily`: Daily Scores separat speichern und modifiers pro Spiel zulassen.
8. `Achievements`: pro neuem Neon-Spiel 3 Badges.
9. `Settings`: Controls size/opacity/remap und iOS install help.
10. `Tests`: DOM smoke fuer Home, Game Start, Pause, Game Over, Daily.

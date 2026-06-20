# 20 neue Minigame-Ideen (neuerVorgang.md #30)

Eigener Retro-Neon-Arcade-Charakter, nicht generisch. Jede Idee: Name · Genre · Pitch · Steuerung · Score · Schwierigkeit · Besonderheit · Warum sie passt.

1. **Pulse Weaver** — Rhythm/Skill — Webe Neon-Fäden im Takt zwischen Pylonen. Tap/Hold im Beat. Score: Combo × Genauigkeit. Mittel. Besonderheit: das Level *ist* der Soundtrack. Passt: tempo-getriebenes One-Thumb.
2. **Gravity Well** — Physik/Skill — Schleudere eine Sonde per Slingshot um Schwarze Löcher zum Ziel. Drag-aim. Score: Treffer + Resttreibstoff. Mittel-Hart. Orbit-Vorschau-Linie. Passt: „one more try"-Physik.
3. **Chromatic** — Puzzle — Misch fallende RGB-Tropfen zur Zielfarbe. Swipe in 3 Becken. Score: Ketten + Reinheit. Mittel. Farbtheorie als Mechanik. Passt: ruhiges Brain-Cabinet.
4. **Volt Runner** — Endless/Skill — Reite Stromleitungen, spring zwischen Phasen, meide Überschläge. Tap=Phasenwechsel. Score: Distanz × Volt-Combo. Hart. Strom als Gefahr+Antrieb. Passt: Neon-Endless.
5. **Decrypt** — Brain/Deduktion — Knacke einen 4-Symbol-Code mit Hot/Cold-Hinweisen pro Versuch. Tap-Eingabe. Score: weniger Versuche = mehr. Mittel. Mastermind mit Zeitdruck-Modus. Passt: Brain.
6. **Magnet Maze** — Puzzle/Skill — Lenke eine Kugel nur per umschaltbarer Polarität durch Magnetfelder. Tap=Polarität. Score: Zeit + Münzen. Mittel. Indirekte Steuerung. Passt: clevere Eingabe.
7. **Strobe** — Reflex — Tap nur, wenn die richtige Farbe blitzt; ignoriere Fakes. Tap. Score: Streak × Reaktionszeit. Leicht-Mittel. Stroop-Effekt. Passt: Quick-Run.
8. **Tideline** — Skill/Survival — Stapel-Surf auf einer steigenden Neon-Welle, balanciere Schwung. Tilt/Links-Rechts. Score: Höhe. Mittel. Prozedurale Welle. Passt: Score-Chaser.
9. **Hex Cascade** — Match/Puzzle — Dreh Hex-Triolen, matche 3+. Tap=rotiere Triade. Score: Cascade². Mittel. Hex-Grid statt Quadrat. Passt: Puzzle-Cabinet.
10. **Sentry** — Shooter/Tower — Dreh ein Geschütz im Zentrum, halte 360° Wellen ab. Drag=zielen, Tap=feuern. Score: Welle × Kills. Mittel-Hart. Radiales Bullet-Management. Passt: Action-Bay.
11. **Glitchhop** — Platform/Skill — Hüpf durch „glitchende" Plattformen, die kurz verschwinden. Tap=Sprung. Score: Distanz. Hart. Vorhersage statt Reaktion. Passt: Jump.
12. **Loomint** — Idle-aktiv/Puzzle — Verbinde Knoten zu geschlossenen Neon-Schleifen für Bonus. Drag-Linien. Score: Schleifenfläche. Leicht-Mittel. Meditativ. Passt: ruhiges Brain.
13. **Overdrive** — Racing/Skill — Spurwechsel-Racer mit Boost-Management & Slipstream. Swipe. Score: Distanz × Boost-Effizienz. Mittel. Slipstream-Combo. Passt: Neon-Racer (ergänzt Neon Rider/Drift Racer).
14. **Echo Chamber** — Memory — Wiederhole wachsende Licht+Ton-Muster auf 6 Pads. Tap. Score: Sequenzlänge. Mittel. Simon mit Tempo-Layern. Passt: Brain.
15. **Plasma Pong** — Paddle/Skill — Pong gegen 3 KI-Wände gleichzeitig, Power-Kurven. Drag. Score: Rallyes. Mittel-Hart. Vier-Wege-Pong. Passt: Paddle.
16. **Burrow** — Dig/Survival — Grab dich abwärts, sammle Kristalle, meide Lava-Adern. Swipe-Richtung. Score: Tiefe + Kristalle. Mittel. Zerstörbares Terrain. Passt: Arcade.
17. **Signal** — Brain/Timing — Stimme drei Wellen-Slider in Resonanz, bevor das Zeitfenster schließt. Drag-Slider. Score: Präzision. Mittel. „Lockpick" mit Wellenform. Passt: Skill-Quick.
18. **Constellation** — Puzzle — Verbinde Sterne in einem Zug zur Zielform (kein Stift heben). Drag. Score: Sternzahl. Leicht-Mittel. One-Stroke-Pfade. Passt: ruhiges Puzzle.
19. **Riftcoaster** — Endless/Skill — Achterbahn durch sich verschiebende Dimensions-Risse, Spurwechsel im rechten Moment. Tap. Score: Distanz × Risk. Hart. Spurwechsel-Timing. Passt: Tunnel-Nachfolger.
20. **Forge Master** — Timing/Craft — Schlag glühendes Metall im perfekten Hitze-Fenster, schmiede Combos. Tap im Fenster. Score: Combo × Reinheit. Mittel. „Gear Lock" als Schmiede-Loop. Passt: Skill-Quick.

## Umsetzungsraster
Jedes neue Spiel folgt dem bestehenden Vertrag: `src/games/<id>/index.ts` (`createGame(ctx)`), reines `core.ts` + vitest, Registry-Eintrag via `mk(...)`. Empfohlene erste Welle (geringster Aufwand, hoher Charakter): **Strobe, Echo Chamber, Constellation, Hex Cascade, Signal** (alle standalone/tap/drag, kein Physik-Tuning).

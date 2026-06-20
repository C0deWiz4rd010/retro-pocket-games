# 15 – Feature Backlog (Punkte 9–35)

Roher Produkt-Backlog mit Feature- und Design-Anfragen (ursprünglich `neuerVorgang.md`). Die Umsetzung ist in [12 – Umsetzungsplan](12-umsetzungsplan.md) priorisiert; Status der Realisierung siehe unten im Abschnitt **Status**.

> **Status (laufend):** Die echten Code-Lücken sind umgesetzt und einzeln auf `develop` gepusht — #9 Pause-Untermenüs (Controls/Regeln/Accessibility) + Haptik-Toggle, #10/#22 Fullscreen-Button + Daten-Import, #11 Tasten-Rebinding-UI, #14 Music-Toggle + Versionsanzeige, #16 zusätzliche Achievements, #21 First-Run-Onboarding, #27 Pause bei Fokusverlust. Konzept-Punkte als Docs geliefert: [13 – Monetarisierung](13-monetarisierung.md) (#28), [14 – Neue Games](14-neue-games.md) (#30). Übrige Punkte (#12/#13/#15/#17/#18/#19/#20/#23–26/#31–34) waren im Repo bereits in Grundform vorhanden und wurden belassen/punktuell erweitert.

---

9. Pause-Menü verbessern

Verbessere das Pause-Menü.

Es soll enthalten:

Resume
Restart
Controls
Sound on/off
Haptics on/off
Quit to Hub
Accessibility Optionen
kurze Spielregeln

Bitte beschreibe Layout, Buttons und Verhalten.

10. Touch-Steuerung und Mobile Feel

Analysiere, wie sich eine Minigame-PWA auf dem Smartphone gut anfühlen muss.

Bitte gib Vorschläge für:

Swipe-Steuerung
virtuelle Buttons
Joystick
Tap-Zonen
Gesten
Haptic Feedback
Screen Shake
Input-Latenz
große Touch-Ziele
Daumenbereiche
Landscape/Portrait
Fullscreen-Modus
Safe Areas
One-Hand-Modus

Bitte erkläre, welche Steuerungstypen für welche Spiele geeignet sind.

11. Desktop-Steuerung

Bitte entwirf ein einheitliches Input-System für Desktop:

WASD
Pfeiltasten
Space
Enter
Escape
Mouse
Gamepad optional

Bitte gib mir eine Mapping-Tabelle und Empfehlungen für Rebinding.

12. Visuelles Design-System

Entwickle ein konsistentes Design-System für Retro Pocket.

Bitte liefere:

Farbpalette
Neon-Farben
Hintergrundvarianten
Karten-Stile
Buttons
HUD-Komponenten
Dialoge
Badges
XP-Bar
Token-Anzeige
Achievement-Popups
Leaderboard-Look
Pixel-Rahmen
Schatten
Glow-Effekte
reduzierte Animationen für Accessibility

Bitte gib konkrete CSS-Variablen-Namen und Beispielwerte.

13. Animationen und Arcade-Feedback

Bitte schlage ein vollständiges Feedback-System vor.

Für:

Button Press
Game Start
Game Over
Level Up
Achievement unlocked
Token earned
New Highscore
Combo
Perfect Run
Damage
Collision
Collect Item
Daily Challenge complete
Unlock new game

Bitte gib konkrete Animationen, Soundideen und kurze UI-Texte.

14. Sounddesign

Entwickle ein Soundkonzept.

Bitte beschreibe:

UI-Sounds
Game-Start-Sound
Gameover-Sound
Collect-Sound
Damage-Sound
Combo-Sound
Achievement-Sound
Level-Up-Sound
Background-Loops
Mute-Option
Lautstärkeregler
Soundgruppen

Bitte gib Ideen, wie man Sounds einfach und lightweight in einer PWA einbindet.

15. Progression-System verbessern

Aktuell gibt es XP, Tokens, Achievements und Profil.

Bitte verbessere die Progression.

Entwickle:

Spielerlevel
XP-Kurve
Token-Ökonomie
Daily Rewards
Streaks
Mastery pro Spiel
Skill-Rankings
Profil-Titel
kosmetische Unlocks
Themes
Avatare
Badges
Retro-Cabinets
Sammlerstücke

Wichtig:
Keine Pay-to-Win-Mechanik.

Bitte gib konkrete Zahlen und Balancing-Vorschläge.

16. Achievement-System verbessern

Entwickle ein besseres Achievement-System.

Bitte erstelle Kategorien:

Skill Achievements
Collection Achievements
Daily Achievements
Streak Achievements
Hidden Achievements
Mastery Achievements
Fun Achievements

Bitte gib 30 konkrete Achievement-Ideen mit:

Name
Beschreibung
Bedingung
Reward
Seltenheit
passendes Spiel
17. Daily Challenge verbessern

Verbessere das Daily-Challenge-System.

Bitte entwickle:

tägliche Missionen
wöchentliche Missionen
Spezial-Events
Challenge-Modifikatoren
Belohnungen
Streaks
Leaderboard-Verknüpfung
Share-Card-Verknüpfung

Bitte gib 20 konkrete Daily-Challenge-Beispiele.

18. Lokale Leaderboards verbessern

Aktuell gibt es lokale Leaderboards.

Bitte verbessere sie.

Vorschläge für:

pro Spiel
pro Kategorie
daily
weekly
all-time
persönliche Bestleistung
Ghost Score
“Beat your yesterday”
Rival-System lokal
Score-Tier-System

Bitte erkläre, wie lokale Leaderboards motivierend wirken können, auch ohne Online-Multiplayer.

19. Share-Cards verbessern

Entwickle ein besseres Share-Card-System.

Eine Share-Card soll schön aussehen und teilbar sein.

Bitte liefere:

Layout
Inhalte
Text
Score
Spielname
Rank
QR-Code optional
Daily Challenge Status
Achievement Highlight
Neon-Rahmen
Export als PNG
Web Share API

Bitte gib konkrete Share-Card-Texte für mehrere Situationen.

20. Profil-System verbessern

Verbessere das Profil.

Es soll enthalten:

Avatar
Level
XP
Tokens
Titel
Lieblingsspiel
meistgespieltes Spiel
höchste Kombo
Gesamtspielzeit
Achievements
Daily Streak
Mastered Games
Statistiken
kosmetische Anpassungen

Bitte erstelle eine konkrete Profilseite als Text-Wireframe.

21. Onboarding verbessern

Entwickle ein kurzes, starkes Onboarding.

Es soll erklären:

was Retro Pocket ist
wie man Spiele startet
wie XP funktioniert
was Tokens sind
wie Daily Challenge funktioniert
wie man die PWA installiert
wie Touch-Steuerung funktioniert

Bitte erstelle ein Onboarding in 5 kurzen Screens mit konkretem Text.

22. PWA-Qualität verbessern

Bitte analysiere, wie Retro Pocket sich mehr wie eine echte App anfühlt.

Vorschläge für:

Install Prompt
Offline-Modus
App Icon
Splash Screen
Theme Color
Fullscreen
Manifest
Service Worker
Cache-Strategie
Update-Hinweis
App-Version anzeigen
Storage-Management
Backup/Export von Fortschritt
Import von Fortschritt

Bitte gib konkrete technische Empfehlungen.

23. Performance verbessern

Retro Pocket hat 82 Minigames.

Bitte schlage vor, wie man Performance und Ladezeit verbessert:

Lazy Loading
Code Splitting
Asset-Optimierung
Sprite Sheets
Audio Preloading
Canvas Performance
requestAnimationFrame
OffscreenCanvas optional
Memory Management
reduzierte Animationen
FPS Monitoring
Bundle-Analyse
Lighthouse-Ziele

Bitte gib eine Prioritätenliste.

24. Code-Architektur verbessern

Bitte schlage eine professionelle Architektur vor.

Das Projekt sollte skalierbar für 82+ Games sein.

Bitte liefere:

Ordnerstruktur
Game Registry
Game Metadata
Shared Game Engine Utilities
Input Manager
Audio Manager
Achievement Manager
Reward Manager
Storage Manager
Challenge Manager
Leaderboard Manager
Share Manager
UI Component Library
Testing Utilities

Bitte gib Beispiel-Strukturen und TypeScript-Interfaces.

25. Einheitliche Game-API

Bitte entwickle eine einheitliche API, damit jedes Minigame gleich integriert werden kann.

Jedes Spiel soll haben:

id
name
category
difficulty
estimatedDuration
controls
description
thumbnail
start()
pause()
resume()
restart()
destroy()
getScore()
getState()
onGameOver()
achievements
dailyChallengeSupport

Bitte gib konkrete TypeScript-Interfaces.

26. Teststrategie

Bitte entwickle eine Teststrategie.

Für:

Snake Wall Wrap
Score Calculation
XP Rewards
Token Rewards
Achievement Unlocks
Daily Challenge Reset
Leaderboards
Storage
Game Registry
Input Handling
Gameover Dialog
PWA Offline Mode

Bitte gib konkrete Testfälle und Beispiele.

27. Accessibility verbessern

Bitte gib Vorschläge für:

reduzierte Bewegung
hoher Kontrast
farbenblindfreundliche Modi
größere Touch-Ziele
Tastaturbedienung
Screenreader-Texte
Pause bei Fokusverlust
lesbare Schriftgrößen
kein reines Farbfeedback
alternative Steuerungen

Bitte priorisiere die wichtigsten Accessibility-Features für ein Arcade-Projekt.

28. Monetarisierung ohne Pay-to-Win

Bitte entwickle faire Monetarisierungsideen.

Erlaubt:

kosmetische Themes
Premium-Version
Spenden/Kaffee
freiwillige Werbung
Skin-Packs
Supporter Badge
Retro Cabinet Skins
Sound Packs
Avatar Packs

Nicht erlaubt:

Pay-to-Win
bezahlte Highscore-Vorteile
Energy-Limits
aggressive Werbung

Bitte gib ein faires Monetarisierungsmodell.

29. Einzelanalyse der Minigames

Bitte analysiere und verbessere jedes der folgenden Spiele einzeln:

Pixel Dash
Neon Rider
Dot Collector
Block Collapse
Space Blaster
Jump Quest
Retro Snake
Memory Match
Brick Breaker
Turbo Drift
Color Switch
Galactic Invaders

Für jedes Spiel bitte:

Kurzer aktueller Eindruck
Kernspielprinzip
Was macht Spaß?
Was könnte langweilig werden?
Verbesserte Steuerung
Bessere Schwierigkeitsskala
Power-ups
Hindernisse
Score-System
Combo-System
Achievements
Daily-Challenge-Ideen
visuelle Effekte
Soundeffekte
Gameover-Verbesserung
3 konkrete Feature-Ideen
3 kleine Sofortverbesserungen
1 größere spätere Erweiterung
30. Ideen für weitere einzigartige Minigames

Bitte erfinde 20 neue Minigames, die gut in Retro Pocket passen.

Für jedes neue Spiel:

Name
Genre
1-Satz-Pitch
Steuerung
Score-Mechanik
Schwierigkeit
Besonderheit
warum es zur App passt

Die Spiele sollen nicht generisch sein, sondern einen eigenen Retro-Neon-Arcade-Charakter haben.

31. Balancing

Bitte entwickle ein Balancing-System für:

XP pro Spiel
Tokens pro Spiel
Daily Rewards
Achievement Rewards
Score Multipliers
Combo Rewards
Schwierigkeit
Spielzeit
Mastery

Bitte gib konkrete Formeln oder Beispielwerte.

32. Retention

Bitte entwickle Features, damit Nutzer wiederkommen.

Ideen:

Daily Challenge
Weekly Arcade Cup
Streaks
neue Spielrotation
persönliche Ziele
“Beat your score”
lokale Rivalen
saisonale Events
freischaltbare Themes
Mastery Road
Retro Album

Bitte priorisiere nach Aufwand und Wirkung.

33. Roadmap

Bitte erstelle eine Roadmap.

Aufteilung:

Sofort: 1–3 Tage
Kurzfristig: 1 Woche
MVP-Polish: 2–3 Wochen
Größeres Update: 1–2 Monate
Langfristig: 3–6 Monate

Für jeden Zeitraum:

Features
technische Aufgaben
UI/UX-Aufgaben
Tests
Risiken
erwarteter Impact
34. Konkreter 7-Tage-Plan

Bitte erstelle am Ende einen konkreten 7-Tage-Plan für mich als Solo-Entwickler.

Jeder Tag soll enthalten:

Hauptziel
konkrete Aufgaben
Dateien/Module, die vermutlich betroffen sind
erwartetes Ergebnis
Testkriterien
Priorität
35. Ausgabeformat

Bitte antworte strukturiert mit klaren Überschriften.

Wichtig:

Sei sehr konkret.
Keine generischen Tipps.
Gib viele Beispiele.
Gib konkrete UI-Texte.
Gib konkrete Game-Design-Mechaniken.
Gib technische TypeScript-/Frontend-Strukturen.
Gib realistische Prioritäten.
Denke an Solo-Entwickler-Aufwand.
Markiere klar: Quick Win, Medium Effort, Big Feature.
Gib am Ende eine Top-20-Prioritätenliste.

Wenn Informationen fehlen, triff sinnvolle Annahmen und arbeite trotzdem weiter.
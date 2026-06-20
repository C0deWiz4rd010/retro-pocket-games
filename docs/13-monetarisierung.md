# Faire Monetarisierung (neuerVorgang.md #28)

Leitprinzip: **kein Pay-to-Win.** Nichts, was Score, XP-Rate, Tokens-aus-Spielen, Schwierigkeit oder Leaderboard-Platz beeinflusst, darf käuflich sein. Bezahlt wird ausschließlich Kosmetik & Support. Alle Spiele bleiben kostenlos und offline spielbar.

## Modell (3 Säulen)

### 1. Supporter / „Buy a Coffee" (einmalig, optional)
- **Retro Pocket Supporter** — einmalig ~3–5 €. Schaltet frei:
  - „Supporter"-Badge im Profil (kosmetisch).
  - Alle aktuellen kosmetischen Theme-Packs (s. u.).
  - Dezenter „Danke"-Splash beim Start (abschaltbar).
- Spenden-Link (Ko-fi / GitHub Sponsors) ohne Gegenleistung, rein freiwillig.

### 2. Kosmetik-Packs (einmalig, je ~1–2 € oder per Tokens)
Doppelte Währung: kaufbar **mit Echtgeld ODER** mit im Spiel verdienten **Pocket Chips** (Tokens). So bleibt alles ohne Zahlung erreichbar — Geld spart nur Zeit.
| Pack | Inhalt | Token-Preis | €-Preis |
|---|---|---|---|
| Neon Themes | 4 zusätzliche Farb-Themes (Vaporwave, Matrix, Sunset, Mono) | 1500 | 1,99 € |
| Cabinet Skins | 4 Gehäuse-Skins (Wood, Chrome, Transparent, CRT-TV) | 1500 | 1,99 € |
| Sound Packs | 2 alternative SFX-Sets (8-bit, Synthwave) | 1000 | 0,99 € |
| Avatar Packs | 16 Profil-Avatare (Pixel-Charaktere) | 800 | 0,99 € |

### 3. Season Pass — **rein kosmetisch, gratis-Track inklusive**
- Optionaler „Arcade Cup Pass" pro Saison (~4 Wochen). **Gratis-Track** schaltet Kosmetik durch Spielen frei; **Premium-Track** (~2,99 €) gibt zusätzliche kosmetische Stufen.
- Kein Zeitdruck-FOMO: verpasste Items wandern danach in den Token-Shop.

## Explizit verboten (Hard-No)
- Pay-to-Win jeder Art · bezahlte Score-/XP-/Token-Booster · gekaufte Leaderboard-Vorteile.
- Energy-/Leben-Limits, die man wegkaufen muss.
- Aggressive/Interstitial-Werbung. Erlaubt nur: **freiwillige** Rewarded-Ads, die **ausschließlich Tokens** geben (dieselbe Obergrenze wie durch Spielen erreichbar) — niemals erzwungen.

## Umsetzungs-Hinweise (technisch)
- Kosmetik ist bereits via `profile.unlocks: string[]` modellierbar; Token-Ökonomie via `addTokens`. Käufe setzen denselben Unlock-Flag wie Token-Kauf.
- Zahlungen out-of-scope für die PWA-MVP: zunächst nur **Token-Shop + Spenden-Link**; Echtgeld später via Web-Payment/Store-Wrapper.
- Werbe-SDK bewusst **nicht** einbauen, solange nicht zwingend.

import { describe, expect, it } from 'vitest';
import { en } from './en';
import { de } from './de';
import { COLLECTION_DE, GAME_BLURB_DE } from './content.de';
import { COLLECTIONS, GAMES } from '@core/Registry';

const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('dictionaries', () => {
  it('en and de define exactly the same keys', () => {
    const e = Object.keys(en).sort();
    const d = Object.keys(de).sort();
    expect(d.filter((k) => !(k in en))).toEqual([]);
    expect(e.filter((k) => !(k in de))).toEqual([]);
  });

  it('no empty translations', () => {
    for (const [k, v] of Object.entries({ ...en })) expect(v.trim(), `en ${k}`).not.toBe('');
    for (const [k, v] of Object.entries({ ...de })) expect(v.trim(), `de ${k}`).not.toBe('');
  });

  it('interpolation placeholders match between languages', () => {
    for (const k of Object.keys(en)) {
      expect(placeholders(de[k] ?? ''), `placeholders of ${k}`).toEqual(placeholders(en[k]!));
    }
  });
});

describe('German game content', () => {
  it('every game has a German blurb', () => {
    expect(GAMES.filter((g) => !GAME_BLURB_DE[g.id]).map((g) => g.id)).toEqual([]);
  });

  it('has no blurbs for unknown games', () => {
    const ids = new Set(GAMES.map((g) => g.id));
    expect(Object.keys(GAME_BLURB_DE).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every collection is translated', () => {
    expect(COLLECTIONS.filter((c) => !COLLECTION_DE[c.id]).map((c) => c.id)).toEqual([]);
  });
});

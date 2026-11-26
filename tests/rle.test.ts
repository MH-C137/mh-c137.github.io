/**
 * Tests du format RLE : écriture creuse (rapide même pour une structure très étalée) et limites de
 * sécurité à la lecture (un texte démesuré est refusé tout de suite).
 */
import { describe, expect, it } from 'vitest';
import { createPattern } from '../src/core/pattern';
import { MAX_RLE_CELLS, MAX_RLE_RUN, parseRle, toRle } from '../src/core/rle';
import { builtinPattern } from '../src/data/patterns';

/** Le corps du dessin d'un texte RLE (sans l'en-tête). */
const body = (rle: string) => rle.split('\n').slice(1).join('').trim();

describe('toRle', () => {
  it('écrit le planeur comme sur LifeWiki', () => {
    expect(body(toRle(builtinPattern('glider')))).toBe('bo$2bo$3o!');
  });

  it('écrit les lignes vides (3$) et les cases mortes avant une plage', () => {
    // Deux cellules en haut (colonnes 12 et 13), une en bas à gauche, deux lignes vides entre : « 12b2o » puis « 3$ » puis « o ».
    const pattern = createPattern([[12, 0], [13, 0], [0, 3]]);
    expect(body(toRle(pattern))).toBe('12b2o3$o!');
  });

  it('ignore les doublons et accepte une structure vide', () => {
    expect(body(toRle(createPattern([[0, 0], [0, 0], [1, 0]])))).toBe('2o!');
    expect(body(toRle(createPattern([])))).toBe('!');
  });

  it('reste instantané pour une structure très étalée (deux cellules à 50 millions de cases)', () => {
    const start = performance.now();
    const text = toRle(createPattern([[0, 0], [50_000_000, 50_000_000]]));
    expect(performance.now() - start).toBeLessThan(200);
    expect(text).toContain('50000000$');
  });
});

describe('parseRle : limites de sécurité', () => {
  it('refuse un nombre démesuré devant une lettre', () => {
    expect(() => parseRle(`${MAX_RLE_RUN + 1}o!`)).toThrow(/démesuré/);
  });

  it('refuse un nombre à des milliers de chiffres (qui vaudrait « infini »)', () => {
    expect(() => parseRle(`${'9'.repeat(5000)}o!`)).toThrow(/démesuré/);
  });

  it('refuse un texte qui ferait créer trop de cellules', () => {
    const half = MAX_RLE_CELLS - 1;
    expect(() => parseRle(`${half}o$${half}o!`)).toThrow(/trop de cellules/);
  });

  it('refuse un texte beaucoup trop long', () => {
    expect(() => parseRle('o'.repeat(5_000_001))).toThrow(/trop long/);
  });

  it('lit toujours un texte normal', () => {
    expect(parseRle('3o!').pattern.cells).toHaveLength(3);
  });
});

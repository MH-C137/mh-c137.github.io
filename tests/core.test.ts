/**
 * Tests des briques de base : clés de coordonnées, règles, format RLE,
 * transformations de structures et historique.
 */
import { describe, expect, it } from 'vitest';
import { keyX, keyY, toKey, WORLD_MAX, WORLD_MIN } from '../src/core/coords';
import { History } from '../src/core/history';
import { createPattern, flipHorizontal, rotateClockwise, type Pattern } from '../src/core/pattern';
import { looksLikeRle, parseRle, toRle } from '../src/core/rle';
import { parseRule } from '../src/core/rules';
import { World } from '../src/core/world';
import { BUILTIN_PATTERNS, builtinPattern } from '../src/data/patterns';
import { Simulation } from '../src/simulation/simulation';

/** Représentation triée d'une structure, pour comparer facilement. */
function signature(pattern: Pattern): string {
  const list = pattern.cells.map(([x, y, skin]) => `${x},${y},${skin}`).sort();
  return `${pattern.width}x${pattern.height}:${list.join(' ')}`;
}

describe('Clés de coordonnées', () => {
  it('encode et décode sans perte, même aux bords du monde', () => {
    for (const [x, y] of [[0, 0], [-1, 5], [123456, -987654], [WORLD_MIN, WORLD_MAX], [WORLD_MAX, WORLD_MIN]]) {
      const key = toKey(x as number, y as number);
      expect(keyX(key)).toBe(x);
      expect(keyY(key)).toBe(y);
    }
  });
});

describe('Règles B/S', () => {
  it('lit la notation et la réécrit proprement', () => {
    const rule = parseRule('b36/s23');
    expect(rule.notation).toBe('B36/S23');
    expect(rule.birth[6]).toBe(true);
    expect(rule.survival[3]).toBe(true);
    expect(rule.survival[4]).toBe(false);
  });

  it('refuse les textes invalides et B0', () => {
    expect(() => parseRule('n’importe quoi')).toThrow();
    expect(() => parseRule('B0/S23')).toThrow();
  });
});

describe('Format RLE', () => {
  it('lit le planeur', () => {
    const { pattern, rule } = parseRle('x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!');
    expect(rule).toBe('B3/S23');
    expect(pattern.width).toBe(3);
    expect(pattern.height).toBe(3);
    expect(pattern.cells.length).toBe(5);
  });

  it('gère les nombres à plusieurs chiffres, les lignes vides et les commentaires', () => {
    const { pattern, name } = parseRle('#N Test\n#C commentaire\nx = 14, y = 3\n12b2o2$o!');
    expect(name).toBe('Test');
    expect(signature(pattern)).toBe(signature(createPattern([[12, 0], [13, 0], [0, 2]])));
  });

  it('écrire puis relire redonne exactement chaque structure de la bibliothèque', () => {
    for (const entry of BUILTIN_PATTERNS) {
      const again = parseRle(toRle(entry.pattern)).pattern;
      expect(signature(again)).toBe(signature(entry.pattern));
    }
  });

  it('reconnaît un texte RLE', () => {
    expect(looksLikeRle('x = 3, y = 3\nbo$2bo$3o!')).toBe(true);
    expect(looksLikeRle('bo$2bo$3o!')).toBe(true);
    expect(looksLikeRle('bonjour')).toBe(false);
  });
});

describe('Transformations de structures', () => {
  it('4 rotations = identité, 2 miroirs = identité', () => {
    const gun = builtinPattern('gosper-gun');
    let rotated = gun;
    for (let i = 0; i < 4; i++) rotated = rotateClockwise(rotated);
    expect(signature(rotated)).toBe(signature(gun));
    expect(signature(flipHorizontal(flipHorizontal(gun)))).toBe(signature(gun));
  });

  it('une rotation échange largeur et hauteur', () => {
    const rotated = rotateClockwise(builtinPattern('lwss'));
    expect(rotated.width).toBe(4);
    expect(rotated.height).toBe(5);
  });
});

describe('Historique et lecture arrière', () => {
  it('reculer après avoir avancé redonne exactement les états passés', () => {
    const world = new World();
    world.placePattern(builtinPattern('r-pentomino'), 0, 0);
    const simulation = new Simulation(world);
    const states: string[] = [];
    const describeWorld = () => {
      const list: string[] = [];
      world.forEachCell((x, y, age) => list.push(`${x},${y},${age}`));
      return `${world.generation}|${list.sort().join(' ')}`;
    };
    for (let i = 0; i < 10; i++) {
      states.push(describeWorld());
      simulation.stepForward();
    }
    for (let i = 9; i >= 0; i--) {
      expect(simulation.stepBackward()).toBe(true);
      expect(describeWorld()).toBe(states[i]);
    }
    expect(simulation.stepBackward()).toBe(false); // début atteint
  });

  it('modifier la grille efface l’avenir mémorisé', () => {
    const world = new World();
    world.placePattern(builtinPattern('glider'), 0, 0);
    const simulation = new Simulation(world);
    simulation.stepForward();
    simulation.stepForward();
    simulation.stepBackward();
    world.setCell(30, 30, true);
    simulation.markEdited();
    simulation.stepForward();
    expect(world.isAlive(30, 30)).toBe(false); // recalculé : la cellule isolée est morte
    expect(world.generation).toBe(2);
  });

  it('respecte la limite de mémoire', () => {
    const history = new History({ maxSteps: 5, maxCells: 1_000_000 });
    const world = new World();
    world.setCell(0, 0, true);
    for (let i = 0; i < 12; i++) history.pushPast(world.snapshot());
    expect(history.pastLength).toBe(5);
  });
});

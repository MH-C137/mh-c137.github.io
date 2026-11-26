/**
 * Test de l'algorithme de génération (World.step, table de voisines typée) :
 * on le compare, sur des mondes aléatoires, à un calcul NAÏF écrit autrement
 * (un ensemble de cases, 8 voisines comptées une par une, sans astuce).
 * Si la table typée se trompait (collision de hachage, case oubliée…), les deux résultats
 * différeraient dès les premières générations.
 */
import { describe, expect, it } from 'vitest';
import { WORLD_MAX, WORLD_MIN } from '../src/core/coords';
import { RULE_PRESETS } from '../src/core/rules';
import { World } from '../src/core/world';

/** Générateur pseudo-aléatoire déterministe (pour que le test donne toujours le même résultat). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

interface Naive {
  cells: Map<string, { age: number; skin: number }>;
  trace: Set<string>;
}

/** La génération suivante, calculée de la façon la plus simple possible. */
function naiveStep(state: Naive, birth: ArrayLike<unknown>, survival: ArrayLike<unknown>): Naive {
  const counts = new Map<string, number>();
  for (const key of state.cells.keys()) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighbour = `${x + dx},${y + dy}`;
        counts.set(neighbour, (counts.get(neighbour) ?? 0) + 1);
      }
    }
  }
  const next = new Map<string, { age: number; skin: number }>();
  const trace = new Set<string>();
  for (const [key, cell] of state.cells) {
    if (survival[counts.get(key) ?? 0]) next.set(key, { age: cell.age + 1, skin: cell.skin });
    else trace.add(key);
  }
  for (const [key, count] of counts) {
    if (state.cells.has(key) || !birth[count]) continue;
    // Image héritée : la plus fréquente parmi les voisines vivantes (égalité : la plus petite).
    const [x, y] = key.split(',').map(Number) as [number, number];
    const votes = new Map<number, number>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighbour = state.cells.get(`${x + dx},${y + dy}`);
        if ((dx !== 0 || dy !== 0) && neighbour) votes.set(neighbour.skin, (votes.get(neighbour.skin) ?? 0) + 1);
      }
    }
    let skin = 0;
    let best = 0;
    for (const [candidate, n] of votes) {
      if (n > best || (n === best && candidate < skin)) {
        skin = candidate;
        best = n;
      }
    }
    next.set(key, { age: 0, skin });
  }
  return { cells: next, trace };
}

/** Ce que contient un monde, sous une forme comparable. */
function readWorld(world: World): Naive {
  const cells = new Map<string, { age: number; skin: number }>();
  world.forEachCell((x, y, age, skin) => cells.set(`${x},${y}`, { age, skin }));
  const trace = new Set<string>();
  world.forEachTrace((x, y) => trace.add(`${x},${y}`));
  return { cells, trace };
}

describe('World.step comparé à un calcul naïf', () => {
  for (const { name, rule } of RULE_PRESETS) {
    it(`${name} : 40 générations sur un monde aléatoire avec images`, () => {
      const next = random(42);
      const world = new World();
      world.rule = rule;
      for (let x = -20; x < 20; x++) {
        for (let y = -20; y < 20; y++) {
          if (next() < 0.3) world.setCell(x, y, true, next() < 0.4 ? 1 + Math.floor(next() * 3) : 0);
        }
      }
      let naive = readWorld(world);
      for (let generation = 1; generation <= 40; generation++) {
        world.step();
        naive = naiveStep(naive, rule.birth, rule.survival);
        const actual = readWorld(world);
        expect(actual.cells, `génération ${generation}`).toEqual(naive.cells);
        expect(actual.trace, `trace de la génération ${generation}`).toEqual(naive.trace);
      }
    });
  }

  it('une longue ligne (beaucoup de cases dans la même rangée) ne fait pas de collisions fatales', () => {
    // Une rangée de 5000 cellules : des clés qui ne diffèrent que par x. Une mauvaise fonction de hachage les
    // entasserait toutes au même endroit. Résultat connu : les 4998 cellules du milieu (2 voisines) survivent, les 2 bouts
    // meurent, et il naît 4998 cellules au-dessus et 4998 en dessous (3 voisines) : la ligne devient 3 lignes.
    const world = new World();
    for (let x = 0; x < 5000; x++) world.setCell(x, 0, true);
    world.step();
    expect(world.population).toBe(3 * 4998);
    expect(world.isAlive(2500, -1)).toBe(true);
    expect(world.isAlive(0, 0)).toBe(false);
  });

  it('au bord du monde : pas de naissance en dehors, pas d\'erreur', () => {
    const world = new World();
    for (const dy of [0, 1, 2]) world.setCell(WORLD_MAX, WORLD_MIN + dy, true);
    expect(() => world.step()).not.toThrow();
    expect(world.population).toBeLessThanOrEqual(3);
  });
});

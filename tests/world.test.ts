/**
 * Tests du moteur : on vérifie l'algorithme sur des structures dont le
 * comportement est CONNU et documenté (LifeWiki). Si le moteur avait la
 * moindre erreur, ces résultats précis ne tomberaient pas juste.
 */
import { describe, expect, it } from 'vitest';
import { WORLD_MAX } from '../src/core/coords';
import { createPattern } from '../src/core/pattern';
import { World } from '../src/core/world';
import { builtinPattern } from '../src/data/patterns';

/** Crée un monde contenant une structure célèbre en (x, y). */
function worldWith(id: string, x = 0, y = 0): World {
  const world = new World();
  world.placePattern(builtinPattern(id), x, y);
  return world;
}

/** Liste triée des cellules vivantes, sous la forme "x,y". */
function cells(world: World): string[] {
  const list: string[] = [];
  world.forEachCell((x, y) => list.push(`${x},${y}`));
  return list.sort();
}

/** Décale une liste de cellules de (dx, dy). */
function shifted(list: string[], dx: number, dy: number): string[] {
  return list
    .map((cell) => {
      const [x, y] = cell.split(',').map(Number) as [number, number];
      return `${x + dx},${y + dy}`;
    })
    .sort();
}

function run(world: World, generations: number): void {
  for (let i = 0; i < generations; i++) world.step();
}

describe('Règles de base', () => {
  it('le bloc ne change jamais', () => {
    const world = worldWith('block');
    const before = cells(world);
    run(world, 5);
    expect(cells(world)).toEqual(before);
  });

  it('le clignotant a une période de 2', () => {
    const world = worldWith('blinker');
    const before = cells(world);
    world.step();
    expect(cells(world)).not.toEqual(before);
    world.step();
    expect(cells(world)).toEqual(before);
  });

  it('le pulsar a une période de 3', () => {
    const world = worldWith('pulsar');
    const before = cells(world);
    expect(world.population).toBe(48);
    world.step();
    expect(cells(world)).not.toEqual(before);
    run(world, 2);
    expect(cells(world)).toEqual(before);
  });

  it('le pentadécathlon a une période de 15', () => {
    const world = worldWith('pentadecathlon');
    const before = cells(world);
    run(world, 5);
    expect(cells(world)).not.toEqual(before);
    run(world, 10);
    expect(cells(world)).toEqual(before);
  });
});

describe('Vaisseaux', () => {
  it('le planeur avance d’une case en diagonale toutes les 4 générations', () => {
    const world = worldWith('glider', 10, -7);
    const before = cells(world);
    run(world, 4);
    expect(cells(world)).toEqual(shifted(before, 1, 1));
  });

  it('le vaisseau léger avance de 2 cases toutes les 4 générations', () => {
    const world = worldWith('lwss');
    const before = cells(world);
    run(world, 4);
    expect(cells(world)).toEqual(shifted(before, -2, 0)); // il file vers la gauche
  });
});

describe('Résultats célèbres (monde infini)', () => {
  it('le canon de Gosper ajoute un planeur (5 cellules) toutes les 30 générations', () => {
    const world = worldWith('gosper-gun');
    expect(world.population).toBe(36);
    run(world, 120);
    expect(world.population).toBe(36 + 4 * 5);
  });

  it('le R-pentomino se stabilise à la génération 1103 avec 116 cellules', () => {
    const world = worldWith('r-pentomino');
    run(world, 1103);
    expect(world.population).toBe(116);
  });

  it('Diehard disparaît exactement à la génération 130', () => {
    const world = worldWith('diehard');
    run(world, 129);
    expect(world.population).toBeGreaterThan(0);
    world.step();
    expect(world.population).toBe(0);
  });

  it('le gland finit avec 633 cellules à la génération 5206', { timeout: 30_000 }, () => {
    const world = worldWith('acorn');
    run(world, 5206);
    expect(world.population).toBe(633);
  });
});

describe('Les 4 états : née, vivante, vient de mourir, morte', () => {
  it('suit l’âge des cellules et la trace des mortes', () => {
    const world = worldWith('blinker'); // (0,0) (1,0) (2,0)
    world.step(); // devient vertical : (1,-1) (1,0) (1,1)
    expect(world.getAge(1, 0)).toBe(1); // le centre a survécu
    expect(world.getAge(1, -1)).toBe(0); // nouveau-né
    expect(world.getAge(0, 0)).toBe(-1); // mort
    const trace: string[] = [];
    world.forEachTrace((x, y) => trace.push(`${x},${y}`));
    expect(trace.sort()).toEqual(['0,0', '2,0']);
    expect(world.generation).toBe(1);
  });
});

describe('Images héritées', () => {
  it('une naissance prend l’image majoritaire de ses parents', () => {
    const world = new World();
    world.placePattern(createPattern([[0, 0, 5], [1, 0, 5], [2, 0, 0]]), 0, 0);
    world.step();
    expect(world.getSkin(1, -1)).toBe(5);
    expect(world.getSkin(1, 1)).toBe(5);
  });

  it('en cas d’égalité, le plus petit numéro gagne', () => {
    const world = new World();
    world.placePattern(createPattern([[0, 0, 3], [1, 0, 1], [2, 0, 2]]), 0, 0);
    world.step();
    expect(world.getSkin(1, -1)).toBe(1);
    expect(world.getSkin(1, 0)).toBe(1); // le survivant garde son image
  });
});

describe('Photos et bord du monde', () => {
  it('une photo restaure exactement l’état', () => {
    const world = worldWith('r-pentomino');
    world.setCell(40, 40, true, 7);
    run(world, 30);
    const photo = world.snapshot();
    const before = { cells: cells(world), generation: world.generation };
    run(world, 25);
    world.restore(photo);
    expect(cells(world)).toEqual(before.cells);
    expect(world.generation).toBe(before.generation);
  });

  it('aucune naissance hors du monde', () => {
    const world = new World();
    world.placePattern(createPattern([[0, 0], [0, 1], [0, 2]]), WORLD_MAX, 0); // clignotant vertical au bord
    world.step();
    expect(world.population).toBe(2); // la naissance à droite (hors monde) est bloquée
  });

  it('les opérations sur une zone (copie, effacement) fonctionnent', () => {
    const world = worldWith('glider');
    world.placePattern(builtinPattern('block'), 20, 20);
    const copy = world.extractRect({ x0: 0, y0: 0, x1: 2, y1: 2 });
    expect(copy?.cells.length).toBe(5);
    expect(world.clearRect({ x0: 15, y0: 15, x1: 30, y1: 30 })).toBe(4);
    expect(world.population).toBe(5);
  });
});

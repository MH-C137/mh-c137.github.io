/**
 * Tests de la « reprise » (core/session.ts) : la grille, les structures et la vue doivent revenir
 * exactement comme avant, et un texte abîmé ou piégé doit être refusé sans planter.
 */
import { describe, expect, it } from 'vitest';
import { WORLD_MAX } from '../src/core/coords';
import { createPattern } from '../src/core/pattern';
import { parseRle } from '../src/core/rle';
import {
  encodeRuns,
  MAX_SESSION_CELLS,
  MAX_SAVED_STRUCTURES,
  parseSession,
  saveStructure,
  serializeSession,
  SESSION_VERSION,
  snapshotFromRuns,
  type SavedSession,
} from '../src/core/session';
import { World } from '../src/core/world';
import { builtinPattern } from '../src/data/patterns';

/** Les cellules vivantes d'un monde, sous forme de texte « x,y » triées (pour comparer). */
function cellsOf(world: World): string[] {
  const out: string[] = [];
  world.forEachCell((x, y) => out.push(`${x},${y}`));
  return out.sort();
}

function sessionFor(world: World, extra: Partial<SavedSession> = {}): SavedSession {
  return {
    version: SESSION_VERSION,
    generation: world.generation,
    runs: encodeRuns(world),
    structures: [],
    camera: { x: 3.5, y: -2, zoom: 12 },
    speed: 10,
    ...extra,
  };
}

describe('plages de cellules', () => {
  it('un planeur tient en quelques plages et revient identique', () => {
    const world = new World();
    world.placePattern(builtinPattern('glider'), -3, 7);
    const runs = encodeRuns(world);
    expect(runs.length / 3).toBeLessThanOrEqual(5);
    const copy = new World();
    copy.restore(snapshotFromRuns(runs, 0));
    expect(cellsOf(copy)).toEqual(cellsOf(world));
  });

  it('un grand monde aléatoire revient identique (cellules et génération)', () => {
    let seed = 11;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const world = new World();
    for (let x = -60; x < 60; x++) for (let y = -60; y < 60; y++) if (next() < 0.35) world.setCell(x, y, true);
    for (let i = 0; i < 12; i++) world.step();
    const copy = new World();
    copy.restore(snapshotFromRuns(encodeRuns(world), world.generation));
    expect(cellsOf(copy)).toEqual(cellsOf(world));
    expect(copy.generation).toBe(12);
    expect(copy.getAge(0, 0) === -1 || copy.getAge(0, 0) === 1).toBe(true); // toutes reprennent à l'âge 1
  });

  it('une colonne pleine de 1000 cellules = une seule plage', () => {
    const world = new World();
    for (let y = 0; y < 1000; y++) world.setCell(5, y, true);
    expect(encodeRuns(world)).toEqual([5, 0, 1000]);
  });

  it('un monde vide donne aucune plage', () => {
    expect(encodeRuns(new World())).toEqual([]);
  });
});

describe('texte de session', () => {
  it('écrit puis relit exactement la même session', () => {
    const world = new World();
    world.placePattern(builtinPattern('pulsar'), 0, 0);
    const session = sessionFor(world, { structures: [saveStructure('Mon pulsar', builtinPattern('pulsar'))] });
    const text = serializeSession(session);
    expect(text).not.toBeNull();
    expect(parseSession(text)).toEqual(session);
  });

  it('une structure sauvegardée se relit identique (RLE)', () => {
    const original = createPattern([[0, 0], [2, 0], [1, 1], [5, 3]]);
    const saved = saveStructure('Test', original);
    const reread = parseRle(saved.rle).pattern;
    expect(reread.cells.map(([x, y]) => `${x},${y}`).sort()).toEqual(original.cells.map(([x, y]) => `${x},${y}`).sort());
  });

  it('refuse un monde trop grand à l\'écriture (sans planter)', () => {
    const tooMany = new Array<number>(3 * (MAX_SESSION_CELLS + 1)).fill(0);
    expect(serializeSession(sessionFor(new World(), { runs: tooMany }))).toBeNull();
  });
});

describe('texte abîmé ou piégé : toujours refusé', () => {
  const valid = JSON.parse(serializeSession(sessionFor(new World())) as string) as Record<string, unknown>;
  const refuse = (changes: Record<string, unknown>) => expect(parseSession(JSON.stringify({ ...valid, ...changes }))).toBeNull();

  it('accepte la session de référence', () => {
    expect(parseSession(JSON.stringify(valid))).not.toBeNull();
  });

  it('refuse : rien, du texte quelconque, du JSON qui n\'est pas une session', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('')).toBeNull();
    expect(parseSession('pas du json')).toBeNull();
    expect(parseSession('42')).toBeNull();
    expect(parseSession('null')).toBeNull();
    expect(parseSession('[]')).toBeNull();
  });

  it('refuse une autre version', () => refuse({ version: 2 }));
  it('refuse une génération négative ou non entière', () => {
    refuse({ generation: -1 });
    refuse({ generation: 1.5 });
    refuse({ generation: '3' });
  });
  it('refuse une vitesse absurde', () => {
    refuse({ speed: 0 });
    refuse({ speed: -5 });
    refuse({ speed: 1e9 });
  });
  it('refuse une vue absurde', () => {
    refuse({ camera: { x: 1e12, y: 0, zoom: 10 } });
    refuse({ camera: { x: 0, y: 0, zoom: 0 } });
    refuse({ camera: { x: 'a', y: 0, zoom: 10 } });
    refuse({ camera: null });
  });
  it('refuse des plages invalides', () => {
    refuse({ runs: [1, 2] }); // pas un multiple de 3
    refuse({ runs: [0, 0, 0] }); // longueur 0
    refuse({ runs: [0, 0, -4] });
    refuse({ runs: [0.5, 0, 3] });
    refuse({ runs: [0, 0, 'x'] });
    refuse({ runs: [WORLD_MAX + 5, 0, 1] }); // hors du monde
    refuse({ runs: [0, WORLD_MAX, 50] }); // déborde du monde
    refuse({ runs: [0, 0, 5_000_000] }); // trop de cellules
    refuse({ runs: 'abc' });
  });
  it('refuse des structures invalides', () => {
    refuse({ structures: 'x' });
    refuse({ structures: [{ name: 3, rle: 'o!' }] });
    refuse({ structures: [{ name: 'a', rle: 'o'.repeat(300_000) }] });
    refuse({ structures: [{ name: 'a'.repeat(200), rle: 'o!' }] });
    refuse({ structures: new Array(MAX_SAVED_STRUCTURES + 1).fill({ name: 'a', rle: 'o!' }) });
  });
  it('ne se laisse pas piéger par des clés bizarres (__proto__)', () => {
    const text = '{"version":1,"generation":0,"speed":10,"runs":[],"structures":[],"camera":{"x":0,"y":0,"zoom":10},"__proto__":{"polluted":true}}';
    expect(parseSession(text)).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

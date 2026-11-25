/**
 * Tests de la gomme à taille réglable, du clignotement, du placement des bulles et du didacticiel.
 * La logique est pure (aucun navigateur) : on vérifie des valeurs calculables à la main.
 */
import { describe, expect, it } from 'vitest';
import { squareAround } from '../src/core/coords';
import { EditHistory } from '../src/core/edithistory';
import { strokeAllows } from '../src/core/strokes';
import { isPulseAge, PULSE_PERIOD, World } from '../src/core/world';
import { TOUR_STEPS } from '../src/data/tour';
import { CHUNK, chunkStars, densityFactor, hash2, seededRandom, STAR_FIELDS } from '../src/render/constellation';
import { placePopup } from '../src/ui/placement';

describe('Carré de la gomme', () => {
  it('taille 1 : la case seule', () => {
    expect(squareAround(5, -2, 1)).toEqual({ x0: 5, y0: -2, x1: 5, y1: -2 });
  });

  it('taille impaire : centré sur la case', () => {
    expect(squareAround(10, 10, 3)).toEqual({ x0: 9, y0: 9, x1: 11, y1: 11 });
  });

  it('taille paire : dépasse d\'une case vers la droite et le bas', () => {
    expect(squareAround(10, 10, 4)).toEqual({ x0: 9, y0: 9, x1: 12, y1: 12 });
  });

  it('couvre toujours size × size cases', () => {
    for (let size = 1; size <= 15; size++) {
      const r = squareAround(0, 0, size);
      expect(r.x1 - r.x0 + 1).toBe(size);
      expect(r.y1 - r.y0 + 1).toBe(size);
    }
  });
});

describe('Clignotement', () => {
  it('une cellule clignote aux âges 3, 6, 9… mais pas à la naissance', () => {
    expect(PULSE_PERIOD).toBe(3);
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(isPulseAge)).toEqual([false, false, false, true, false, false, true, true]);
  });

  it('un clignotant (période 2) vit bien : un bloc stable clignote toutes les 3 générations', () => {
    // Bloc 2×2 : stable, donc ses cellules vieillissent d'une unité par génération.
    const world = new World();
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) world.setCell(x, y, true, 0);
    const pulses: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      pulses.push(isPulseAge(world.getAge(0, 0)));
      world.step();
    }
    // âges 0..6 → clignote aux âges 3 et 6
    expect(pulses).toEqual([false, false, false, true, false, false, true]);
  });
});

// ── Placement des bulles (infobulles et didacticiel) ────────────────────────
describe('Placement des bulles', () => {
  const viewport = { width: 1000, height: 700 };
  const popup = { width: 200, height: 100 };

  it('se pose sous l\'élément quand il y a la place', () => {
    const p = placePopup({ x: 400, y: 100, width: 40, height: 40 }, popup, viewport, ['bottom', 'top'], 10);
    expect(p).toEqual({ x: 320, y: 150, side: 'bottom' }); // centrée : 400 + 20 − 100
  });

  it('passe au-dessus quand il n\'y a pas de place dessous', () => {
    const p = placePopup({ x: 400, y: 650, width: 40, height: 40 }, popup, viewport, ['bottom', 'top'], 10);
    expect(p.side).toBe('top');
    expect(p.y).toBe(650 - 10 - 100);
  });

  it('reste dans l\'écran sur l\'autre axe (élément collé au bord)', () => {
    const p = placePopup({ x: 0, y: 100, width: 40, height: 40 }, popup, viewport, ['bottom'], 10);
    expect(p.x).toBe(8); // marge par défaut
  });

  it('côté droit : à droite de l\'élément, centrée verticalement', () => {
    const p = placePopup({ x: 20, y: 300, width: 50, height: 100 }, popup, viewport, ['right'], 12);
    expect(p).toEqual({ x: 82, y: 300, side: 'right' });
  });
});

describe('Didacticiel', () => {
  it('a 8 étapes complètes', () => {
    expect(TOUR_STEPS.length).toBe(8);
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect((step.intro ?? '').length + (step.items?.length ?? 0)).toBeGreaterThan(0);
    }
  });
});

// ── Annuler / Rétablir ──────────────────────────────────────────────────────
describe('Annuler / Rétablir', () => {
  /** Dessine une cellule en (x, 0) en enregistrant l'état d'avant, comme le fait l'éditeur. */
  function draw(world: World, edits: EditHistory, x: number): void {
    edits.record(world.snapshot());
    world.setCell(x, 0, true, 0);
  }

  it('annule puis rétablit deux modifications dans le bon ordre', () => {
    const world = new World();
    const edits = new EditHistory();
    draw(world, edits, 1);
    draw(world, edits, 2);
    expect(world.population).toBe(2);

    world.restore(edits.undo(world.snapshot())!); // annule la cellule 2
    expect([world.isAlive(1, 0), world.isAlive(2, 0)]).toEqual([true, false]);
    world.restore(edits.undo(world.snapshot())!); // annule la cellule 1
    expect(world.population).toBe(0);
    expect(edits.canUndo).toBe(false);

    world.restore(edits.redo(world.snapshot())!); // rétablit la cellule 1
    world.restore(edits.redo(world.snapshot())!); // rétablit la cellule 2
    expect([world.isAlive(1, 0), world.isAlive(2, 0)]).toEqual([true, true]);
    expect(edits.canRedo).toBe(false);
  });

  it('une nouvelle modification vide « rétablir »', () => {
    const world = new World();
    const edits = new EditHistory();
    draw(world, edits, 1);
    world.restore(edits.undo(world.snapshot())!);
    expect(edits.canRedo).toBe(true);
    draw(world, edits, 5);
    expect(edits.canRedo).toBe(false);
  });

  it('ne garde que les dernières modifications (limite)', () => {
    const world = new World();
    const edits = new EditHistory({ maxSteps: 3, maxCells: 1000 });
    for (let x = 0; x < 10; x++) draw(world, edits, x);
    let undone = 0;
    while (edits.canUndo) {
      world.restore(edits.undo(world.snapshot())!);
      undone++;
    }
    expect(undone).toBe(3);
    expect(world.population).toBe(7); // les 7 premières cellules ne peuvent plus être annulées
  });

  it('annuler sans rien à annuler ne fait rien', () => {
    expect(new EditHistory().undo(new World().snapshot())).toBeNull();
  });
});

// ── Types de trait ──────────────────────────────────────────────────────────
describe('Types de trait', () => {
  /** Compte les cases remplies dans un rectangle w × h dont le coin est (0, 0). */
  const count = (kind: Parameters<typeof strokeAllows>[0], w: number, h: number) => {
    let n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (strokeAllows(kind, x, y)) n++;
    return n;
  };

  it('damier 17 × 5 : lignes de 9, 8, 9, 8, 9 cellules (= 43)', () => {
    const row = (y: number) => count('checker', 17, 1 + y) - count('checker', 17, y);
    expect([0, 1, 2, 3, 4].map(row)).toEqual([9, 8, 9, 8, 9]);
    expect(count('checker', 17, 5)).toBe(43);
  });

  it('plein, lignes, colonnes et points', () => {
    expect(count('solid', 4, 4)).toBe(16);
    expect(count('rows', 4, 4)).toBe(8);
    expect(count('columns', 4, 4)).toBe(8);
    expect(count('dots', 4, 4)).toBe(4);
  });

  it('marche aussi avec des coordonnées négatives (pas de décalage au passage de 0)', () => {
    expect(strokeAllows('checker', -1, 0)).toBe(false);
    expect(strokeAllows('checker', -1, -1)).toBe(true);
    expect(strokeAllows('rows', 0, -2)).toBe(true);
    expect(strokeAllows('rows', 0, -1)).toBe(false);
  });

  it('spray : même résultat à chaque fois, et environ 35 % de cases', () => {
    expect(strokeAllows('spray', 12, -7)).toBe(strokeAllows('spray', 12, -7));
    const share = count('spray', 100, 100) / 10000;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.4);
  });
});

// ── Constellation (fond d'étoiles fixe dans le monde) ───────────────────────
describe('Constellation', () => {
  const chunks = (n: number) =>
    Array.from({ length: n * n }, (_, k) => [Math.floor(k / n) - n / 2, (k % n) - n / 2] as const);

  it('un carré du ciel est toujours le même (même place = mêmes étoiles)', () => {
    expect(chunkStars(3, -2, 1, 7)).toEqual(chunkStars(3, -2, 1, 7));
    expect(chunkStars(3, -2, 1, 7)).not.toEqual(chunkStars(4, -2, 1, 7));
    expect(chunkStars(3, -2, 1, 7)).not.toEqual(chunkStars(3, -2, 1, 8)); // une autre graine = un autre ciel
    expect(hash2(5, 9, 1)).toBe(hash2(5, 9, 1));
    expect(hash2(5, 9, 1)).not.toBe(hash2(9, 5, 1));
    const random = seededRandom(7);
    expect(Array.from({ length: 1000 }, random).every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('toutes les étoiles d\'un carré sont dans ce carré (aucune couture)', () => {
    for (const [cx, cy] of [[0, 0], [-1, -1], [5, -3]] as const) {
      const stars = chunkStars(cx, cy, 1.5, 11);
      for (let i = 0; i < stars.length; i += STAR_FIELDS) {
        expect(stars[i]!).toBeGreaterThanOrEqual(cx * CHUNK);
        expect(stars[i]!).toBeLessThan((cx + 1) * CHUNK);
        expect(stars[i + 1]!).toBeGreaterThanOrEqual(cy * CHUNK);
        expect(stars[i + 1]!).toBeLessThan((cy + 1) * CHUNK);
      }
    }
  });

  it('la densité règle la quantité d\'étoiles', () => {
    for (const [cx, cy] of [[0, 0], [2, 7], [-4, 3]] as const) {
      const one = chunkStars(cx, cy, 1, 5).length / STAR_FIELDS;
      const two = chunkStars(cx, cy, 2, 5).length / STAR_FIELDS;
      expect(Math.abs(two - 2 * one)).toBeLessThanOrEqual(1); // à l'arrondi près
    }
  });

  it('il y a des amas et des vides, avec des transitions douces', () => {
    const factors = chunks(20).map(([cx, cy]) => densityFactor(cx, cy, 2024));
    expect(Math.min(...factors)).toBeLessThan(0.6); // des zones presque vides
    expect(Math.max(...factors)).toBeGreaterThan(1.6); // des amas
    const mean = factors.reduce((a, b) => a + b, 0) / factors.length;
    expect(mean).toBeGreaterThan(0.6);
    expect(mean).toBeLessThan(1.4);
    // Deux carrés voisins se ressemblent (bruit lisse, pas du hasard pur) : écart moyen faible.
    let gap = 0;
    for (let cx = 0; cx < 30; cx++) gap += Math.abs(densityFactor(cx + 1, 0, 2024) - densityFactor(cx, 0, 2024));
    expect(gap / 30).toBeLessThan(0.6);
  });

  it('beaucoup de poussière, peu de grosses étoiles', () => {
    let dust = 0;
    let big = 0;
    let total = 0;
    for (const [cx, cy] of chunks(10)) {
      const stars = chunkStars(cx, cy, 1, 2024);
      for (let i = 0; i < stars.length; i += STAR_FIELDS) {
        total++;
        if (stars[i + 2]! < 0.12) dust++;
        if (stars[i + 2]! >= 0.55) big++;
      }
    }
    expect(dust / total).toBeGreaterThan(0.6);
    expect(big).toBeGreaterThan(0);
    expect(big / total).toBeLessThan(0.08);
  });
});

/**
 * Tests de la gomme à taille réglable et du clignotement des cellules.
 * La logique est pure (aucun navigateur) : on vérifie des valeurs calculables à la main.
 */
import { describe, expect, it } from 'vitest';
import { squareAround } from '../src/core/coords';
import { isPulseAge, PULSE_PERIOD, World } from '../src/core/world';

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

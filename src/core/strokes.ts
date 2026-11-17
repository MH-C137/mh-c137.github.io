/**
 * ============================================================================
 *  strokes.ts — Les types de trait du crayon (plein, damier, points…)
 * ============================================================================
 *
 * Un « type de trait » décide, pour chaque case touchée par le crayon, si on y
 * pose vraiment une cellule. Le test se fait sur la position ABSOLUE de la case
 * (pas sur sa place dans le trait) : deux traits qui se croisent forment donc le
 * même motif, sans décalage.
 *
 *   plein     toutes les cases            ■■■■■
 *   damier    une case sur deux           ■□■□■ / □■□■□   (x + y pair)
 *   points    une ligne et colonne sur 2  ■□■□■ / □□□□□
 *   lignes    une ligne sur deux          ■■■■■ / □□□□□
 *   colonnes  une colonne sur deux        ■□■□■ / ■□■□■
 *   spray     au hasard (environ 35 %)    comme une bombe de peinture
 *
 * Le « hasard » du spray est un mélange déterministe des coordonnées : la même
 * case donne toujours le même résultat (pas de scintillement, et c'est testable).
 */

export type StrokeKind = 'solid' | 'checker' | 'dots' | 'rows' | 'columns' | 'spray';

export interface StrokeInfo {
  readonly id: StrokeKind;
  /** Nom affiché (infobulle). */
  readonly label: string;
}

export const STROKES: readonly StrokeInfo[] = [
  { id: 'solid', label: 'Plein' },
  { id: 'checker', label: 'Damier' },
  { id: 'dots', label: 'Points' },
  { id: 'rows', label: 'Lignes' },
  { id: 'columns', label: 'Colonnes' },
  { id: 'spray', label: 'Spray' },
];

/** Proportion de cases remplies par le spray. */
const SPRAY_PERCENT = 35;

/** Vrai si le trait de ce type pose une cellule sur la case (x, y). */
export function strokeAllows(kind: StrokeKind, x: number, y: number): boolean {
  switch (kind) {
    case 'solid':
      return true;
    case 'checker':
      return (((x + y) % 2) + 2) % 2 === 0; // le « +2 … % 2 » gère aussi les coordonnées négatives
    case 'dots':
      return Math.abs(x) % 2 === 0 && Math.abs(y) % 2 === 0;
    case 'rows':
      return Math.abs(y) % 2 === 0;
    case 'columns':
      return Math.abs(x) % 2 === 0;
    case 'spray': {
      // Mélange de bits (deux grands nombres premiers) → nombre pseudo-aléatoire stable.
      const hash = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
      return hash % 100 < SPRAY_PERCENT;
    }
  }
}

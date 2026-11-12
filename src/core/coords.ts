/**
 * ============================================================================
 *  coords.ts — Coordonnées des cellules et « clés » numériques
 * ============================================================================
 *
 * Le monde est une grille quasi infinie, mais on ne stocke que les cellules
 * VIVANTES (voir world.ts). Pour retrouver très vite une cellule, on la range
 * dans une table de hachage (`Map`) indexée par une CLÉ : un seul nombre qui
 * encode le couple (x, y).
 *
 * Encodage :   clé = (x + DECALAGE) × LARGEUR + (y + DECALAGE)
 *
 *   - DECALAGE (2^25) rend x et y positifs (les coordonnées peuvent être négatives).
 *   - LARGEUR  (2^26) est le nombre de valeurs possibles pour y.
 *
 * C'est exactement comme numéroter les cases d'un tableau colonne par colonne.
 * La plus grande clé possible vaut environ 2^52, ce qui reste sous 2^53 : les
 * nombres JavaScript (flottants 64 bits) représentent EXACTEMENT tous les
 * entiers jusqu'à 2^53, donc l'encodage est sans perte.
 *
 * Avantage clé : la voisine (x + dx, y + dy) a pour clé  clé + dx × LARGEUR + dy.
 * On obtient donc les 8 voisines par de simples ADDITIONS, sans rien décoder.
 *
 * Le monde mesure 2^26 × 2^26 cases (≈ 67 millions de cases de côté). Un planeur
 * avance d'une case toutes les 4 générations : il lui faudrait plus de
 * 100 millions de générations pour atteindre le bord. D'où « quasi infini ».
 */

/** Décalage ajouté aux coordonnées pour les rendre positives. */
const OFFSET = 2 ** 25;

/** Nombre de valeurs possibles pour y (et donc « largeur » d'une colonne de clés). */
const SPAN = 2 ** 26;

/**
 * Bornes du monde (incluses). On garde une case de marge sur chaque bord pour
 * que les voisines d'une cellule vivante aient toujours une clé valide.
 */
export const WORLD_MIN = -OFFSET + 1;
export const WORLD_MAX = OFFSET - 2;

/**
 * Les 8 décalages de clé qui mènent aux 8 voisines d'une cellule
 * (haut-gauche, haut, haut-droite, gauche, droite, bas-gauche, bas, bas-droite).
 * Calculés une seule fois : dx × LARGEUR + dy.
 */
export const NEIGHBOR_DELTAS: readonly number[] = (() => {
  const deltas: number[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx !== 0 || dy !== 0) deltas.push(dx * SPAN + dy);
    }
  }
  return deltas;
})();

/** Transforme une position (x, y) en clé unique. */
export function toKey(x: number, y: number): number {
  return (x + OFFSET) * SPAN + (y + OFFSET);
}

/** Retrouve la coordonnée x à partir d'une clé (division entière). */
export function keyX(key: number): number {
  return Math.floor(key / SPAN) - OFFSET;
}

/** Retrouve la coordonnée y à partir d'une clé (reste de la division). */
export function keyY(key: number): number {
  return (key % SPAN) - OFFSET;
}

/** Vrai si la position (x, y) est dans le monde (hors marge de sécurité). */
export function isInsideWorld(x: number, y: number): boolean {
  return x >= WORLD_MIN && x <= WORLD_MAX && y >= WORLD_MIN && y <= WORLD_MAX;
}

/** Même test que `isInsideWorld`, mais à partir d'une clé. */
export function isKeyInsideWorld(key: number): boolean {
  return isInsideWorld(keyX(key), keyY(key));
}

/** Un rectangle de cellules, bornes INCLUSES : de (x0, y0) à (x1, y1). */
export interface CellRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Construit un rectangle à partir de deux coins quelconques (dans n'importe quel ordre). */
export function rectFromCorners(ax: number, ay: number, bx: number, by: number): CellRect {
  return {
    x0: Math.min(ax, bx),
    y0: Math.min(ay, by),
    x1: Math.max(ax, bx),
    y1: Math.max(ay, by),
  };
}

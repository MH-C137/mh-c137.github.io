/**
 * ============================================================================
 *  pattern.ts — Les « structures » (motifs) : planeur, canon, copie de sélection…
 * ============================================================================
 *
 * Une structure est un petit dessin de cellules vivantes, indépendant de sa
 * position dans le monde. Ses coordonnées sont RELATIVES : la case en haut à
 * gauche du rectangle qui l'entoure est (0, 0).
 *
 * Chaque cellule porte aussi un numéro d'« habillage » (skin) : 0 = forme néon
 * par défaut, sinon le numéro d'une image de la bibliothèque (voir images.ts).
 *
 * Les transformations (rotation, miroir) sont de simples formules appliquées à
 * chaque cellule : ce sont des changements de repère, comme en géométrie.
 */

/** Une cellule d'une structure : [x, y, habillage]. */
export type PatternCell = readonly [x: number, y: number, skin: number];

export interface Pattern {
  /** Largeur du rectangle englobant (en cases). */
  readonly width: number;
  /** Hauteur du rectangle englobant (en cases). */
  readonly height: number;
  /** Les cellules vivantes, en coordonnées relatives (0 ≤ x < width, 0 ≤ y < height). */
  readonly cells: readonly PatternCell[];
}

/**
 * Crée une structure à partir d'une liste de cellules quelconques.
 *
 * Algorithme de « normalisation » : on cherche le plus petit x et le plus petit y,
 * puis on décale toutes les cellules pour que ce coin devienne (0, 0). La largeur
 * et la hauteur se déduisent des plus grands x et y. Les doublons sont supprimés.
 */
export function createPattern(cells: ReadonlyArray<readonly [number, number, number?]>): Pattern {
  if (cells.length === 0) return { width: 0, height: 0, cells: [] };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const seen = new Set<string>();
  const normalized: PatternCell[] = [];
  for (const [x, y, skin] of cells) {
    const id = `${x},${y}`;
    if (seen.has(id)) continue; // une même case ne peut être vivante qu'une fois
    seen.add(id);
    normalized.push([x - minX, y - minY, skin ?? 0]);
  }
  return { width: maxX - minX + 1, height: maxY - minY + 1, cells: normalized };
}

/**
 * Rotation d'un quart de tour dans le sens des aiguilles d'une montre.
 *
 * À l'écran l'axe y descend. Une rotation horaire envoie le coin haut-gauche
 * en haut-droite, le coin haut-droite en bas-droite, etc. La formule est :
 *     (x, y)  →  (hauteur − 1 − y,  x)
 * et la largeur et la hauteur s'échangent.
 */
export function rotateClockwise(pattern: Pattern): Pattern {
  return {
    width: pattern.height,
    height: pattern.width,
    cells: pattern.cells.map(([x, y, skin]) => [pattern.height - 1 - y, x, skin] as const),
  };
}

/** Miroir gauche ↔ droite : (x, y) → (largeur − 1 − x, y). */
export function flipHorizontal(pattern: Pattern): Pattern {
  return {
    width: pattern.width,
    height: pattern.height,
    cells: pattern.cells.map(([x, y, skin]) => [pattern.width - 1 - x, y, skin] as const),
  };
}

/** Renvoie une copie de la structure où TOUTES les cellules portent l'habillage donné. */
export function withSkin(pattern: Pattern, skin: number): Pattern {
  return { ...pattern, cells: pattern.cells.map(([x, y]) => [x, y, skin] as const) };
}

/** Vrai si au moins une cellule de la structure porte une image. */
export function hasSkins(pattern: Pattern): boolean {
  return pattern.cells.some(([, , skin]) => skin !== 0);
}

/**
 * ============================================================================
 *  line.ts — Tracer une ligne continue de cases (algorithme de Bresenham)
 * ============================================================================
 *
 * Problème : quand on dessine vite avec la souris, le navigateur ne signale la
 * position que de temps en temps (environ 60 fois par seconde). Entre deux
 * positions, la souris a pu sauter plusieurs cases : sans précaution, le trait
 * serait en pointillés.
 *
 * Solution : relier la case précédente à la case actuelle par une ligne de
 * cases, avec l'algorithme de Bresenham (1962), conçu à l'origine pour les
 * traceurs à plume. Il n'utilise que des additions d'entiers :
 *   - on avance pas à pas de la case de départ vers la case d'arrivée ;
 *   - une variable « erreur » mesure l'écart entre la vraie droite et les cases
 *     choisies ; selon son signe, on avance en x, en y, ou dans les deux (diagonale).
 * Chaque case visitée touche la précédente : le trait est continu.
 */

export function cellsOnLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visit: (x: number, y: number) => void,
): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    visit(x, y);
    if (x === x1 && y === y1) return;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

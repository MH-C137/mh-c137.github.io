/**
 * ============================================================================
 *  placement.ts — Où poser une bulle (infobulle, étape du didacticiel) ?
 * ============================================================================
 *
 * Fonction PURE (aucun accès à la page) : on lui donne les rectangles, elle
 * rend une position. Ça la rend simple à tester, et les deux bulles du site
 * (infobulles et didacticiel) s'en servent.
 *
 * Idée : on essaie les côtés de l'élément visé dans l'ordre de préférence
 * (ex. dessous, puis dessus, puis à droite…). Le premier côté où la bulle
 * tient ENTIÈREMENT dans l'écran gagne. Sur l'autre axe, la bulle est centrée
 * sur l'élément puis « recalée » pour ne pas dépasser de l'écran.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Placement {
  readonly x: number;
  readonly y: number;
  /** Côté choisi (par rapport à l'élément visé). */
  readonly side: Side;
}

/** Ramène `value` entre `min` et `max` (si l'intervalle est trop petit, `min` gagne). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Calcule le coin haut-gauche de la bulle.
 * @param target   rectangle de l'élément visé, en pixels écran
 * @param popup    taille de la bulle
 * @param viewport taille de l'écran
 * @param sides    côtés essayés, du préféré au dernier recours
 * @param gap      espace entre l'élément et la bulle
 * @param margin   marge à garder par rapport au bord de l'écran
 */
export function placePopup(
  target: Box,
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
  sides: readonly Side[] = ['bottom', 'top', 'right', 'left'],
  gap = 12,
  margin = 8,
): Placement {
  const candidates = sides.map((side): Placement => {
    // Position sur l'axe « principal » (à côté de l'élément) …
    // … et sur l'axe « secondaire » (centrée sur l'élément, puis recalée dans l'écran).
    const centeredX = target.x + target.width / 2 - popup.width / 2;
    const centeredY = target.y + target.height / 2 - popup.height / 2;
    const x =
      side === 'left'
        ? target.x - gap - popup.width
        : side === 'right'
          ? target.x + target.width + gap
          : clamp(centeredX, margin, viewport.width - margin - popup.width);
    const y =
      side === 'top'
        ? target.y - gap - popup.height
        : side === 'bottom'
          ? target.y + target.height + gap
          : clamp(centeredY, margin, viewport.height - margin - popup.height);
    return { x, y, side };
  });

  const fits = (p: Placement) =>
    p.x >= margin &&
    p.y >= margin &&
    p.x + popup.width <= viewport.width - margin &&
    p.y + popup.height <= viewport.height - margin;

  const best = candidates.find(fits) ?? candidates[0]!;
  // Dernier recours : aucun côté ne tient, on garde le préféré mais on le ramène dans l'écran.
  return {
    side: best.side,
    x: clamp(best.x, margin, viewport.width - margin - popup.width),
    y: clamp(best.y, margin, viewport.height - margin - popup.height),
  };
}

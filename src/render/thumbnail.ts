/**
 * ============================================================================
 *  thumbnail.ts — Miniatures des structures (cartes du panneau de droite)
 * ============================================================================
 *
 * Pour dessiner une structure dans un petit carré, on calcule la taille de case
 * qui la fait tenir en entier (la plus petite des deux contraintes : largeur et
 * hauteur), puis on la centre.
 */

import type { Pattern } from '../core/pattern';
import { CORNER_RATIO, roundedRectPath } from './images';
import type { Palette } from './theme';

export function drawPatternThumbnail(canvas: HTMLCanvasElement, pattern: Pattern, palette: Palette): void {
  const cssSize = canvas.clientWidth || 56;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssSize * ratio);
  canvas.height = Math.round(cssSize * ratio);
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, cssSize, cssSize);

  const padding = 4;
  const cell = Math.min(
    (cssSize - 2 * padding) / pattern.width,
    (cssSize - 2 * padding) / pattern.height,
    cssSize / 4, // les toutes petites structures ne deviennent pas énormes
  );
  const offsetX = (cssSize - pattern.width * cell) / 2;
  const offsetY = (cssSize - pattern.height * cell) / 2;
  const inset = cell >= 4 ? cell * 0.08 : 0;
  const size = cell - 2 * inset;

  const path = new Path2D();
  for (const [x, y] of pattern.cells) {
    const sx = offsetX + x * cell + inset;
    const sy = offsetY + y * cell + inset;
    if (cell >= 4) roundedRectPath(path, sx, sy, size, size, size * CORNER_RATIO);
    else path.rect(sx, sy, size, size);
  }
  context.fillStyle = palette.newborn;
  context.fill(path);
}

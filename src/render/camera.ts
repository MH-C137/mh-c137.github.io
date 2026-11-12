/**
 * ============================================================================
 *  camera.ts — La caméra : quelle partie du monde voit-on, et à quel zoom ?
 * ============================================================================
 *
 * Deux systèmes de coordonnées cohabitent :
 *   - les coordonnées MONDE  : en cases (la cellule (3, -2), par exemple) ;
 *   - les coordonnées ÉCRAN  : en pixels, (0, 0) en haut à gauche de la fenêtre.
 *
 * La caméra est définie par :
 *   - (centerX, centerY) : le point du monde affiché AU CENTRE de l'écran ;
 *   - zoom               : la taille d'une case en pixels (zoom 20 = cases de 20 px).
 *
 * Les deux formules de conversion (l'une est l'inverse de l'autre) :
 *     écranX = (mondeX − centerX) × zoom + largeur / 2
 *     mondeX = (écranX − largeur / 2) / zoom + centerX
 * (même chose pour y avec la hauteur).
 *
 * Zoomer « vers la souris » : le point du monde sous le curseur doit rester sous
 * le curseur. On mémorise ce point, on change le zoom, puis on recale le centre
 * pour que la formule redonne la même position écran (voir `zoomAt`).
 */

import { Emitter } from '../core/events';
import type { CellRect } from '../core/coords';

/** Zoom minimal : 4 cases par pixel (vue d'ensemble). */
export const MIN_ZOOM = 0.25;
/** Zoom maximal : une case fait 96 pixels. */
export const MAX_ZOOM = 96;

/** Marges (en pixels) occupées par l'interface sur chaque bord de l'écran. */
export interface Insets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const DEFAULT_INSETS: Insets = { left: 80, right: 80, top: 80, bottom: 80 };

export class Camera extends Emitter<{ change: void }> {
  centerX = 0;
  centerY = 0;
  zoom = 16;
  /** Taille de la zone d'affichage, en pixels CSS. */
  width = 0;
  height = 0;

  /** Appelée quand la fenêtre change de taille. */
  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.emit('change', undefined);
  }

  worldToScreenX(worldX: number): number {
    return (worldX - this.centerX) * this.zoom + this.width / 2;
  }

  worldToScreenY(worldY: number): number {
    return (worldY - this.centerY) * this.zoom + this.height / 2;
  }

  /** Position du monde (en cases, avec décimales) sous un point de l'écran. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.width / 2) / this.zoom + this.centerX,
      y: (screenY - this.height / 2) / this.zoom + this.centerY,
    };
  }

  /** Case (coordonnées entières) sous un point de l'écran. */
  screenToCell(screenX: number, screenY: number): { x: number; y: number } {
    const world = this.screenToWorld(screenX, screenY);
    return { x: Math.floor(world.x), y: Math.floor(world.y) };
  }

  /** Déplace la vue d'un certain nombre de pixels (utilisé par l'outil « main »). */
  panBy(deltaScreenX: number, deltaScreenY: number): void {
    // Faire glisser le monde vers la droite = regarder plus à gauche : d'où le signe « − ».
    this.centerX -= deltaScreenX / this.zoom;
    this.centerY -= deltaScreenY / this.zoom;
    this.emit('change', undefined);
  }

  /**
   * Multiplie le zoom par `factor` en gardant fixe le point de l'écran (screenX, screenY).
   *
   * 1. On note le point du monde P actuellement sous (screenX, screenY).
   * 2. On applique le nouveau zoom (borné entre MIN_ZOOM et MAX_ZOOM).
   * 3. On choisit le nouveau centre pour que P retombe sous (screenX, screenY) :
   *       centerX = P.x − (screenX − largeur/2) / nouveauZoom
   */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const anchor = this.screenToWorld(screenX, screenY);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    this.centerX = anchor.x - (screenX - this.width / 2) / this.zoom;
    this.centerY = anchor.y - (screenY - this.height / 2) / this.zoom;
    this.emit('change', undefined);
  }

  /** Fixe le zoom à une valeur précise, en zoomant vers le centre de l'écran. */
  setZoom(zoom: number): void {
    this.zoomAt(this.width / 2, this.height / 2, zoom / this.zoom);
  }

  /**
   * Cadre un rectangle de cellules : choisit le zoom qui le fait tenir en entier,
   * puis le centre dans la zone d'écran laissée libre par les panneaux (`insets`).
   */
  fitRect(rect: CellRect, insets: Insets = DEFAULT_INSETS, maxZoom = 24): void {
    const cellsWide = rect.x1 - rect.x0 + 1;
    const cellsHigh = rect.y1 - rect.y0 + 1;
    const usableWidth = Math.max(100, this.width - insets.left - insets.right);
    const usableHeight = Math.max(100, this.height - insets.top - insets.bottom);
    const zoom = Math.min(usableWidth / cellsWide, usableHeight / cellsHigh, maxZoom);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    // Le centre de la zone libre est décalé par rapport au centre de l'écran
    // quand les panneaux ne sont pas symétriques : on compense ce décalage.
    const freeCenterX = insets.left + usableWidth / 2;
    const freeCenterY = insets.top + usableHeight / 2;
    this.centerX = rect.x0 + cellsWide / 2 - (freeCenterX - this.width / 2) / this.zoom;
    this.centerY = rect.y0 + cellsHigh / 2 - (freeCenterY - this.height / 2) / this.zoom;
    this.emit('change', undefined);
  }

  /** Rectangle des cases (au moins partiellement) visibles à l'écran. */
  visibleCells(): CellRect {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.width, this.height);
    return {
      x0: Math.floor(topLeft.x),
      y0: Math.floor(topLeft.y),
      x1: Math.floor(bottomRight.x),
      y1: Math.floor(bottomRight.y),
    };
  }
}

/**
 * Curseurs « logarithmiques » : un slider va de 0 à 100, mais le zoom (ou la
 * vitesse) doit varier par MULTIPLICATIONS (×2, ×2…) pour paraître régulier à
 * l'œil. On utilise donc une échelle exponentielle :
 *     valeur = min × (max / min)^(position / 100)
 * et sa réciproque avec un logarithme.
 */
export function sliderToValue(position: number, min: number, max: number): number {
  return min * Math.pow(max / min, position / 100);
}

export function valueToSlider(value: number, min: number, max: number): number {
  return (100 * Math.log(value / min)) / Math.log(max / min);
}

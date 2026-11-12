/**
 * ============================================================================
 *  renderer.ts — Le dessin de la grille dans un <canvas>
 * ============================================================================
 *
 * Pourquoi un canvas et pas une <div> par cellule ? Une page web supporte mal
 * des dizaines de milliers d'éléments HTML qui changent 60 fois par seconde.
 * Le canvas est une simple surface de pixels sur laquelle on peint nous-mêmes :
 * c'est l'équivalent du `paintComponent(Graphics g)` de Java Swing.
 *
 * Ordre de dessin d'une image (du fond vers le dessus) :
 *   1. le fond (cases mortes) ;
 *   2. la grille (seulement si on est assez zoomé pour qu'elle soit utile) ;
 *   3. les cellules : trace → vivantes → nées → images ;
 *   4. les « calques » d'interaction : case survolée, sélection, aperçu de structure.
 *
 * Optimisations simples (et importantes) :
 *   - on ne dessine que les cases VISIBLES (test de position = « culling ») ;
 *   - on regroupe toutes les cases d'une même couleur dans un seul chemin (Path2D),
 *     puis on le remplit en une seule fois : un seul ordre de dessin au lieu de milliers ;
 *   - quand les cases sont minuscules (dézoom), on dessine de simples carrés,
 *     sans coins arrondis ni espacement (invisibles à cette taille de toute façon).
 */

import type { CellRect } from '../core/coords';
import type { Pattern } from '../core/pattern';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { CORNER_RATIO, roundedRectPath, type ImageLibrary } from './images';
import { PALETTES, type Palette } from './theme';

/** Ce qui se superpose à la grille pendant l'édition (rempli par l'éditeur). */
export interface Overlay {
  /** Rectangle sélectionné (outil Sélection). */
  selection: CellRect | null;
  /** Aperçu d'une structure avant de la poser : coin haut-gauche en (x, y). */
  ghost: { pattern: Pattern; x: number; y: number } | null;
  /** Case sous le pointeur (pinceau = dessiner, gomme = effacer). */
  hover: { x: number; y: number; mode: 'draw' | 'erase' } | null;
}

/** En dessous de cette taille de case (en px), on dessine des carrés simples. */
const SHAPES_MIN_ZOOM = 4;
/** En dessous de cette taille de case, les images sont remplacées par leur couleur moyenne. */
const IMAGES_MIN_ZOOM = 10;

/** Dimensions d'une cellule à l'écran pour un zoom donné. */
interface CellGeometry {
  /** Marge entre le bord de la case et la forme (l'espace qui sépare les cellules). */
  inset: number;
  /** Côté de la forme. */
  size: number;
  /** Rayon des coins arrondis. */
  radius: number;
  /** Faux = carrés simples (dézoom). */
  shapes: boolean;
}

function geometryFor(zoom: number): CellGeometry {
  if (zoom < SHAPES_MIN_ZOOM) {
    return { inset: 0, size: Math.max(zoom, 1), radius: 0, shapes: false };
  }
  const inset = Math.max(0.75, zoom * 0.08);
  const size = zoom - 2 * inset;
  return { inset, size, radius: size * CORNER_RATIO, shapes: true };
}

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  /** Pixels physiques par pixel CSS (2 sur un écran « Retina »). */
  private pixelRatio = 1;
  palette: Palette = PALETTES.night;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly world: World,
    private readonly images: ImageLibrary,
  ) {
    this.context = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
  }

  /**
   * Adapte la taille du canvas à la fenêtre.
   * Sur un écran haute densité, on crée un canvas avec plus de pixels réels
   * (taille CSS × pixelRatio) puis on agrandit le repère de dessin d'autant :
   * on continue à dessiner en pixels CSS, mais le résultat reste net.
   */
  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.camera.setViewport(width, height);
  }

  /** Dessine une image complète (appelée par la boucle principale quand quelque chose a changé). */
  render(overlay: Overlay): void {
    const context = this.context;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.fillStyle = this.palette.background;
    context.fillRect(0, 0, this.camera.width, this.camera.height);

    this.drawGrid();
    this.drawCells();
    if (overlay.hover) this.drawHover(overlay.hover);
    if (overlay.selection) this.drawSelection(overlay.selection);
    if (overlay.ghost) this.drawGhost(overlay.ghost);
  }

  /**
   * La grille : des lignes fines entre les cases, et une ligne plus visible
   * toutes les 10 cases (pratique pour compter). Les lignes apparaissent
   * progressivement quand on zoome (transparence proportionnelle au zoom).
   */
  private drawGrid(): void {
    const { camera, context, palette } = this;
    const zoom = camera.zoom;
    const view = camera.visibleCells();
    const minorAlpha = clamp01((zoom - 8) / 8);
    const majorAlpha = clamp01((zoom - 3) / 4);
    if (majorAlpha === 0) return;

    // Aligne une coordonnée sur un pixel physique pour des lignes nettes de 1 pixel.
    const crisp = (value: number) =>
      (Math.round(value * this.pixelRatio) + 0.5) / this.pixelRatio;
    const minor = new Path2D();
    const major = new Path2D();
    for (let x = view.x0; x <= view.x1 + 1; x++) {
      const sx = crisp(camera.worldToScreenX(x));
      const path = x % 10 === 0 ? major : minor;
      path.moveTo(sx, 0);
      path.lineTo(sx, camera.height);
    }
    for (let y = view.y0; y <= view.y1 + 1; y++) {
      const sy = crisp(camera.worldToScreenY(y));
      const path = y % 10 === 0 ? major : minor;
      path.moveTo(0, sy);
      path.lineTo(camera.width, sy);
    }
    context.lineWidth = 1 / this.pixelRatio;
    if (minorAlpha > 0) {
      context.globalAlpha = minorAlpha;
      context.strokeStyle = palette.grid;
      context.stroke(minor);
    }
    context.globalAlpha = majorAlpha;
    context.strokeStyle = palette.gridMajor;
    context.stroke(major);
    context.globalAlpha = 1;
  }

  /** Les cellules : on trie chaque case visible dans le bon « paquet » de couleur. */
  private drawCells(): void {
    const { camera, context, palette, world, images } = this;
    const zoom = camera.zoom;
    const view = camera.visibleCells();
    const geometry = geometryFor(zoom);
    const halfWidth = camera.width / 2;
    const halfHeight = camera.height / 2;
    const showImages = zoom >= IMAGES_MIN_ZOOM;

    const tracePath = new Path2D();
    const alivePath = new Path2D();
    const newbornPath = new Path2D();
    /** Cellules à image vues de loin : un chemin par couleur moyenne. */
    const averagePaths = new Map<string, Path2D>();
    /** Cellules à image vues de près : dessinées une par une ensuite. */
    const tiles: Array<{ sx: number; sy: number; tile: HTMLCanvasElement; newborn: boolean }> = [];

    const isVisible = (x: number, y: number) =>
      x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;
    const screenX = (x: number) => (x - camera.centerX) * zoom + halfWidth;
    const screenY = (y: number) => (y - camera.centerY) * zoom + halfHeight;

    world.forEachTrace((x, y) => {
      if (isVisible(x, y)) addCellShape(tracePath, screenX(x), screenY(y), geometry);
    });

    world.forEachCell((x, y, age, skin) => {
      if (!isVisible(x, y)) return;
      const sx = screenX(x);
      const sy = screenY(y);
      const image = skin !== 0 ? images.get(skin) : undefined;
      if (image) {
        if (showImages) {
          tiles.push({ sx, sy, tile: image.tile, newborn: age === 0 });
          return;
        }
        if (age > 0) {
          let path = averagePaths.get(image.averageColor);
          if (!path) {
            path = new Path2D();
            averagePaths.set(image.averageColor, path);
          }
          addCellShape(path, sx, sy, geometry);
          return;
        }
      }
      addCellShape(age === 0 ? newbornPath : alivePath, sx, sy, geometry);
    });

    context.fillStyle = palette.trace;
    context.fill(tracePath);
    context.fillStyle = palette.alive;
    context.fill(alivePath);
    for (const [color, path] of averagePaths) {
      context.fillStyle = color;
      context.fill(path);
    }
    context.fillStyle = palette.newborn;
    context.fill(newbornPath);

    // Images vues de près. Les nouveau-nés gardent un liseré cyan pour rester
    // reconnaissables (on voit toujours les 4 états, même avec des images).
    const { inset, size, radius } = geometry;
    const outline = new Path2D();
    for (const { sx, sy, tile, newborn } of tiles) {
      context.drawImage(tile, sx + inset, sy + inset, size, size);
      if (newborn) roundedRectPath(outline, sx + inset, sy + inset, size, size, radius);
    }
    if (tiles.length > 0) {
      context.lineWidth = Math.max(1.5, zoom * 0.07);
      context.strokeStyle = palette.newborn;
      context.stroke(outline);
    }
  }

  /** Contour de la case sous le pinceau (cyan) ou la gomme (rose). */
  private drawHover(hover: NonNullable<Overlay['hover']>): void {
    const { camera, context, palette } = this;
    const zoom = camera.zoom;
    if (zoom < 3) return;
    context.lineWidth = 1.5;
    context.strokeStyle = hover.mode === 'erase' ? palette.erase : palette.newborn;
    context.strokeRect(
      camera.worldToScreenX(hover.x) + 0.75,
      camera.worldToScreenY(hover.y) + 0.75,
      zoom - 1.5,
      zoom - 1.5,
    );
  }

  /** Rectangle de sélection en pointillés, avec sa taille en cases. */
  private drawSelection(rect: CellRect): void {
    const { camera, context, palette } = this;
    const x = camera.worldToScreenX(rect.x0);
    const y = camera.worldToScreenY(rect.y0);
    const width = (rect.x1 - rect.x0 + 1) * camera.zoom;
    const height = (rect.y1 - rect.y0 + 1) * camera.zoom;
    context.fillStyle = palette.selectionFill;
    context.fillRect(x, y, width, height);
    context.setLineDash([6, 4]);
    context.lineWidth = 1.5;
    context.strokeStyle = palette.selectionStroke;
    context.strokeRect(x, y, width, height);
    context.setLineDash([]);
    context.font = '12px ui-monospace, Menlo, Consolas, monospace';
    context.fillStyle = palette.selectionStroke;
    context.fillText(`${rect.x1 - rect.x0 + 1} × ${rect.y1 - rect.y0 + 1}`, x, y - 6);
  }

  /** Aperçu semi-transparent de la structure qu'on s'apprête à poser. */
  private drawGhost(ghost: NonNullable<Overlay['ghost']>): void {
    const { camera, context, palette, images } = this;
    const zoom = camera.zoom;
    const geometry = geometryFor(zoom);
    const path = new Path2D();
    context.globalAlpha = 0.6;
    for (const [x, y, skin] of ghost.pattern.cells) {
      const sx = camera.worldToScreenX(ghost.x + x);
      const sy = camera.worldToScreenY(ghost.y + y);
      const image = skin !== 0 && zoom >= IMAGES_MIN_ZOOM ? images.get(skin) : undefined;
      if (image) {
        context.drawImage(image.tile, sx + geometry.inset, sy + geometry.inset, geometry.size, geometry.size);
      } else {
        addCellShape(path, sx, sy, geometry);
      }
    }
    context.fillStyle = palette.newborn;
    context.fill(path);
    context.globalAlpha = 1;

    // Cadre en pointillés autour de la structure.
    context.setLineDash([4, 4]);
    context.lineWidth = 1;
    context.strokeStyle = palette.newborn;
    context.strokeRect(
      camera.worldToScreenX(ghost.x),
      camera.worldToScreenY(ghost.y),
      ghost.pattern.width * zoom,
      ghost.pattern.height * zoom,
    );
    context.setLineDash([]);
  }
}

/** Ajoute la forme d'une cellule (carré arrondi ou carré simple) à un chemin. */
function addCellShape(path: Path2D, sx: number, sy: number, geometry: CellGeometry): void {
  if (geometry.shapes) {
    roundedRectPath(path, sx + geometry.inset, sy + geometry.inset, geometry.size, geometry.size, geometry.radius);
  } else {
    path.rect(sx, sy, geometry.size, geometry.size);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

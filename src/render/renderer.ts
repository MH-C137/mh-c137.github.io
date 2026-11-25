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
 *     sans espacement (invisible à cette taille de toute façon).
 *   - les cellules sont des carrés nets (style pixel) : voir CORNER_RATIO dans images.ts.
 */

import { squareAround, type CellRect } from '../core/coords';
import type { Pattern } from '../core/pattern';
import { isPulseAge, type World } from '../core/world';
import type { Camera } from './camera';
import { CORNER_RATIO, roundedRectPath, type ImageLibrary } from './images';
import type { Constellation } from './constellation';
import { CellSprites, type SpriteKind, type SpriteStyle } from './sprites';
import { PALETTES, type Palette } from './theme';

/** Ce qui se superpose à la grille pendant l'édition (rempli par l'éditeur). */
export interface Overlay {
  /** Rectangle sélectionné (outil Sélection). */
  selection: CellRect | null;
  /** Aperçu d'une structure avant de la poser : coin haut-gauche en (x, y). */
  ghost: { pattern: Pattern; x: number; y: number } | null;
  /** Case sous le pointeur (pinceau = dessiner, gomme = effacer). `size` = côté du carré, en cases. */
  hover: { x: number; y: number; mode: 'draw' | 'erase'; size: number } | null;
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
  /** Rayon des coins (0 = carrés, voir CORNER_RATIO). */
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
  private _palette: Palette = PALETTES.night;
  /** Faux = on ne dessine pas les lignes de la grille (réglage du menu Options). */
  gridVisible = true;
  /** Style du quadrillage, choisi par la DA : lignes simples, ou lignes + croix aux croisements. */
  gridStyle: 'lines' | 'crosses' = 'lines';
  /** Image de fond (derrière la grille, fixe à l'écran), choisie par la DA et le thème ; null = fond uni. */
  backgroundImage: CanvasImageSource & { width: number; height: number } | null = null;
  backgroundOpacity = 1;
  /** Fond d'étoiles dessiné par le site (DA « constellation »), ou null. Remplace l'image de fond. */
  constellation: Constellation | null = null;
  /** Cellules en forme d'icône (étoiles…), si la DA en fournit une ; null = carrés. */
  private sprites: CellSprites | null = null;

  /** Palette courante. Changer de palette recolore aussi les icônes des cellules. */
  get palette(): Palette {
    return this._palette;
  }

  set palette(palette: Palette) {
    this._palette = palette;
    this.sprites?.retint(palette);
  }

  /**
   * Images (adresses « data: ») des cellules en icône, une par état, pour la légende et le didacticiel :
   * elles montrent EXACTEMENT ce que le rendu dessine (étoile pleine, étoile vide…). null s'il n'y a pas d'icône.
   */
  swatchUrls(colors: Partial<Pick<Palette, 'newborn' | 'alive' | 'trace' | 'pulse'>> = {}): Record<'newborn' | 'alive' | 'trace', string> | null {
    return this.sprites ? this.sprites.swatchUrls({ ...this._palette, ...colors }) : null;
  }

  /** Donne (ou retire, avec null) une icône qui sert de forme aux cellules. */
  setCellIcon(
    icon: (CanvasImageSource & { width: number; height: number }) | null,
    scale: number,
    minZoom: number,
    style: SpriteStyle = { traceStyle: 'filled', outlineWidth: 0.07, pulseHalo: false },
  ): void {
    this.sprites = icon ? new CellSprites(icon, scale, minZoom, style, this._palette) : null;
  }

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
    this.drawBackgroundImage();
    this.drawConstellation();
    this.drawGlass();

    if (this.gridVisible) this.drawGrid();
    this.drawCells();
    if (overlay.hover) this.drawHover(overlay.hover);
    if (overlay.selection) this.drawSelection(overlay.selection);
    if (overlay.ghost) this.drawGhost(overlay.ghost);
  }

  /**
   * La constellation : un ciel d'étoiles FIXE dans le monde, derrière la grille. Il suit
   * exactement le zoom et le déplacement de la vue (voir constellation.ts).
   */
  private drawConstellation(): void {
    if (!this.constellation) return;
    const { camera, context } = this;
    this.constellation.draw(
      context,
      camera.width,
      camera.height,
      camera.centerX,
      camera.centerY,
      camera.zoom,
      this.backgroundOpacity,
    );
  }

  /**
   * La « vitre » : une teinte translucide posée PAR-DESSUS le fond (étoiles ou image) et
   * SOUS la grille et les cellules. Elle estompe le fond et le fait paraître lointain, si bien
   * que la grille et les cellules (nettes, au premier plan) ne se confondent jamais avec lui.
   * Un très léger reflet en diagonale (dégradé blanc presque transparent) complète l'effet vitre.
   */
  private drawGlass(): void {
    if (!this.constellation && !this.backgroundImage) return;
    const { camera, context, palette } = this;
    context.fillStyle = palette.glass;
    context.fillRect(0, 0, camera.width, camera.height);
    const sheen = context.createLinearGradient(0, 0, camera.width * 0.6, camera.height);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    context.fillStyle = sheen;
    context.fillRect(0, 0, camera.width, camera.height);
  }

  /**
   * Image de fond de la DA : elle remplit tout l'écran SANS se déformer (comme `object-fit: cover`
   * en CSS : on prend le plus petit agrandissement qui couvre l'écran, centré) et ne bouge pas
   * quand on déplace la vue. Dessinée avant la grille et les cellules, donc derrière.
   */
  private drawBackgroundImage(): void {
    const image = this.backgroundImage;
    if (!image || image.width === 0) return;
    const { camera, context } = this;
    const scale = Math.max(camera.width / image.width, camera.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.globalAlpha = this.backgroundOpacity;
    context.drawImage(image, (camera.width - width) / 2, (camera.height - height) / 2, width, height);
    context.globalAlpha = 1;
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
    // La grille apparaît tôt (dès 5 px par case) et progressivement, pour rester lisible.
    const minorAlpha = clamp01((zoom - 4) / 5);
    const majorAlpha = clamp01((zoom - 2) / 3);
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
    if (this.gridStyle === 'crosses' && zoom >= 8) this.drawGridCrosses(view, crisp);
    context.globalAlpha = 1;
  }

  /**
   * Style « croix » : une petite croix épaisse à chaque croisement de lignes, par-dessus le
   * quadrillage fin. Toutes les croix sont regroupées dans un seul chemin (un seul ordre de
   * dessin) et apparaissent progressivement quand on zoome, comme les lignes.
   */
  private drawGridCrosses(view: { x0: number; x1: number; y0: number; y1: number }, crisp: (value: number) => number): void {
    const { camera, context, palette } = this;
    const arm = Math.min(camera.zoom * 0.14, 7); // longueur d'un bras de la croix
    const crosses = new Path2D();
    for (let x = view.x0; x <= view.x1 + 1; x++) {
      const sx = crisp(camera.worldToScreenX(x));
      for (let y = view.y0; y <= view.y1 + 1; y++) {
        const sy = crisp(camera.worldToScreenY(y));
        crosses.moveTo(sx - arm, sy);
        crosses.lineTo(sx + arm, sy);
        crosses.moveTo(sx, sy - arm);
        crosses.lineTo(sx, sy + arm);
      }
    }
    context.globalAlpha = clamp01((camera.zoom - 6) / 4) * 0.7; // un peu plus discrètes que les lignes principales
    context.lineWidth = Math.max(2, camera.zoom * 0.06);
    context.strokeStyle = palette.gridMajor;
    context.stroke(crosses);
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
    const pulsePath = new Path2D();
    const newbornPath = new Path2D();
    /** Cellules à image vues de loin : un chemin par couleur moyenne. */
    const averagePaths = new Map<string, Path2D>();
    /** Cellules à image vues de près : dessinées une par une ensuite. */
    const tiles: Array<{ sx: number; sy: number; tile: HTMLCanvasElement; newborn: boolean; pulse: boolean }> = [];

    const isVisible = (x: number, y: number) =>
      x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;
    const screenX = (x: number) => (x - camera.centerX) * zoom + halfWidth;
    const screenY = (y: number) => (y - camera.centerY) * zoom + halfHeight;

    // Cellules en icône (étoiles…) : seulement quand les cases sont assez grandes ; sinon, des carrés.
    const sprites = this.sprites;
    const useIcons = sprites !== null && geometry.shapes && zoom >= sprites.minZoom;
    /** Positions (x, y, x, y…) des cellules à dessiner avec l'icône, par sorte. */
    const icons: Record<SpriteKind, number[]> = { trace: [], alive: [], pulse: [], newborn: [] };
    /** Note une cellule : un carré ajouté à son chemin, ou sa position pour l'icône. */
    const mark = (kind: SpriteKind, path: Path2D, sx: number, sy: number) => {
      if (useIcons) icons[kind].push(sx, sy);
      else addCellShape(path, sx, sy, geometry);
    };

    // Cellules qui viennent de mourir : couleur de trace, ou l'image choisie pour les « mortes »
    // (vue de près seulement ; de loin, la couleur de trace reste plus lisible).
    const deadImage = images.deadImage !== 0 ? images.get(images.deadImage) : undefined;
    const deadTiles: Array<{ sx: number; sy: number }> = [];
    world.forEachTrace((x, y) => {
      if (!isVisible(x, y)) return;
      if (deadImage && showImages) deadTiles.push({ sx: screenX(x), sy: screenY(y) });
      else mark('trace', tracePath, screenX(x), screenY(y));
    });

    world.forEachCell((x, y, age, skin) => {
      if (!isVisible(x, y)) return;
      const sx = screenX(x);
      const sy = screenY(y);
      const image = skin !== 0 ? images.get(skin) : undefined;
      if (image) {
        if (showImages) {
          tiles.push({ sx, sy, tile: image.tile, newborn: age === 0, pulse: isPulseAge(age) });
          return;
        }
        if (age > 0) {
          // (le clignotement des cellules à image se voit surtout de près, par le liseré)
          let path = averagePaths.get(image.averageColor);
          if (!path) {
            path = new Path2D();
            averagePaths.set(image.averageColor, path);
          }
          addCellShape(path, sx, sy, geometry);
          return;
        }
      }
      if (age === 0) mark('newborn', newbornPath, sx, sy);
      else if (isPulseAge(age)) mark('pulse', pulsePath, sx, sy);
      else mark('alive', alivePath, sx, sy);
    });

    context.fillStyle = palette.trace;
    context.fill(tracePath);
    if (deadImage && deadTiles.length > 0) {
      context.globalAlpha = 0.5; // un peu transparente : on voit qu'elle est « éteinte »
      for (const { sx, sy } of deadTiles) {
        context.drawImage(deadImage.tile, sx + geometry.inset, sy + geometry.inset, geometry.size, geometry.size);
      }
      context.globalAlpha = 1;
    }
    context.fillStyle = palette.alive;
    context.fill(alivePath);
    context.fillStyle = palette.pulse;
    context.fill(pulsePath);
    for (const [color, path] of averagePaths) {
      context.fillStyle = color;
      context.fill(path);
    }
    context.fillStyle = palette.newborn;
    context.fill(newbornPath);

    // Cellules en icône : trace, puis vivantes, clignotantes, nées (la dernière est dessus).
    if (sprites && useIcons) {
      for (const kind of ['trace', 'alive', 'pulse', 'newborn'] as const) {
        const positions = icons[kind];
        for (let i = 0; i < positions.length; i += 2) sprites.draw(context, kind, positions[i]!, positions[i + 1]!, zoom);
      }
    }

    // Images vues de près. Les nouveau-nés gardent un liseré cyan pour rester
    // reconnaissables (on voit toujours les 4 états, même avec des images).
    const { inset, size, radius } = geometry;
    const outline = new Path2D();
    const pulseOutline = new Path2D();
    for (const { sx, sy, tile, newborn, pulse } of tiles) {
      context.drawImage(tile, sx + inset, sy + inset, size, size);
      if (newborn) roundedRectPath(outline, sx + inset, sy + inset, size, size, radius);
      else if (pulse) roundedRectPath(pulseOutline, sx + inset, sy + inset, size, size, radius);
    }
    if (tiles.length > 0) {
      context.lineWidth = Math.max(1.5, zoom * 0.07);
      context.strokeStyle = palette.newborn;
      context.stroke(outline);
      context.strokeStyle = palette.pulse;
      context.stroke(pulseOutline);
    }
  }

  /** Contour de la zone sous le pinceau (une case, cyan) ou la gomme (carré de `size` cases, rose). */
  private drawHover(hover: NonNullable<Overlay['hover']>): void {
    const { camera, context, palette } = this;
    const zoom = camera.zoom;
    context.lineWidth = 2;
    context.strokeStyle = hover.mode === 'erase' ? palette.erase : palette.newborn;
    const area = squareAround(hover.x, hover.y, hover.size);
    // Le carré doit rester visible même très dézoomé (cases de 1 px) : on impose
    // une taille minimale à l'écran, centrée sur le vrai carré.
    const MIN_SIDE = 8;
    const side = Math.max((area.x1 - area.x0 + 1) * zoom, MIN_SIDE);
    const centerX = camera.worldToScreenX(area.x0) + ((area.x1 - area.x0 + 1) * zoom) / 2;
    const centerY = camera.worldToScreenY(area.y0) + ((area.y1 - area.y0 + 1) * zoom) / 2;
    context.strokeRect(centerX - side / 2 + 1, centerY - side / 2 + 1, side - 2, side - 2);
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
    context.font = '22px "Jersey 10", ui-monospace, Menlo, Consolas, monospace';
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

/** Ajoute la forme d'une cellule (carré, éventuellement à coins arrondis si CORNER_RATIO > 0) à un chemin. */
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

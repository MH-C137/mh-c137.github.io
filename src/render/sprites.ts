/**
 * ============================================================================
 *  sprites.ts — Cellules en forme d'icône (étoiles…) au lieu de carrés
 * ============================================================================
 *
 * Une DA peut fournir une image (`cells.icon` dans da.json) qui sert de FORME aux
 * cellules. Seule la silhouette (la partie non transparente) compte : la couleur vient de
 * l'état de la cellule, comme pour les carrés.
 *
 * Comment : au chargement, on fabrique UNE petite image par état, en deux tailles (une
 * petite pour les cases réduites, une grande pour les gros zooms : elles restent nettes).
 * Dessiner une cellule = copier la bonne image (drawImage), ce qui reste rapide pour des
 * milliers de cellules. On refait les images quand les couleurs changent.
 *
 * Techniques de dessin sur un canvas, toutes basées sur la silhouette :
 *   - TEINTER : on dessine l'icône, puis on remplit avec `source-in`, qui ne colore QUE
 *     les pixels déjà dessinés (la silhouette) ;
 *   - ÉPAISSIR (halo du clignotement) : on dessine la silhouette 64 fois, décalée en cercle :
 *     avec autant de copies, les bords restent parfaitement lisses (avec 16 copies, on voyait
 *     des « marches d'escalier » sur les contours) ;
 *   - CONTOUR INTÉRIEUR (la « trace » en étoile vide) : on prend l'étoile, on garde seulement
 *     les pixels proches du bord. Pour cela : on épaissit le CONTRAIRE de l'étoile (tout ce qui
 *     n'est pas l'étoile) de r pixels, puis on ne garde que la partie de l'étoile couverte
 *     (`destination-in`). Il reste un liseré de largeur r, à l'intérieur de la forme : l'étoile
 *     vide a donc exactement la même taille que l'étoile pleine.
 */

import type { Palette } from './theme';

/** Les sortes de cellules dessinées avec l'icône. */
export type SpriteKind = 'trace' | 'alive' | 'pulse' | 'newborn';

/** Côtés (px) des images : une petite pour les cases réduites, une grande pour les gros zooms. */
const SMALL = 96;
const LARGE = 256;
/** À partir de cette taille d'affichage (px), on utilise la grande image. */
const LARGE_FROM = 60;
/** Marge réservée autour de l'icône (pour le halo), en proportion du côté. */
const PAD_RATIO = 0.16;
/** Nombre de décalages utilisés pour épaissir une silhouette (assez pour des bords lisses). */
const DILATION_STEPS = 64;

export interface SpriteStyle {
  /** `outline` : la trace est dessinée en contour seulement (étoile vide). */
  readonly traceStyle: 'filled' | 'outline';
  /** Épaisseur du contour, en proportion de l'icône. */
  readonly outlineWidth: number;
  /** Vrai : le clignotement a un halo. */
  readonly pulseHalo: boolean;
}

type Icon = CanvasImageSource & { width: number; height: number };

/** Une série d'images (une par état) à une taille donnée. */
class SpriteSet {
  readonly canvases = new Map<SpriteKind, HTMLCanvasElement>();
  /** Côté de la zone réservée à l'icône elle-même (le reste est la marge du halo). */
  private readonly box: number;

  constructor(
    private readonly icon: Icon,
    private readonly size: number,
    private readonly style: SpriteStyle,
    palette: Palette,
  ) {
    this.box = Math.round(size * (1 - 2 * PAD_RATIO));
    this.build(palette);
  }

  private build(palette: Palette): void {
    const ring = Math.max(1, this.box * this.style.outlineWidth);
    const fills: Record<SpriteKind, string> = {
      trace: palette.trace,
      alive: palette.alive,
      pulse: palette.pulse,
      newborn: palette.newborn,
    };
    for (const kind of Object.keys(fills) as SpriteKind[]) {
      const canvas = this.blank();
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      if (kind === 'pulse' && this.style.pulseHalo) {
        context.globalAlpha = 0.35;
        context.drawImage(this.dilate(this.tinted(fills.pulse), this.box * 0.12), 0, 0);
        context.globalAlpha = 1;
      }
      const hollow = kind === 'trace' && this.style.traceStyle === 'outline';
      context.drawImage(hollow ? this.hollow(fills.trace, ring) : this.tinted(fills[kind]), 0, 0);
      this.canvases.set(kind, canvas);
    }
  }

  private blank(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    return canvas;
  }

  /** L'icône (silhouette) remplie d'une couleur, centrée dans la zone réservée. */
  private tinted(color: string): HTMLCanvasElement {
    const canvas = this.blank();
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.imageSmoothingQuality = 'high';
    const ratio = Math.min(this.box / this.icon.width, this.box / this.icon.height);
    const width = this.icon.width * ratio;
    const height = this.icon.height * ratio;
    context.drawImage(this.icon, (this.size - width) / 2, (this.size - height) / 2, width, height);
    context.globalCompositeOperation = 'source-in'; // ne colore que la silhouette
    context.fillStyle = color;
    context.fillRect(0, 0, this.size, this.size);
    return canvas;
  }

  /** Une forme épaissie de `radius` pixels : 64 copies décalées en cercle. */
  private dilate(base: HTMLCanvasElement, radius: number): HTMLCanvasElement {
    const canvas = this.blank();
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    for (let step = 0; step < DILATION_STEPS; step++) {
      const angle = (step / DILATION_STEPS) * Math.PI * 2;
      context.drawImage(base, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.drawImage(base, 0, 0);
    return canvas;
  }

  /** L'étoile vide : seulement un liseré de `ring` pixels le long du bord, à l'INTÉRIEUR de la forme. */
  private hollow(color: string, ring: number): HTMLCanvasElement {
    const star = this.tinted('#000000');
    // Le contraire de l'étoile : tout est opaque, sauf l'étoile.
    const outside = this.blank();
    const outsideContext = outside.getContext('2d') as CanvasRenderingContext2D;
    outsideContext.fillRect(0, 0, this.size, this.size);
    outsideContext.globalCompositeOperation = 'destination-out';
    outsideContext.drawImage(star, 0, 0);
    // On épaissit ce contraire : il « mord » de `ring` pixels dans l'étoile.
    const bitten = this.dilate(outside, ring);
    // On ne garde de l'étoile colorée que la partie mordue : le liseré.
    const result = this.tinted(color);
    const context = result.getContext('2d') as CanvasRenderingContext2D;
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(bitten, 0, 0);
    return result;
  }
}

export class CellSprites {
  private small: SpriteSet;
  private large: SpriteSet;

  constructor(
    private readonly icon: Icon,
    /** Taille de l'icône dans sa case (1 = toute la case). */
    readonly scale: number,
    /** En dessous de cette taille de case (px), on dessine des carrés. */
    readonly minZoom: number,
    private readonly style: SpriteStyle,
    palette: Palette,
  ) {
    this.small = new SpriteSet(icon, SMALL, style, palette);
    this.large = new SpriteSet(icon, LARGE, style, palette);
  }

  /** Refait les images avec les couleurs de la palette. */
  retint(palette: Palette): void {
    this.small = new SpriteSet(this.icon, SMALL, this.style, palette);
    this.large = new SpriteSet(this.icon, LARGE, this.style, palette);
  }

  /** Dessine une cellule de cette sorte, dans la case dont le coin haut-gauche est (x, y) et le côté `zoom`. */
  draw(context: CanvasRenderingContext2D, kind: SpriteKind, x: number, y: number, zoom: number): void {
    // L'icône elle-même doit occuper `scale` × la case : la marge (halo) déborde donc un peu.
    const size = (zoom * this.scale) / (1 - 2 * PAD_RATIO);
    const sprite = (size >= LARGE_FROM ? this.large : this.small).canvases.get(kind);
    if (sprite) context.drawImage(sprite, x + (zoom - size) / 2, y + (zoom - size) / 2, size, size);
  }

  /**
   * Les images (adresses data:) des trois états principaux dans des couleurs données, pour la légende et le
   * didacticiel. Elles ont la même forme que les cellules, mais leurs couleurs peuvent être adaptées au fond
   * sur lequel elles sont posées (une étoile bleu nuit sur un bloc bleu nuit ne se verrait pas).
   */
  swatchUrls(palette: Palette): Record<'newborn' | 'alive' | 'trace', string> {
    const set = new SpriteSet(this.icon, SMALL, this.style, palette);
    const url = (kind: SpriteKind) => set.canvases.get(kind)?.toDataURL('image/png') ?? '';
    return { newborn: url('newborn'), alive: url('alive'), trace: url('trace') };
  }

  /** L'image d'un état sous forme d'adresse (data:), pour la légende et le didacticiel : elle montre EXACTEMENT ce qui sera dessiné. */
  dataUrl(kind: SpriteKind): string {
    return this.small.canvases.get(kind)?.toDataURL('image/png') ?? '';
  }
}

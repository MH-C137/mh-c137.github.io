/**
 * ============================================================================
 *  sprites.ts — Cellules en forme d'icône (étoiles…) au lieu de carrés
 * ============================================================================
 *
 * Une DA peut fournir une image (`cells.icon` dans da.json) qui sert de FORME aux
 * cellules. Seule la silhouette (la partie non transparente) compte : la couleur vient de
 * l'état de la cellule, comme pour les carrés.
 *
 * Comment : au chargement, on fabrique UNE petite image par état. Ensuite, dessiner une
 * cellule = copier la bonne petite image (drawImage), ce qui reste rapide pour des
 * milliers de cellules. On refait les images quand les couleurs changent.
 *
 * Trois techniques de dessin sur un canvas, toutes basées sur la silhouette :
 *   - TEINTER : on dessine l'icône, puis on remplit avec `source-in`, qui ne colore QUE
 *     les pixels déjà dessinés (la silhouette) ;
 *   - CONTOUR : on « épaissit » la silhouette en la dessinant 16 fois, légèrement décalée
 *     dans toutes les directions (comme un tampon qui bave), puis on dessine l'icône
 *     normale par-dessus : il reste un liseré tout autour ;
 *   - CREUX (le « reflet ») : même épaississement, puis on EFFACE la silhouette d'origine
 *     avec `destination-out` : il ne reste que le liseré, l'étoile est vide.
 * Le clignotement peut aussi avoir un halo : une copie plus large, très transparente.
 */

import type { Palette } from './theme';

/** Les sortes de cellules dessinées avec l'icône. */
export type SpriteKind = 'fade' | 'trace' | 'alive' | 'pulse' | 'newborn';

/** Côté (px) des petites images : assez grand pour rester net quand on zoome fort. */
const SPRITE_SIZE = 128;
/** Marge réservée autour de l'icône (contour, halo), en proportion du côté. */
const PAD_RATIO = 0.16;
/** Nombre de décalages utilisés pour épaissir la silhouette. */
const DILATION_STEPS = 16;

export interface SpriteStyle {
  /** Épaisseur du contour, en proportion de l'icône (0 = pas de contour). */
  readonly outlineWidth: number;
  /** Vrai : le clignotement a un halo. */
  readonly pulseHalo: boolean;
}

type Icon = CanvasImageSource & { width: number; height: number };

export class CellSprites {
  private readonly canvases = new Map<SpriteKind, HTMLCanvasElement>();
  /** Côté de la zone réservée à l'icône elle-même (le reste est la marge du contour et du halo). */
  private readonly box: number;
  /** Faut-il réserver une marge ? (seulement si un contour, un halo ou un reflet peut être dessiné). */
  private readonly padded: boolean;

  constructor(
    private readonly icon: Icon,
    /** Taille de l'icône dans sa case (1 = toute la case). */
    readonly scale: number,
    /** En dessous de cette taille de case (px), on dessine des carrés. */
    readonly minZoom: number,
    private readonly style: SpriteStyle,
    palette: Palette,
  ) {
    this.padded = true;
    this.box = Math.round(SPRITE_SIZE * (1 - 2 * PAD_RATIO));
    this.retint(palette);
  }

  /** Refait les images avec les couleurs de la palette. */
  retint(palette: Palette): void {
    const fills: Record<Exclude<SpriteKind, 'fade'>, string> = {
      trace: palette.trace,
      alive: palette.alive,
      pulse: palette.pulse,
      newborn: palette.newborn,
    };
    const ring = Math.max(1.5, this.box * Math.max(this.style.outlineWidth, 0.05));

    for (const kind of Object.keys(fills) as Array<keyof typeof fills>) {
      const canvas = this.blank();
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      if (kind === 'pulse' && this.style.pulseHalo) {
        context.globalAlpha = 0.35;
        context.drawImage(this.dilated(fills.pulse, ring * 2.4), 0, 0);
        context.globalAlpha = 1;
      }
      if (this.style.outlineWidth > 0) {
        context.drawImage(this.dilated(palette.outline, this.box * this.style.outlineWidth), 0, 0);
      }
      context.drawImage(this.tinted(fills[kind]), 0, 0);
      this.canvases.set(kind, canvas);
    }

    // Le reflet : un liseré tout seul, étoile vide.
    const hollow = this.blank();
    const hollowContext = hollow.getContext('2d') as CanvasRenderingContext2D;
    hollowContext.drawImage(this.dilated(palette.fade, ring), 0, 0);
    hollowContext.globalCompositeOperation = 'destination-out';
    hollowContext.drawImage(this.tinted('#000000'), 0, 0);
    this.canvases.set('fade', hollow);
  }

  private blank(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    return canvas;
  }

  /** L'icône (silhouette) remplie d'une couleur, centrée dans la zone réservée. */
  private tinted(color: string): HTMLCanvasElement {
    const canvas = this.blank();
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const ratio = Math.min(this.box / this.icon.width, this.box / this.icon.height);
    const width = this.icon.width * ratio;
    const height = this.icon.height * ratio;
    context.drawImage(this.icon, (SPRITE_SIZE - width) / 2, (SPRITE_SIZE - height) / 2, width, height);
    context.globalCompositeOperation = 'source-in'; // ne colore que la silhouette
    context.fillStyle = color;
    context.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    return canvas;
  }

  /** La silhouette épaissie de `radius` pixels (16 copies décalées en cercle), remplie d'une couleur. */
  private dilated(color: string, radius: number): HTMLCanvasElement {
    const base = this.tinted(color);
    const canvas = this.blank();
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    for (let step = 0; step < DILATION_STEPS; step++) {
      const angle = (step / DILATION_STEPS) * Math.PI * 2;
      context.drawImage(base, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.drawImage(base, 0, 0);
    return canvas;
  }

  /** Dessine une cellule de cette sorte, dans la case dont le coin haut-gauche est (x, y) et le côté `zoom`. */
  draw(context: CanvasRenderingContext2D, kind: SpriteKind, x: number, y: number, zoom: number): void {
    const sprite = this.canvases.get(kind);
    if (!sprite) return;
    // L'icône elle-même doit occuper `scale` × la case : la marge du contour déborde donc un peu.
    const size = (zoom * this.scale) / (this.padded ? 1 - 2 * PAD_RATIO : 1);
    context.drawImage(sprite, x + (zoom - size) / 2, y + (zoom - size) / 2, size, size);
  }
}

/**
 * ============================================================================
 *  sprites.ts — Cellules en forme d'icône (étoiles…) au lieu de carrés
 * ============================================================================
 *
 * Une DA peut fournir une image (`cells.icon` dans da.json) qui sert de FORME aux
 * cellules. Seule la silhouette (la partie non transparente) compte : la couleur vient de
 * l'état de la cellule (née, vivante, qui clignote, qui vient de mourir), comme pour les
 * carrés.
 *
 * Comment : au chargement, on fabrique UNE petite image par état en deux temps :
 *   1. on dessine l'icône au centre d'un petit canvas ;
 *   2. on remplit de la couleur de l'état avec `source-in`, qui ne colore QUE les pixels
 *      déjà dessinés (la silhouette de l'icône).
 * Ensuite, dessiner une cellule = copier la bonne petite image (drawImage), ce qui est
 * rapide même pour des milliers de cellules. On refait les 4 images quand les couleurs
 * changent (mode jour / nuit, couleurs choisies).
 */

import type { Palette } from './theme';

/** Les 4 sortes de cellules dessinées avec l'icône. */
export type SpriteKind = 'trace' | 'alive' | 'pulse' | 'newborn';

/** Côté (px) des petites images : assez grand pour rester net quand on zoome fort. */
const SPRITE_SIZE = 128;

export class CellSprites {
  private readonly canvases = new Map<SpriteKind, HTMLCanvasElement>();

  constructor(
    private readonly icon: CanvasImageSource & { width: number; height: number },
    /** Taille de l'icône dans sa case (1 = toute la case). */
    readonly scale: number,
    /** En dessous de cette taille de case (px), on dessine des carrés. */
    readonly minZoom: number,
    palette: Palette,
  ) {
    this.retint(palette);
  }

  /** Refait les 4 images avec les couleurs de la palette. */
  retint(palette: Palette): void {
    const colors: Record<SpriteKind, string> = {
      trace: palette.trace,
      alive: palette.alive,
      pulse: palette.pulse,
      newborn: palette.newborn,
    };
    for (const kind of Object.keys(colors) as SpriteKind[]) {
      const canvas = document.createElement('canvas');
      canvas.width = SPRITE_SIZE;
      canvas.height = SPRITE_SIZE;
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      // Icône centrée, sans la déformer (« contain »).
      const ratio = Math.min(SPRITE_SIZE / this.icon.width, SPRITE_SIZE / this.icon.height);
      const width = this.icon.width * ratio;
      const height = this.icon.height * ratio;
      context.drawImage(this.icon, (SPRITE_SIZE - width) / 2, (SPRITE_SIZE - height) / 2, width, height);
      context.globalCompositeOperation = 'source-in'; // ne colore que la silhouette
      context.fillStyle = colors[kind];
      context.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      this.canvases.set(kind, canvas);
    }
  }

  /** Dessine une cellule de cette sorte, dans la case dont le coin haut-gauche est (x, y) et le côté `zoom`. */
  draw(context: CanvasRenderingContext2D, kind: SpriteKind, x: number, y: number, zoom: number): void {
    const sprite = this.canvases.get(kind);
    if (!sprite) return;
    const size = zoom * this.scale;
    context.drawImage(sprite, x + (zoom - size) / 2, y + (zoom - size) / 2, size, size);
  }
}

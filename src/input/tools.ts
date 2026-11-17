/**
 * ============================================================================
 *  tools.ts — Les outils (sélection, main, pinceau, gomme, tampon)
 * ============================================================================
 *
 * Patron de conception ÉTAT : un même geste (cliquer, glisser) fait des choses
 * différentes selon l'outil choisi. Au lieu d'un énorme `if (outil === …)`
 * partout, chaque outil est une classe qui respecte la même interface `Tool`.
 * Le contrôleur (controller.ts) transmet les gestes à l'outil ACTIF, sans
 * savoir lequel c'est.
 *
 * Ajouter un outil = écrire une nouvelle classe qui implémente `Tool`, puis
 * l'enregistrer dans l'éditeur (editor.ts). Rien d'autre à modifier.
 */

import { rectFromCorners, squareAround } from '../core/coords';
import type { Editor } from './editor';
import { cellsOnLine } from './line';

export type ToolId = 'select' | 'hand' | 'brush' | 'eraser' | 'stamp';

/** Informations sur le pointeur (souris, doigt ou stylet), déjà converties en case. */
export interface PointerInfo {
  /** Position à l'écran, en pixels. */
  readonly screenX: number;
  readonly screenY: number;
  /** Case du monde sous le pointeur. */
  readonly cellX: number;
  readonly cellY: number;
  /** Bouton : 0 = gauche (ou doigt), 1 = milieu, 2 = droit. */
  readonly button: number;
}

export interface Tool {
  readonly id: ToolId;
  /** Curseur de souris à afficher (valeur CSS : "crosshair", "grab"…). */
  readonly cursor: string;
  /** Bouton appuyé (ou doigt posé). */
  pointerDown(pointer: PointerInfo): void;
  /** Déplacement, bouton appuyé (`pressed`) ou non (simple survol). */
  pointerMove(pointer: PointerInfo, pressed: boolean): void;
  /** Bouton relâché. */
  pointerUp(pointer: PointerInfo): void;
  /** Abandon du geste en cours (touche Échap, deuxième doigt, changement d'outil). */
  cancel(): void;
}

// ────────────────────────────────────────────────────────────────────────────
//  Main : déplacer la vue
// ────────────────────────────────────────────────────────────────────────────

export class HandTool implements Tool {
  readonly id = 'hand';
  private last: { x: number; y: number } | null = null;

  constructor(private readonly editor: Editor) {}

  get cursor(): string {
    return this.last ? 'grabbing' : 'grab';
  }

  pointerDown(pointer: PointerInfo): void {
    this.last = { x: pointer.screenX, y: pointer.screenY };
  }

  /** On déplace la caméra exactement du même nombre de pixels que le pointeur. */
  pointerMove(pointer: PointerInfo, pressed: boolean): void {
    if (!pressed || !this.last) return;
    this.editor.camera.panBy(pointer.screenX - this.last.x, pointer.screenY - this.last.y);
    this.last = { x: pointer.screenX, y: pointer.screenY };
  }

  pointerUp(): void {
    this.last = null;
  }

  cancel(): void {
    this.last = null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Pinceau et gomme : rendre des cases vivantes ou mortes
// ────────────────────────────────────────────────────────────────────────────

export class PaintTool implements Tool {
  readonly cursor = 'crosshair';
  /** Dernière case peinte : sert à relier les positions successives (Bresenham). */
  private lastCell: { x: number; y: number } | null = null;
  private drawing = true;
  private changed = false;

  constructor(
    private readonly editor: Editor,
    readonly id: 'brush' | 'eraser',
  ) {}

  /** Clic gauche : pinceau = dessine, gomme = efface. Clic droit : efface toujours. */
  pointerDown(pointer: PointerInfo): void {
    this.drawing = this.id === 'brush' && pointer.button !== 2;
    this.editor.beginEdit(); // photo de l'état d'avant, pour pouvoir annuler le trait
    this.lastCell = { x: pointer.cellX, y: pointer.cellY };
    this.paint(pointer.cellX, pointer.cellY);
  }

  pointerMove(pointer: PointerInfo, pressed: boolean): void {
    this.editor.setHover({
      x: pointer.cellX,
      y: pointer.cellY,
      mode: this.id === 'eraser' ? 'erase' : 'draw',
      size: this.brushSize,
    });
    if (!pressed || !this.lastCell) return;
    // Relie la case précédente à la case actuelle : le trait reste continu.
    cellsOnLine(this.lastCell.x, this.lastCell.y, pointer.cellX, pointer.cellY, (x, y) => this.paint(x, y));
    this.lastCell = { x: pointer.cellX, y: pointer.cellY };
  }

  /** Fin du trait : on signale UNE modification (et non une par case). */
  pointerUp(): void {
    this.editor.endEdit(this.changed);
    if (this.changed) this.editor.simulation.markEdited();
    this.lastCell = null;
    this.changed = false;
  }

  cancel(): void {
    this.pointerUp();
    this.editor.setHover(null);
  }

  /** Côté du carré touché : réglable pour la gomme, toujours 1 pour le pinceau. */
  private get brushSize(): number {
    return this.id === 'eraser' ? this.editor.eraserSize : 1;
  }

  /**
   * Change l'état de la case (x, y) ; pour une grosse gomme, de toutes les cases
   * du carré centré sur (x, y). Le trait relie déjà les positions successives
   * (Bresenham) : en appliquant le carré à chaque case du trait, on obtient
   * une bande continue de la largeur de la gomme.
   */
  private paint(x: number, y: number): void {
    const skin = this.drawing ? this.editor.images.current : 0;
    const area = squareAround(x, y, this.brushSize);
    for (let cy = area.y0; cy <= area.y1; cy++) {
      for (let cx = area.x0; cx <= area.x1; cx++) {
        if (this.editor.world.setCell(cx, cy, this.drawing, skin)) {
          this.changed = true;
          this.editor.invalidate();
        }
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Sélection : un rectangle qu'on peut copier, couper, supprimer, enregistrer
// ────────────────────────────────────────────────────────────────────────────

export class SelectTool implements Tool {
  readonly id = 'select';
  readonly cursor = 'crosshair';
  private anchor: { x: number; y: number } | null = null;
  private dragged = false;

  constructor(private readonly editor: Editor) {}

  /** Le premier coin du rectangle est la case où l'on clique. */
  pointerDown(pointer: PointerInfo): void {
    this.anchor = { x: pointer.cellX, y: pointer.cellY };
    this.dragged = false;
  }

  /** Le coin opposé suit le pointeur. */
  pointerMove(pointer: PointerInfo, pressed: boolean): void {
    if (!pressed || !this.anchor) return;
    if (pointer.cellX !== this.anchor.x || pointer.cellY !== this.anchor.y) this.dragged = true;
    if (this.dragged) {
      this.editor.setSelection(rectFromCorners(this.anchor.x, this.anchor.y, pointer.cellX, pointer.cellY));
    }
  }

  /** Un simple clic sans glisser désélectionne. */
  pointerUp(): void {
    if (this.anchor && !this.dragged) this.editor.setSelection(null);
    this.anchor = null;
  }

  cancel(): void {
    this.anchor = null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Tampon : poser une structure (bibliothèque ou copie) d'un clic
// ────────────────────────────────────────────────────────────────────────────

export class StampTool implements Tool {
  readonly id = 'stamp';
  readonly cursor = 'copy';

  constructor(private readonly editor: Editor) {}

  pointerDown(pointer: PointerInfo): void {
    if (pointer.button === 2) {
      this.editor.stopStamp(); // clic droit : on range la structure
      return;
    }
    this.editor.placeHeldPatternAt(pointer.cellX, pointer.cellY);
  }

  /** L'aperçu suit le pointeur, centré sur la case survolée. */
  pointerMove(pointer: PointerInfo): void {
    this.editor.showGhostAt(pointer.cellX, pointer.cellY);
  }

  pointerUp(): void {}

  cancel(): void {}
}

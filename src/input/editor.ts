/**
 * ============================================================================
 *  editor.ts — L'éditeur : outils, sélection, structures « en main », presse-papiers
 * ============================================================================
 *
 * L'éditeur est le chef d'orchestre de tout ce que l'utilisateur MODIFIE :
 *   - il connaît l'outil actif (patron État, voir tools.ts) ;
 *   - il garde la sélection et la structure qu'on tient « en main » (tampon ou
 *     glisser-déposer depuis la bibliothèque) ;
 *   - il remplit le « calque » (overlay) que le renderer dessine par-dessus la grille ;
 *   - il prévient l'interface quand quelque chose change (patron Observateur).
 *
 * L'interface (boutons, panneaux) n'appelle QUE des méthodes de l'éditeur ou
 * de la simulation : elle ne modifie jamais le monde directement. Ainsi, une
 * même action (ex. « supprimer la sélection ») marche pareil depuis un bouton
 * ou depuis le clavier.
 */

import type { CellRect } from '../core/coords';
import { Emitter } from '../core/events';
import { flipHorizontal, hasSkins, rotateClockwise, withSkin, type Pattern } from '../core/pattern';
import type { World } from '../core/world';
import type { PatternLibrary } from '../data/patterns';
import type { Camera, Insets } from '../render/camera';
import type { ImageLibrary } from '../render/images';
import type { Overlay } from '../render/renderer';
import type { Simulation } from '../simulation/simulation';
import { HandTool, PaintTool, SelectTool, StampTool, type Tool, type ToolId } from './tools';

export interface EditorEvents extends Record<string, unknown> {
  /** L'outil actif a changé. */
  tool: ToolId;
  /** La sélection a changé (null = plus de sélection). */
  selection: CellRect | null;
  /** La structure tenue en main a changé (null = plus rien en main). */
  held: Pattern | null;
}

/** Tout ce dont l'éditeur a besoin, fourni par main.ts. */
export interface EditorDependencies {
  world: World;
  simulation: Simulation;
  camera: Camera;
  images: ImageLibrary;
  library: PatternLibrary;
  /** Demande un nouveau dessin de la grille. */
  invalidate: () => void;
}

export class Editor extends Emitter<EditorEvents> {
  readonly world: World;
  readonly simulation: Simulation;
  readonly camera: Camera;
  readonly images: ImageLibrary;
  readonly library: PatternLibrary;
  readonly invalidate: () => void;

  /** Ce que le renderer dessine par-dessus la grille. */
  readonly overlay: Overlay = { selection: null, ghost: null, hover: null };

  private readonly tools: Record<ToolId, Tool>;
  private activeTool: Tool;
  /** Outil à retrouver quand on range une structure (Échap). */
  private toolBeforeStamp: ToolId = 'brush';
  /** Structure tenue en main (tampon ou glisser-déposer). */
  private held: Pattern | null = null;
  /** Dernière copie faite avec Copier / Couper. */
  private clipboard: Pattern | null = null;

  constructor(dependencies: EditorDependencies) {
    super();
    this.world = dependencies.world;
    this.simulation = dependencies.simulation;
    this.camera = dependencies.camera;
    this.images = dependencies.images;
    this.library = dependencies.library;
    this.invalidate = dependencies.invalidate;
    this.tools = {
      select: new SelectTool(this),
      hand: new HandTool(this),
      brush: new PaintTool(this, 'brush'),
      eraser: new PaintTool(this, 'eraser'),
      stamp: new StampTool(this),
    };
    this.activeTool = this.tools.brush;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Outils
  // ──────────────────────────────────────────────────────────────────────────

  get tool(): Tool {
    return this.activeTool;
  }

  /** L'outil « main », utilisable à tout moment (bouton du milieu de la souris). */
  get handTool(): Tool {
    return this.tools.hand;
  }

  setTool(id: ToolId): void {
    if (id === this.activeTool.id) return;
    this.activeTool.cancel();
    if (this.activeTool.id === 'stamp' && id !== 'stamp') this.dropHeld();
    if (id !== 'select') this.setSelection(null);
    this.activeTool = this.tools[id];
    this.setHover(null);
    this.emit('tool', id);
  }

  /** Touche Échap : on abandonne ce qu'on est en train de faire. */
  cancel(): void {
    this.activeTool.cancel();
    if (this.held) this.stopStamp();
    else if (this.overlay.selection) this.setSelection(null);
  }

  setHover(hover: Overlay['hover']): void {
    const before = this.overlay.hover;
    if (before?.x === hover?.x && before?.y === hover?.y && before?.mode === hover?.mode) return;
    this.overlay.hover = hover;
    this.invalidate();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Sélection
  // ──────────────────────────────────────────────────────────────────────────

  get selection(): CellRect | null {
    return this.overlay.selection;
  }

  setSelection(rect: CellRect | null): void {
    this.overlay.selection = rect;
    this.emit('selection', rect);
    this.invalidate();
  }

  /** Copie le contenu de la sélection. @returns la structure copiée (null si la zone est vide). */
  copySelection(): Pattern | null {
    if (!this.overlay.selection) return null;
    const pattern = this.world.extractRect(this.overlay.selection);
    if (pattern) this.clipboard = pattern;
    return pattern;
  }

  /** Supprime les cellules de la sélection. */
  deleteSelection(): void {
    if (!this.overlay.selection) return;
    this.world.clearRect(this.overlay.selection);
    this.simulation.markEdited();
    this.invalidate();
  }

  /** Copier puis supprimer. */
  cutSelection(): Pattern | null {
    const pattern = this.copySelection();
    this.deleteSelection();
    return pattern;
  }

  /** Ajoute le contenu de la sélection à la bibliothèque (« Mes structures »). */
  saveSelectionAsStructure(): boolean {
    if (!this.overlay.selection) return false;
    const pattern = this.world.extractRect(this.overlay.selection);
    if (!pattern) return false;
    this.library.addCustom(pattern);
    return true;
  }

  /** Coller : on prend la dernière copie « en main », prête à être posée. */
  pasteClipboard(): boolean {
    if (!this.clipboard) return false;
    this.startStamp(this.clipboard);
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Structures tenues en main (tampon, glisser-déposer)
  // ──────────────────────────────────────────────────────────────────────────

  get heldPattern(): Pattern | null {
    return this.held;
  }

  /** Prend une structure en main et passe en outil Tampon (un clic = une copie posée). */
  startStamp(pattern: Pattern): void {
    if (this.activeTool.id !== 'stamp') this.toolBeforeStamp = this.activeTool.id;
    this.setHeld(pattern);
    this.setTool('stamp');
  }

  /** Range la structure et revient à l'outil précédent. */
  stopStamp(): void {
    this.dropHeld();
    if (this.activeTool.id === 'stamp') this.setTool(this.toolBeforeStamp);
  }

  /** Glisser-déposer depuis la bibliothèque : début (sans changer d'outil). */
  beginDrag(pattern: Pattern): void {
    if (this.activeTool.id === 'stamp') this.stopStamp();
    this.setHeld(pattern);
  }

  /** Le pointeur quitte la grille : on cache la case survolée et l'aperçu du tampon. */
  hidePreviews(): void {
    this.setHover(null);
    if (this.overlay.ghost) {
      this.overlay.ghost = null;
      this.invalidate();
    }
  }

  /** Glisser-déposer : le pointeur bouge. `overGrid` = faux s'il survole un panneau. */
  dragTo(screenX: number, screenY: number, overGrid: boolean): void {
    if (!overGrid) {
      this.overlay.ghost = null;
      this.invalidate();
      return;
    }
    const cell = this.camera.screenToCell(screenX, screenY);
    this.showGhostAt(cell.x, cell.y);
  }

  /** Glisser-déposer : on lâche. La structure est posée seulement au-dessus de la grille. */
  endDrag(screenX: number, screenY: number, overGrid: boolean): void {
    if (overGrid) {
      const cell = this.camera.screenToCell(screenX, screenY);
      this.placeHeldPatternAt(cell.x, cell.y);
    }
    this.dropHeld();
  }

  /** Tourne d'un quart de tour la structure en main (touche R). */
  rotateHeld(): void {
    if (this.held) this.setHeld(rotateClockwise(this.held), true);
  }

  /** Retourne (miroir) la structure en main (touche F). */
  flipHeld(): void {
    if (this.held) this.setHeld(flipHorizontal(this.held), true);
  }

  /** Affiche l'aperçu de la structure en main, centrée sur la case (cellX, cellY). */
  showGhostAt(cellX: number, cellY: number): void {
    if (!this.held) return;
    const pattern = this.patternToPlace(this.held);
    this.overlay.ghost = {
      pattern,
      x: cellX - Math.floor(pattern.width / 2),
      y: cellY - Math.floor(pattern.height / 2),
    };
    this.invalidate();
  }

  /** Pose la structure en main, centrée sur la case (cellX, cellY). */
  placeHeldPatternAt(cellX: number, cellY: number): void {
    if (this.held) this.placePatternAt(this.held, cellX, cellY);
  }

  /** Pose n'importe quelle structure, centrée sur une case. */
  placePatternAt(pattern: Pattern, cellX: number, cellY: number): void {
    const toPlace = this.patternToPlace(pattern);
    const originX = cellX - Math.floor(toPlace.width / 2);
    const originY = cellY - Math.floor(toPlace.height / 2);
    if (this.world.placePattern(toPlace, originX, originY) > 0) {
      this.simulation.markEdited();
    }
    this.invalidate();
  }

  /**
   * Les structures sans image prennent l'image choisie dans la bibliothèque
   * d'images (comme le pinceau). Une copie qui contient déjà des images les garde.
   */
  private patternToPlace(pattern: Pattern): Pattern {
    const skin = this.images.current;
    return skin !== 0 && !hasSkins(pattern) ? withSkin(pattern, skin) : pattern;
  }

  private setHeld(pattern: Pattern | null, keepGhostPosition = false): void {
    const ghost = this.overlay.ghost;
    this.held = pattern;
    if (!pattern) {
      this.overlay.ghost = null;
    } else if (keepGhostPosition && ghost) {
      // Après une rotation, on garde l'aperçu au même endroit (centré sur le même point).
      const centerX = ghost.x + Math.floor(ghost.pattern.width / 2);
      const centerY = ghost.y + Math.floor(ghost.pattern.height / 2);
      this.showGhostAt(centerX, centerY);
    }
    this.emit('held', pattern);
    this.invalidate();
  }

  private dropHeld(): void {
    if (this.held) this.setHeld(null);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Vue
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Recentre la vue sur toutes les cellules vivantes (ou sur l'origine si le monde est vide).
   * `insets` = place occupée par les panneaux, pour centrer dans la zone réellement visible.
   */
  centerView(insets?: Insets): void {
    const box = this.world.boundingBox() ?? { x0: -20, y0: -12, x1: 20, y1: 12 };
    this.camera.fitRect(box, insets);
  }
}

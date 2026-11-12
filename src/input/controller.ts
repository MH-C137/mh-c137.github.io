/**
 * ============================================================================
 *  controller.ts — Traduit les gestes (souris, doigts, molette) en actions
 * ============================================================================
 *
 * Le navigateur envoie des « Pointer Events » : un seul système pour la souris,
 * le doigt et le stylet. Le contrôleur :
 *   1. convertit la position écran en case du monde (via la caméra) ;
 *   2. transmet le geste à l'outil actif (patron État) ;
 *   3. gère lui-même les gestes « universels », valables quel que soit l'outil :
 *        - molette = zoom vers le curseur ;
 *        - bouton du milieu = déplacer la vue ;
 *        - deux doigts = pincer pour zoomer et glisser pour se déplacer.
 *
 * `setPointerCapture` : une fois le bouton appuyé sur la grille, on continue à
 * recevoir les mouvements même si le pointeur sort de la fenêtre. Un trait de
 * pinceau ne se « coince » donc jamais.
 */

import type { Editor } from './editor';
import type { PointerInfo, Tool } from './tools';

export class InputController {
  /** Pointeurs actuellement posés (un par doigt, ou la souris). */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** Outil qui reçoit le geste en cours (la main si bouton du milieu). */
  private gestureTool: Tool | null = null;
  /** État du pincement à deux doigts : distance et milieu au mouvement précédent. */
  private pinch: { distance: number; midX: number; midY: number } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly editor: Editor,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', () => {
      if (!this.gestureTool) editor.hidePreviews();
    });
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault()); // clic droit = gomme
    editor.on('tool', () => this.updateCursor());
    this.updateCursor();
  }

  /** Convertit un événement du navigateur en informations utiles pour un outil. */
  private toPointerInfo(event: PointerEvent): PointerInfo {
    const bounds = this.canvas.getBoundingClientRect();
    const screenX = event.clientX - bounds.left;
    const screenY = event.clientY - bounds.top;
    const cell = this.editor.camera.screenToCell(screenX, screenY);
    return { screenX, screenY, cellX: cell.x, cellY: cell.y, button: event.button };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      // Deuxième doigt : on abandonne le trait commencé et on passe en mode « pincer ».
      this.gestureTool?.cancel();
      this.gestureTool = null;
      this.pinch = this.measurePinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.gestureTool = event.button === 1 ? this.editor.handTool : this.editor.tool;
    this.gestureTool.pointerDown(this.toPointerInfo(event));
    this.updateCursor();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (this.pinch) {
      this.updatePinch();
      return;
    }
    const info = this.toPointerInfo(event);
    if (this.gestureTool) this.gestureTool.pointerMove(info, true);
    else this.editor.tool.pointerMove(info, false); // simple survol (aperçus)
    this.updateCursor();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    if (this.gestureTool) {
      this.gestureTool.pointerUp(this.toPointerInfo(event));
      this.gestureTool = null;
    }
    this.updateCursor();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.gestureTool?.cancel();
    this.gestureTool = null;
    if (this.pointers.size < 2) this.pinch = null;
  };

  /**
   * Molette : zoom vers le curseur. Le facteur est exponentiel (e^−delta) :
   * deux crans dans un sens puis deux dans l'autre ramènent exactement au zoom
   * de départ. Avec Ctrl (pincement sur pavé tactile), les deltas sont plus petits.
   */
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const bounds = this.canvas.getBoundingClientRect();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY; // 1 = en lignes (Firefox)
    const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015));
    this.editor.camera.zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, factor);
  };

  /** Distance entre les deux doigts et position de leur milieu. */
  private measurePinch(): { distance: number; midX: number; midY: number } {
    const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return {
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  }

  /**
   * Pincer : le zoom suit le rapport des distances entre les doigts
   * (doigts deux fois plus écartés = zoom × 2), et la vue suit leur milieu.
   */
  private updatePinch(): void {
    if (!this.pinch || this.pointers.size < 2) return;
    const current = this.measurePinch();
    const bounds = this.canvas.getBoundingClientRect();
    const camera = this.editor.camera;
    camera.zoomAt(current.midX - bounds.left, current.midY - bounds.top, current.distance / this.pinch.distance);
    camera.panBy(current.midX - this.pinch.midX, current.midY - this.pinch.midY);
    this.pinch = current;
  }

  private updateCursor(): void {
    this.canvas.style.cursor = (this.gestureTool ?? this.editor.tool).cursor;
  }
}

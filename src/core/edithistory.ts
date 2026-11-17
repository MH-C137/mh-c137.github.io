/**
 * ============================================================================
 *  edithistory.ts — Annuler / Rétablir les modifications de l'utilisateur
 * ============================================================================
 *
 * Deux piles de « photos » du monde (voir WorldSnapshot) :
 *   - `undo` : l'état AVANT chaque modification (un trait de crayon, une
 *     structure posée, une suppression, « Effacer »…). Le dessus de la pile est
 *     l'état à retrouver quand on clique sur « Annuler ».
 *   - `redo` : les états qu'on vient d'annuler, pour pouvoir les rétablir.
 *
 * Annuler = prendre la photo du dessus de `undo`, mettre l'état ACTUEL dans
 * `redo`. Rétablir = l'inverse. Faire une nouvelle modification vide `redo`
 * (on ne peut plus « rétablir » un futur qui n'existe plus).
 *
 * C'est une différence avec le temps du jeu (history.ts) : ici on annule ce
 * que la PERSONNE a fait, pas les générations calculées par les règles.
 *
 * Mémoire : on garde au plus `maxSteps` modifications et `maxCells` cellules
 * au total ; les plus anciennes sont oubliées en premier. Pas de DOM ici : ce
 * fichier reste testable avec Node.
 */

import { snapshotSize, type WorldSnapshot } from './world';

export interface EditHistoryLimits {
  maxSteps: number;
  maxCells: number;
}

export const DEFAULT_EDIT_LIMITS: EditHistoryLimits = { maxSteps: 100, maxCells: 1_000_000 };

export class EditHistory {
  private undoStack: WorldSnapshot[] = [];
  private redoStack: WorldSnapshot[] = [];

  constructor(private readonly limits: EditHistoryLimits = DEFAULT_EDIT_LIMITS) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Enregistre l'état d'AVANT une modification. Vide la pile « rétablir »,
   * puis oublie les plus anciennes photos si les limites sont dépassées.
   */
  record(before: WorldSnapshot): void {
    this.undoStack.push(before);
    this.redoStack = [];
    this.trim();
  }

  /**
   * Annule : rend l'état d'avant la dernière modification.
   * @param current l'état actuel du monde (il part dans la pile « rétablir »)
   * @returns la photo à restaurer, ou null s'il n'y a rien à annuler
   */
  undo(current: WorldSnapshot): WorldSnapshot | null {
    const before = this.undoStack.pop();
    if (!before) return null;
    this.redoStack.push(current);
    return before;
  }

  /** Rétablit : l'inverse d'`undo`. */
  redo(current: WorldSnapshot): WorldSnapshot | null {
    const after = this.redoStack.pop();
    if (!after) return null;
    this.undoStack.push(current);
    return after;
  }

  /** Oublie tout (ex. après avoir chargé un autre monde). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Respecte les limites : on retire les photos les plus anciennes d'abord. */
  private trim(): void {
    let cells = this.undoStack.reduce((sum, snapshot) => sum + snapshotSize(snapshot), 0);
    while (this.undoStack.length > this.limits.maxSteps || (cells > this.limits.maxCells && this.undoStack.length > 1)) {
      const oldest = this.undoStack.shift()!;
      cells -= snapshotSize(oldest);
    }
  }
}

/**
 * ============================================================================
 *  history.ts — L'historique, pour pouvoir RECULER dans le temps
 * ============================================================================
 *
 * Pourquoi un historique ? Parce que le jeu de la vie est IRRÉVERSIBLE : on ne
 * peut pas calculer la génération précédente à partir de l'actuelle.
 *   - Plusieurs passés différents mènent au même présent (une cellule seule et
 *     une case vide donnent toutes les deux… une case vide).
 *   - Certaines configurations n'ont même aucun passé possible : on les appelle
 *     des « jardins d'Éden ».
 * Pour revenir en arrière, il faut donc se SOUVENIR des générations passées.
 *
 * Structure : deux PILES (comme « Annuler / Rétablir » dans un traitement de texte).
 *
 *     passé (pile)                présent                futur (pile)
 *   [g0, g1, g2, g3]   ←──── reculer ────  g4  ──── avancer ────→  [g6, g5]
 *
 *   - Avancer  : on empile le présent dans « passé », puis on prend le sommet de
 *                « futur » s'il existe (sinon on calcule la génération suivante).
 *   - Reculer  : on empile le présent dans « futur », puis on dépile « passé ».
 *   - Modifier la grille (pinceau, structure…) crée un nouvel avenir : on vide « futur ».
 *
 * Mémoire : chaque photo coûte de la place. On limite donc le nombre de photos
 * ET le nombre total de cellules mémorisées ; au-delà, on oublie les plus anciennes.
 */

import { snapshotSize, type WorldSnapshot } from './world';

export interface HistoryLimits {
  /** Nombre maximal de générations mémorisées dans le passé. */
  readonly maxSteps: number;
  /** Nombre maximal de cellules mémorisées (toutes photos confondues). */
  readonly maxCells: number;
}

export const DEFAULT_HISTORY_LIMITS: HistoryLimits = { maxSteps: 1000, maxCells: 2_000_000 };

export class History {
  private past: WorldSnapshot[] = [];
  private future: WorldSnapshot[] = [];
  /** Nombre total de cellules dans la pile « passé » (tenu à jour pour éviter de recompter). */
  private pastCells = 0;

  constructor(private readonly limits: HistoryLimits = DEFAULT_HISTORY_LIMITS) {}

  get canGoBack(): boolean {
    return this.past.length > 0;
  }

  get canGoForward(): boolean {
    return this.future.length > 0;
  }

  /** Nombre de générations mémorisées en arrière. */
  get pastLength(): number {
    return this.past.length;
  }

  /** Mémorise une génération dans le passé, puis applique les limites de mémoire. */
  pushPast(snapshot: WorldSnapshot): void {
    this.past.push(snapshot);
    this.pastCells += snapshotSize(snapshot);
    // On oublie les plus anciennes photos (début du tableau) tant qu'on dépasse
    // les limites. On garde toujours au moins la dernière, pour pouvoir reculer d'un pas.
    while (
      this.past.length > 1 &&
      (this.past.length > this.limits.maxSteps || this.pastCells > this.limits.maxCells)
    ) {
      const oldest = this.past.shift() as WorldSnapshot;
      this.pastCells -= snapshotSize(oldest);
    }
  }

  /** Reprend la génération la plus récente du passé (undefined s'il n'y en a pas). */
  popPast(): WorldSnapshot | undefined {
    const snapshot = this.past.pop();
    if (snapshot) this.pastCells -= snapshotSize(snapshot);
    return snapshot;
  }

  pushFuture(snapshot: WorldSnapshot): void {
    this.future.push(snapshot);
  }

  popFuture(): WorldSnapshot | undefined {
    return this.future.pop();
  }

  /** Oublie l'avenir mémorisé (appelé dès que l'utilisateur modifie la grille). */
  clearFuture(): void {
    this.future = [];
  }

  /** Oublie tout. */
  clear(): void {
    this.past = [];
    this.future = [];
    this.pastCells = 0;
  }
}

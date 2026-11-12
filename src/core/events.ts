/**
 * ============================================================================
 *  events.ts — Un petit système d'événements (patron OBSERVATEUR)
 * ============================================================================
 *
 * Problème : quand la simulation avance d'une génération, plusieurs parties de
 * l'application doivent réagir (le compteur de générations, le dessin de la
 * grille, les boutons « reculer »…). On ne veut pas que la simulation connaisse
 * toutes ces parties : elle « annonce » simplement ce qui s'est passé.
 *
 * Solution : le patron Observateur.
 *   - un objet « sujet » hérite d'`Emitter` et appelle `emit('change', infos)` ;
 *   - les « observateurs » s'abonnent avec `on('change', fonction)` ;
 *   - `on` renvoie une fonction de désabonnement.
 *
 * Le type générique `Events` décrit, pour chaque nom d'événement, le type des
 * données envoyées. TypeScript vérifie ainsi qu'on n'émet jamais un événement
 * inconnu ou avec de mauvaises données.
 */

export type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  /** Pour chaque événement, l'ensemble des fonctions abonnées. */
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** S'abonne à un événement. Renvoie une fonction qui annule l'abonnement. */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  /** Prévient tous les abonnés d'un événement, dans l'ordre d'abonnement. */
  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) (listener as Listener<Events[K]>)(payload);
  }
}

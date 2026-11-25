/**
 * ============================================================================
 *  viewsettings.ts — Les réglages d'affichage (pour l'instant : la grille)
 * ============================================================================
 *
 * Réglages : la grille (visible ou non) et les « options avancées » (affichent
 * Annuler / Rétablir dans le menu).
 *
 * Même idée que ThemeManager : un petit objet qui garde le réglage, le
 * transmet au renderer, le retient d'une visite à l'autre (localStorage) et
 * PRÉVIENT l'interface quand il change (patron Observateur). Le bouton
 * « Grille » du menu appelle `toggleGrid()` et se met à jour en écoutant
 * l'événement « change ».
 */

import { Emitter } from '../core/events';
import type { Renderer } from '../render/renderer';

// Clé versionnée (« :v2 ») : une ancienne valeur « grille masquée » mémorisée par une version précédente n'est plus relue,
// la grille est donc visible pour tout le monde après cette mise à jour.
const GRID_KEY = 'jeu-de-la-vie:grille:v2';
const ADVANCED_KEY = 'jeu-de-la-vie:avance';

export class ViewSettings extends Emitter<{ change: void }> {
  private grid: boolean;
  private advanced: boolean;

  constructor(private readonly renderer: Renderer) {
    super();
    this.grid = readSaved(GRID_KEY) ?? true; // la grille est visible par défaut
    this.advanced = readSaved(ADVANCED_KEY) ?? false; // options avancées masquées par défaut
    this.apply();
  }

  /** Vrai si les lignes de la grille sont dessinées. */
  get gridVisible(): boolean {
    return this.grid;
  }

  /** Vrai si les options avancées (Annuler / Rétablir…) sont affichées. */
  get advancedVisible(): boolean {
    return this.advanced;
  }

  /** Affiche ou masque la grille, et retient le choix. */
  toggleGrid(): void {
    this.grid = !this.grid;
    this.save(GRID_KEY, this.grid);
    this.apply();
  }

  /** Affiche ou masque les options avancées, et retient le choix. */
  toggleAdvanced(): void {
    this.advanced = !this.advanced;
    this.save(ADVANCED_KEY, this.advanced);
    this.apply();
  }

  private save(key: string, value: boolean): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Stockage indisponible (navigation privée, iframe…) : le choix ne sera juste pas retenu.
    }
  }

  private apply(): void {
    this.renderer.gridVisible = this.grid;
    this.emit('change', undefined);
  }
}

function readSaved(key: string): boolean | null {
  try {
    const saved = localStorage.getItem(key);
    return saved === 'true' ? true : saved === 'false' ? false : null;
  } catch {
    return null;
  }
}

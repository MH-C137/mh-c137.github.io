/**
 * ============================================================================
 *  viewsettings.ts — Les réglages d'affichage (pour l'instant : la grille)
 * ============================================================================
 *
 * Même idée que ThemeManager : un petit objet qui garde le réglage, le
 * transmet au renderer, le retient d'une visite à l'autre (localStorage) et
 * PRÉVIENT l'interface quand il change (patron Observateur). Le bouton
 * « Grille » du menu appelle `toggleGrid()` et se met à jour en écoutant
 * l'événement « change ».
 */

import { Emitter } from '../core/events';
import type { Renderer } from '../render/renderer';

const STORAGE_KEY = 'jeu-de-la-vie:grille';

export class ViewSettings extends Emitter<{ change: void }> {
  private grid: boolean;

  constructor(private readonly renderer: Renderer) {
    super();
    this.grid = readSavedGrid() ?? true; // la grille est visible par défaut
    this.apply();
  }

  /** Vrai si les lignes de la grille sont dessinées. */
  get gridVisible(): boolean {
    return this.grid;
  }

  /** Affiche ou masque la grille, et retient le choix. */
  toggleGrid(): void {
    this.grid = !this.grid;
    this.apply();
    try {
      localStorage.setItem(STORAGE_KEY, String(this.grid));
    } catch {
      // Stockage indisponible (navigation privée, iframe…) : le choix ne sera juste pas retenu.
    }
  }

  private apply(): void {
    this.renderer.gridVisible = this.grid;
    this.emit('change', undefined);
  }
}

function readSavedGrid(): boolean | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'true' ? true : saved === 'false' ? false : null;
  } catch {
    return null;
  }
}

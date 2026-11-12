/**
 * ============================================================================
 *  ui/theme.ts — Bascule mode nuit / mode jour
 * ============================================================================
 *
 * Appliquer un thème, c'est :
 *   1. donner la palette au renderer (couleurs de la grille) ;
 *   2. écrire les couleurs des cellules dans des variables CSS (--cell-newborn…),
 *      pour que la légende de l'interface utilise EXACTEMENT les mêmes ;
 *   3. poser `data-theme="night"` ou `"day"` sur <body> : la feuille de style
 *      (styles.css) choisit alors ses couleurs d'interface ;
 *   4. mémoriser le choix dans le navigateur (localStorage) pour la prochaine visite.
 */

import { Emitter } from '../core/events';
import type { Renderer } from '../render/renderer';
import { PALETTES, type Palette, type ThemeName } from '../render/theme';

const STORAGE_KEY = 'jeu-de-la-vie:theme';

export class ThemeManager extends Emitter<{ change: ThemeName }> {
  private current: ThemeName;

  constructor(private readonly renderer: Renderer) {
    super();
    this.current = readSavedTheme() ?? 'night';
    this.apply();
  }

  get name(): ThemeName {
    return this.current;
  }

  get palette(): Palette {
    return PALETTES[this.current];
  }

  toggle(): void {
    this.current = this.current === 'night' ? 'day' : 'night';
    this.apply();
    try {
      localStorage.setItem(STORAGE_KEY, this.current);
    } catch {
      // Stockage indisponible (navigation privée, iframe…) : le choix ne sera juste pas retenu.
    }
  }

  private apply(): void {
    const palette = PALETTES[this.current];
    this.renderer.palette = palette;
    const style = document.body.style;
    style.setProperty('--cell-newborn', palette.newborn);
    style.setProperty('--cell-alive', palette.alive);
    style.setProperty('--cell-trace', palette.trace);
    style.setProperty('--cell-dead', palette.background);
    document.body.dataset.theme = this.current;
    this.emit('change', this.current);
  }
}

function readSavedTheme(): ThemeName | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'night' || saved === 'day' ? saved : null;
  } catch {
    return null;
  }
}

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
 *
 * Options avancées : on peut aussi choisir la couleur des cellules « nées » et
 * « vivantes ». Les choix sont gardés séparément pour le mode nuit et le mode jour
 * (une couleur claire est belle sur fond noir, invisible sur fond clair).
 */

import { Emitter } from '../core/events';
import type { Renderer } from '../render/renderer';
import { applyCustomColors, PALETTES, type CustomColors, type Palette, type ThemeName } from '../render/theme';

const STORAGE_KEY = 'jeu-de-la-vie:theme';
const COLORS_KEY = 'jeu-de-la-vie:couleurs';

export class ThemeManager extends Emitter<{ change: ThemeName }> {
  private current: ThemeName;
  /** Couleurs choisies, pour chaque thème. */
  private custom: Record<ThemeName, CustomColors> = { night: {}, day: {} };

  constructor(private readonly renderer: Renderer) {
    super();
    this.current = readSavedTheme() ?? 'night';
    this.custom = readSavedColors();
    this.apply();
  }

  get name(): ThemeName {
    return this.current;
  }

  /** Palette utilisée en ce moment : celle du thème, avec les couleurs choisies. */
  get palette(): Palette {
    return applyCustomColors(PALETTES[this.current], this.custom[this.current], this.current);
  }

  /** Vrai si au moins une couleur a été changée pour le thème actuel. */
  get hasCustomColors(): boolean {
    return Object.keys(this.custom[this.current]).length > 0;
  }

  /** Change la couleur des cellules « nées » ou « vivantes » (thème actuel) et la retient. */
  setColor(kind: keyof CustomColors, hex: string): void {
    this.custom[this.current] = { ...this.custom[this.current], [kind]: hex };
    this.saveColors();
    this.apply();
  }

  /** Remet les couleurs d'origine (thème actuel). */
  resetColors(): void {
    this.custom[this.current] = {};
    this.saveColors();
    this.apply();
  }

  private saveColors(): void {
    try {
      localStorage.setItem(COLORS_KEY, JSON.stringify(this.custom));
    } catch {
      // Stockage indisponible : les couleurs ne seront juste pas retenues.
    }
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
    const palette = this.palette;
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

/** Relit les couleurs choisies (en vérifiant que ce sont bien des « #rrggbb » : le stockage peut contenir n'importe quoi). */
function readSavedColors(): Record<ThemeName, CustomColors> {
  const result: Record<ThemeName, CustomColors> = { night: {}, day: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(COLORS_KEY) ?? '{}') as Record<string, Record<string, unknown>>;
    for (const theme of ['night', 'day'] as const) {
      for (const kind of ['newborn', 'alive'] as const) {
        const value = saved[theme]?.[kind];
        if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) result[theme][kind] = value.toLowerCase();
      }
    }
  } catch {
    // Stockage indisponible ou contenu illisible : couleurs d'origine.
  }
  return result;
}

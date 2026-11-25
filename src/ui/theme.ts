/**
 * ============================================================================
 *  ui/theme.ts — Bascule mode nuit / mode jour
 * ============================================================================
 *
 * Les couleurs viennent de la DA active (src/da/, voir docs/DA.md) : chaque DA décrit ses
 * deux thèmes. Appliquer un thème, c'est :
 *   1. donner la palette au renderer (couleurs de la grille) ;
 *   2. écrire les couleurs des cellules dans des variables CSS (--cell-newborn…),
 *      pour que la légende de l'interface utilise EXACTEMENT les mêmes ;
 *   3. poser `data-theme="night"` ou `"day"` sur <body> : la feuille de style
 *      (styles.css) choisit alors ses couleurs d'interface ;
 *   4. mémoriser le choix dans le navigateur (localStorage) pour la prochaine visite.
 *
 * Les réglages de l'outil « Config DA » (options avancées) sont gardés séparément pour le
 * mode nuit et le mode jour : ils passent par la DA (src/da/runtime.ts), qui prévient ce
 * gestionnaire quand l'un d'eux change.
 */

import { Emitter } from '../core/events';
import type { Renderer } from '../render/renderer';
import type { DesignRuntime } from '../da/runtime';
import type { Palette, ThemeName } from '../render/theme';

const STORAGE_KEY = 'jeu-de-la-vie:theme';

export class ThemeManager extends Emitter<{ change: ThemeName }> {
  private current: ThemeName;

  constructor(
    private readonly renderer: Renderer,
    /** La DA : donne les palettes des deux thèmes (voir src/da/). */
    private readonly design: DesignRuntime,
  ) {
    super();
    this.current = readSavedTheme() ?? design.design.pack.defaultTheme;
    this.apply();
    // Un réglage de l'outil « Config DA » : on réapplique tout (palette, variables CSS, fond…).
    design.on('change', () => this.apply());
  }

  get name(): ThemeName {
    return this.current;
  }

  /** Palette utilisée en ce moment : celle de la DA pour ce thème, avec les réglages de l'outil « Config DA ». */
  get palette(): Palette {
    return this.design.palette(this.current);
  }

  /** Choisit le thème (nuit ou jour) et le retient. */
  set(name: ThemeName): void {
    if (name === this.current) return;
    this.current = name;
    this.apply();
    try {
      localStorage.setItem(STORAGE_KEY, this.current);
    } catch {
      // Stockage indisponible (navigation privée, iframe…) : le choix ne sera juste pas retenu.
    }
  }

  toggle(): void {
    this.set(this.current === 'night' ? 'day' : 'night');
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
    this.design.applyTheme(this.current); // couleurs de l'interface, titre et fond de la DA
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

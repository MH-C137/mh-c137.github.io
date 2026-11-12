/**
 * ============================================================================
 *  theme.ts — Les couleurs (mode nuit néon / mode jour)
 * ============================================================================
 *
 * Une seule source de vérité pour les couleurs : ces palettes servent à la fois
 * au dessin de la grille (canvas) et à l'interface (variables CSS appliquées par
 * ui/theme.ts). Changer une couleur ici la change partout.
 *
 * Les 4 états d'une case :
 *   née (cyan vif) → vivante (violet) → vient de mourir (violet sombre) → morte (fond).
 * Le dégradé suit le « cycle de vie » : l'énergie de la naissance, la maturité,
 * puis une trace qui s'éteint.
 */

export type ThemeName = 'night' | 'day';

export interface Palette {
  /** Fond = cases mortes. */
  readonly background: string;
  /** Lignes de la grille (fines) et lignes toutes les 10 cases (plus visibles). */
  readonly grid: string;
  readonly gridMajor: string;
  /** Cellule née à cette génération. */
  readonly newborn: string;
  /** Cellule vivante depuis au moins une génération. */
  readonly alive: string;
  /** Cellule qui vient de mourir (la trace). */
  readonly trace: string;
  /** Sélection rectangulaire. */
  readonly selectionStroke: string;
  readonly selectionFill: string;
  /** Contour de la case survolée par la gomme. */
  readonly erase: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  night: {
    background: '#05050b',
    grid: 'rgba(120, 130, 255, 0.07)',
    gridMajor: 'rgba(120, 130, 255, 0.16)',
    newborn: '#3cf2ff',
    alive: '#a45cff',
    trace: '#2d1b4e',
    selectionStroke: '#3cf2ff',
    selectionFill: 'rgba(60, 242, 255, 0.08)',
    erase: '#ff4d8d',
  },
  day: {
    background: '#f3f0e8',
    grid: 'rgba(40, 30, 90, 0.07)',
    gridMajor: 'rgba(40, 30, 90, 0.15)',
    newborn: '#008ca6',
    alive: '#6a2bd4',
    trace: '#dccdf2',
    selectionStroke: '#008ca6',
    selectionFill: 'rgba(0, 140, 166, 0.08)',
    erase: '#d6336c',
  },
};

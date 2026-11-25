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
 * En plus, une cellule vivante clignote (violet clair) toutes les 3 générations.
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
  /** Cellule vivante qui « clignote » (toutes les 3 générations passées en vie). */
  readonly pulse: string;
  /** Cellule qui vient de mourir (la trace). */
  readonly trace: string;
  /** Sélection rectangulaire. */
  readonly selectionStroke: string;
  readonly selectionFill: string;
  /** Contour de la case survolée par la gomme. */
  readonly erase: string;
  /** Cellule morte depuis deux générations : seul son contour est dessiné (DA qui l'active). */
  readonly fade: string;
  /** Contour dessiné autour des cellules en forme d'icône (DA qui l'active). */
  readonly outline: string;
  /** La « vitre » : teinte posée entre l'image de fond et la grille, pour que le fond reste derrière. */
  readonly glass: string;
  /** Couleur des étoiles de la constellation de fond. */
  readonly stars: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  night: {
    background: '#05050b',
    grid: 'rgba(120, 130, 255, 0.2)',
    gridMajor: 'rgba(120, 130, 255, 0.4)',
    newborn: '#3cf2ff',
    alive: '#a45cff',
    pulse: '#dcc2ff',
    trace: '#2d1b4e',
    selectionStroke: '#3cf2ff',
    selectionFill: 'rgba(60, 242, 255, 0.08)',
    erase: '#ff4d8d',
    fade: 'rgba(0, 0, 0, 0)',
    outline: 'rgba(0, 0, 0, 0)',
    glass: 'rgba(0, 0, 0, 0)',
    stars: 'rgba(0, 0, 0, 0)',
  },
  day: {
    background: '#f3f0e8',
    grid: 'rgba(40, 30, 90, 0.18)',
    gridMajor: 'rgba(40, 30, 90, 0.36)',
    newborn: '#008ca6',
    alive: '#6a2bd4',
    pulse: '#3a0f8f',
    trace: '#dccdf2',
    selectionStroke: '#008ca6',
    selectionFill: 'rgba(0, 140, 166, 0.08)',
    erase: '#d6336c',
    fade: 'rgba(0, 0, 0, 0)',
    outline: 'rgba(0, 0, 0, 0)',
    glass: 'rgba(0, 0, 0, 0)',
    stars: 'rgba(0, 0, 0, 0)',
  },
};

// ────────────────────────────────────────────────────────────────────────────
//  Couleurs personnalisées (options avancées)
// ────────────────────────────────────────────────────────────────────────────

/** Les deux couleurs que la personne peut choisir ; les autres (clignotement, trace) en sont déduites. */
export interface CustomColors {
  newborn?: string;
  alive?: string;
}

/** Mélange deux couleurs « #rrggbb » : `amount` = part de `b` (0 = a, 1 = b). */
export function mixColors(a: string, b: string, amount: number): string {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + 2 * index, 3 + 2 * index), 16);
  const part = (index: number) =>
    Math.round(channel(a, index) * (1 - amount) + channel(b, index) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${part(0)}${part(1)}${part(2)}`;
}

/**
 * Palette finale = palette du thème + couleurs choisies.
 *   - « née » et « vivante » : telles que choisies ;
 *   - clignotement : la couleur vivante éclaircie (nuit) ou assombrie (jour) ;
 *   - trace (vient de mourir) : la couleur vivante presque fondue dans le fond.
 * Sans couleur choisie, on garde exactement la palette du thème.
 */
export function applyCustomColors(base: Palette, custom: CustomColors, theme: ThemeName): Palette {
  const newborn = custom.newborn ?? base.newborn;
  const alive = custom.alive ?? base.alive;
  if (custom.alive === undefined) return { ...base, newborn };
  return {
    ...base,
    newborn,
    alive,
    pulse: mixColors(alive, theme === 'night' ? '#ffffff' : '#000000', theme === 'night' ? 0.55 : 0.45),
    trace: mixColors(alive, base.background, 0.8),
  };
}

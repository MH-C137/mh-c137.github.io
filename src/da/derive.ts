/**
 * ============================================================================
 *  derive.ts — Des couleurs « dominantes » aux nuances de l'interface
 * ============================================================================
 *
 * Dans l'outil « Config DA », on ne choisit pas 25 couleurs : on choisit quelques RÔLES
 * (panneaux, détails, écriture, légende…) parmi les couleurs de la palette de la DA, et le
 * site DÉDUIT toutes les nuances qui en dépendent :
 *
 *   Panneaux = jaune        → boutons = un peu plus clairs, survol = encore un peu, bords doux…
 *   Détails  = violet       → bouton actif = violet, texte du bouton actif = la couleur de la
 *                             palette la plus lisible dessus, titres = violet éclairci
 *                             jusqu'à être lisible sur les panneaux…
 *
 * Trois outils de calcul, tous sur des couleurs « #rrggbb » :
 *   - MÉLANGER deux couleurs (`mix`) : dégradés et teintes intermédiaires ;
 *   - ÉCLAIRCIR ou ASSOMBRIR (`nudge`) : vers le blanc si la couleur est sombre, vers le noir
 *     si elle est claire (un bouton se distingue de son panneau dans les deux cas) ;
 *   - LISIBILITÉ : le « contraste » entre deux couleurs (formule officielle WCAG) permet de
 *     choisir, parmi les couleurs de la palette, celle qui se lit le mieux sur un fond
 *     (`bestOn`), ou d'éclaircir / assombrir une couleur jusqu'à ce qu'elle soit lisible
 *     (`readableOn`).
 *
 * Fichier pur (aucun navigateur) : tout est testé avec Node.
 */

import { alphaOf, colorWithAlpha, hexOf, parseCssColor, recolor, type Rgba } from './overrides';
import type { CellColors, DesignTheme, RoleKey, Roles, UiColors } from './schema';

const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
const hexFromRgb = (c: Rgba) => `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;

/** Luminance relative d'une couleur (0 = noir, 1 = blanc), formule WCAG : l'œil voit le vert plus clair que le bleu. */
export function luminance(css: string): number {
  const c = parseCssColor(css) ?? { r: 0, g: 0, b: 0, a: 1 };
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** Contraste entre deux couleurs (de 1 = identiques à 21 = noir sur blanc). Lisible : 4,5 ou plus pour du texte, 3 pour de gros titres. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mélange deux couleurs : `amount` = part de `b` (0 = a, 1 = b). Résultat « #rrggbb » (la transparence est ignorée). */
export function mix(a: string, b: string, amount: number): string {
  const ca = parseCssColor(a) ?? { r: 0, g: 0, b: 0, a: 1 };
  const cb = parseCssColor(b) ?? ca;
  const part = (x: number, y: number) => x * (1 - amount) + y * amount;
  return hexFromRgb({ r: part(ca.r, cb.r), g: part(ca.g, cb.g), b: part(ca.b, cb.b), a: 1 });
}

/** Vrai si la couleur est plutôt sombre (le blanc contraste plus avec elle que le noir). */
export function isDark(css: string): boolean {
  const l = luminance(css);
  const contrastWithWhite = 1.05 / (l + 0.05);
  const contrastWithBlack = (l + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack;
}

/**
 * Éclaircit une couleur sombre (vers le blanc) ou assombrit une couleur claire (vers le noir),
 * de `amount` (0 à 1). Sert à fabriquer un bouton un peu différent de son panneau.
 * @param extremes les deux extrémités (clair, sombre) : les couleurs de la palette
 */
export function nudge(base: string, amount: number, extremes: { light: string; dark: string }): string {
  return mix(base, isDark(base) ? extremes.light : extremes.dark, amount);
}

/** Parmi des candidates, celle qui se lit le mieux sur le fond `background` (contraste le plus fort). */
export function bestOn(background: string, candidates: readonly string[]): string {
  let best = candidates[0]!;
  for (const candidate of candidates) {
    if (contrastRatio(candidate, background) > contrastRatio(best, background)) best = candidate;
  }
  return best;
}

/**
 * Rend `color` lisible sur `background` : si le contraste est trop faible, on l'éclaircit
 * (fond sombre) ou on l'assombrit (fond clair), par petits pas, jusqu'à atteindre `minRatio`.
 */
export function readableOn(color: string, background: string, extremes: { light: string; dark: string }, minRatio = 3.5): string {
  const target = isDark(background) ? extremes.light : extremes.dark;
  let result = hexOf(color);
  for (let step = 1; step <= 10 && contrastRatio(result, background) < minRatio; step++) {
    result = mix(color, target, step / 10);
  }
  return result;
}

/**
 * Les deux extrémités de la palette : la couleur la plus claire et la plus sombre. Elles servent
 * à éclaircir ou assombrir (boutons, titres) en restant dans les couleurs de la DA.
 * @param candidates les couleurs de la palette, plus des couleurs de secours (jamais vide)
 */
export function paletteExtremes(candidates: readonly string[]): { light: string; dark: string } {
  return { light: bestOn('#000000', candidates), dark: bestOn('#ffffff', candidates) };
}

/** Ce que les rôles choisis modifient (uniquement les couleurs concernées). */
export interface DerivedColors {
  cells: Partial<CellColors>;
  interface: Partial<UiColors>;
}

/**
 * Calcule toutes les couleurs déduites des rôles choisis.
 *
 * Seuls les rôles CHOISIS changent des couleurs ; les autres gardent les valeurs de la DA. Une
 * couleur qui dépend de plusieurs rôles (le texte des titres dépend des détails ET des panneaux)
 * est recalculée dès que l'un d'eux est choisi, avec la valeur actuelle de l'autre.
 *
 * @param base    le thème de la DA
 * @param roles   les rôles choisis
 * @param palette les couleurs de la palette de la DA (pour choisir une écriture lisible)
 */
export function deriveFromRoles(base: DesignTheme, roles: Roles, palette: readonly string[]): DerivedColors {
  const cells: Partial<CellColors> = {};
  const ui: Partial<UiColors> = {};
  const b = base.interface;

  // Valeurs actuelles des rôles (choisies, sinon celles de la DA).
  const panels = roles.panels ?? b.surface;
  const details = roles.details ?? b.accentFill;
  const text = roles.text ?? b.fg;
  const borders = roles.borders ?? roles.details ?? b.line;
  const legend = roles.legend ?? b.titleBg;
  const page = roles.page ?? b.bg;

  // Les couleurs entre lesquelles choisir une écriture : la palette, plus les couleurs de la DA (jamais vide).
  const candidates = [...palette, b.fg, b.bg];
  const extremes = paletteExtremes(candidates);

  if (roles.page) {
    ui.bg = page;
    cells.background = page;
    cells.glass = recolor(base.cells.glass, page); // la vitre prend la teinte de la page
    const lines = bestOn(page, candidates); // lignes de la grille : la couleur qui contraste le plus avec la page
    cells.grid = recolor(base.cells.grid, lines);
    cells.gridMajor = recolor(base.cells.gridMajor, lines);
    // Les étoiles du fond : une teinte entre la page et les lignes. Sans ça, une page de la couleur
    // des étoiles les rendrait invisibles ; ici elles restent toujours discrètes mais visibles.
    if (!roles.stars) cells.stars = mix(page, lines, 0.55);
  }

  if (roles.panels) {
    ui.surface = panels;
    ui.surface2 = nudge(panels, 0.1, extremes); // boutons : un peu différents du panneau
    ui.hover = nudge(panels, 0.2, extremes); // boutons survolés : encore un peu
    ui.danger = readableOn(b.danger, panels, extremes); // « Effacer » doit rester lisible sur les nouveaux panneaux
  }
  if (roles.panels || roles.borders || roles.details) ui.lineSoft = mix(panels, borders, 0.5); // bords des boutons

  if (roles.borders || roles.details) {
    ui.line = borders;
    ui.titleLine = borders;
  }

  if (roles.text || roles.panels) {
    ui.fg = text;
    ui.muted = mix(text, panels, 0.3); // écriture discrète : l'écriture, un peu fondue dans le panneau
  }

  if (roles.details || roles.panels) {
    ui.accentFill = details; // bouton actif
    ui.onAccent = bestOn(details, candidates); // texte du bouton actif : le plus lisible dessus
    ui.accent = readableOn(details, panels, extremes); // titres et détails : lisibles sur les panneaux
    ui.accentSoft = mix(panels, details, 0.3); // fond de l'image choisie
  }

  if (roles.legend) {
    ui.titleBg = legend;
    ui.titleFg = bestOn(legend, candidates);
  }

  if (roles.newborn) cells.newborn = roles.newborn;
  if (roles.alive) {
    cells.alive = roles.alive; // la cellule qui clignote et celle qui vient de mourir (contour) gardent sa couleur
    cells.pulse = roles.alive;
    cells.trace = roles.alive;
  }
  if (roles.stars) cells.stars = roles.stars;
  if (roles.tile) cells.tile = roles.tile;

  return { cells, interface: ui };
}

/** La couleur que la DA donne à un rôle (affichée comme « choix actuel » tant que rien n'est choisi). */
export function roleBaseColor(base: DesignTheme, role: RoleKey): string {
  switch (role) {
    case 'page': return base.interface.bg;
    case 'panels': return base.interface.surface;
    case 'legend': return base.interface.titleBg;
    case 'text': return base.interface.fg;
    case 'details': return base.interface.accentFill;
    case 'borders': return base.interface.line;
    case 'newborn': return base.cells.newborn;
    case 'alive': return base.cells.alive;
    case 'stars': return base.cells.stars;
    case 'tile': return base.cells.tile;
  }
}

/** Contraste minimal (entre la ligne telle qu'elle apparaît sur la page et la page) en dessous duquel la grille est jugée invisible. */
const MIN_GRID_CONTRAST = 1.12;

/**
 * Garde-fou : la grille ne doit jamais devenir invisible. Si une ligne a presque la même couleur que
 * la page (réglage malheureux, ancien réglage oublié…), on la remplace par la couleur de la palette qui
 * contraste le plus avec la page, avec une opacité raisonnable. Une grille déjà visible n'est PAS modifiée.
 *
 * Comment mesurer ? Une ligne transparente se mélange à la page : on calcule la couleur « obtenue »
 * (`mix(page, ligne, opacité)`) et on la compare à la page avec le contraste WCAG.
 */
export function visibleGridColors(
  colors: { grid: string; gridMajor: string },
  background: string,
  candidates: readonly string[],
): { grid: string; gridMajor: string } {
  const fix = (line: string, minimumAlpha: number): string => {
    const seen = mix(background, hexOf(line), alphaOf(line));
    if (contrastRatio(seen, background) >= MIN_GRID_CONTRAST) return line;
    return colorWithAlpha(bestOn(background, candidates), minimumAlpha);
  };
  return { grid: fix(colors.grid, 0.25), gridMajor: fix(colors.gridMajor, 0.45) };
}

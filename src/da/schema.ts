/**
 * ============================================================================
 *  schema.ts — Ce qu'est une « DA » (direction artistique) : le fichier de préférences
 * ============================================================================
 *
 * Une DA, c'est un dossier `src/da/<nom>/` qui contient :
 *   - `da.json`   : toutes les préférences (couleurs, polices, forme des cellules, grille,
 *                   fond, titre…) ;
 *   - `assets/`   : les images et polices que `da.json` utilise.
 *
 * Changer de DA = changer UN mot dans `src/da/active.ts` (ou ajouter `?da=nom` à l'adresse
 * du site pour essayer sans rien modifier). Voir `docs/DA.md`.
 *
 * Ce fichier ne dépend de rien (ni navigateur, ni Vite) : il décrit la forme d'une DA et
 * VÉRIFIE un `da.json` (`parseDesign`). Tout ce qui est faux ou manquant est remplacé par
 * la valeur de la DA de secours, et signalé dans `warnings` : un fichier mal rempli par un
 * artiste ne casse donc jamais le site. Les chemins d'images sont gardés tels quels
 * (relatifs au dossier de la DA) : c'est `registry.ts` qui les transforme en adresses.
 */

import type { Palette, ThemeName } from '../render/theme';

/** Couleurs de l'interface (boutons, panneaux, textes) pour un thème. Chacune devient une variable CSS `--nom`. */
export const UI_COLOR_KEYS = [
  'bg', 'fg', 'muted', 'surface', 'surface2', 'hover', 'line', 'lineSoft', 'drop',
  'accent', 'accentFill', 'onAccent', 'accentSoft', 'danger',
] as const;
export type UiColorKey = (typeof UI_COLOR_KEYS)[number];
export type UiColors = Record<UiColorKey, string>;

/** Couleurs des cellules et de la grille : le nom des champs de `da.json` (→ `Palette` du rendu). */
export const CELL_COLOR_KEYS = [
  'background', 'grid', 'gridMajor', 'newborn', 'alive', 'pulse', 'trace', 'selection', 'erase',
] as const;
export type CellColorKey = (typeof CELL_COLOR_KEYS)[number];
export type CellColors = Record<CellColorKey, string>;

/** Ce qui change entre le mode nuit et le mode jour. */
export interface DesignTheme {
  readonly cells: CellColors;
  readonly interface: UiColors;
  /** Image du titre (chemin relatif au dossier de la DA), ou null pour le titre en texte. */
  readonly titleImage: string | null;
  /** Image de fond de la grille, ou null. */
  readonly backgroundImage: string | null;
}

export interface DesignFont {
  readonly family: string;
  /** Chemin du fichier .woff2, relatif au dossier de la DA. */
  readonly file: string;
  /** Graisse(s) du fichier : "400", "700" ou une plage "400 700". */
  readonly weight: string;
}

export interface DesignPack {
  readonly name: string;
  readonly description: string;
  /** Thème montré à la première visite. */
  readonly defaultTheme: ThemeName;
  readonly fonts: readonly DesignFont[];
  readonly ui: {
    /** Valeur CSS de `font-family` pour toute l'interface. */
    readonly fontFamily: string;
    /** Multiplie toutes les tailles de texte (1 = tailles d'origine). */
    readonly textScale: number;
    /** `notched` : cadres en escalier + ombre dure (pixel). `flat` : simple contour fin. */
    readonly frame: 'notched' | 'flat';
    /** Épaisseur des contours, en pixels. */
    readonly borderWidth: number;
  };
  readonly title: {
    /** Texte du titre (affiché s'il n'y a pas d'image, et lu par les lecteurs d'écran sinon). */
    readonly text: string;
    /** Hauteur de l'image du titre, en pixels. */
    readonly imageHeight: number;
  };
  readonly cells: {
    /** Image qui sert de FORME aux cellules (seule la silhouette compte : elle est recolorée). null = carrés. */
    readonly icon: string | null;
    /** Taille de la forme dans sa case (1 = toute la case). */
    readonly scale: number;
    /** En dessous de cette taille de case (px), on dessine de simples carrés. */
    readonly iconMinZoom: number;
  };
  readonly grid: {
    /** `lines` : quadrillage. `crosses` : quadrillage fin + une croix épaisse à chaque croisement. */
    readonly style: 'lines' | 'crosses';
  };
  readonly background: {
    /** Transparence de l'image de fond (0 à 1). */
    readonly opacity: number;
  };
  readonly themes: Record<ThemeName, DesignTheme>;
}

/** Résultat de la vérification d'un `da.json`. */
export interface ParsedDesign {
  readonly pack: DesignPack;
  /** Phrases qui expliquent ce qui a été corrigé (vide si le fichier était parfait). */
  readonly warnings: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────
//  Vérification
// ────────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Couleurs acceptées : #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(). Rien d'autre (une valeur de ce fichier finit dans du CSS). */
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(\s*[-0-9.%\s,/]+\))$/i;

/** Chemins acceptés : relatifs, sans `..`, sans `:` (pas d'adresse web), sans `\`. */
const SAFE_PATH = /^(?!\/)(?!.*\.\.)(?!.*[:\\])[\w\-./ ]+$/;

/**
 * Vérifie un `da.json` et le complète avec la DA de secours.
 * @param raw      le contenu lu du fichier
 * @param fallback la DA utilisée pour tout ce qui manque ou est invalide
 */
export function parseDesign(raw: unknown, fallback: DesignPack): ParsedDesign {
  const warnings: string[] = [];
  const root: Json = isObject(raw) ? raw : {};
  if (!isObject(raw)) warnings.push('da.json : le fichier n\'est pas un objet JSON.');

  const text = (value: unknown, previous: string, where: string): string => {
    if (value === undefined) return previous;
    if (typeof value === 'string' && value.trim() !== '') return value;
    warnings.push(`${where} : texte attendu.`);
    return previous;
  };
  const number = (value: unknown, previous: number, min: number, max: number, where: string): number => {
    if (value === undefined) return previous;
    if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) return value;
    warnings.push(`${where} : nombre entre ${min} et ${max} attendu.`);
    return previous;
  };
  const choice = <T extends string>(value: unknown, allowed: readonly T[], previous: T, where: string): T => {
    if (value === undefined) return previous;
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
    warnings.push(`${where} : une de ces valeurs est attendue : ${allowed.join(', ')}.`);
    return previous;
  };
  const color = (value: unknown, previous: string, where: string): string => {
    if (value === undefined) return previous;
    if (typeof value === 'string' && COLOR.test(value.trim())) return value.trim();
    warnings.push(`${where} : couleur attendue (ex. #3cf2ff ou rgba(0, 0, 0, 0.5)).`);
    return previous;
  };
  const path = (value: unknown, previous: string | null, where: string): string | null => {
    if (value === undefined) return previous;
    if (value === null || value === '') return null;
    if (typeof value === 'string' && SAFE_PATH.test(value)) return value;
    warnings.push(`${where} : chemin relatif attendu (ex. assets/etoile.png), sans « .. » ni adresse web.`);
    return previous;
  };
  const section = (value: unknown, where: string): Json => {
    if (value === undefined) return {};
    if (isObject(value)) return value;
    warnings.push(`${where} : bloc { … } attendu.`);
    return {};
  };

  // — Polices —
  // (sans « fonts », aucune police : les fichiers de la DA de secours sont dans un autre dossier)
  let fonts: readonly DesignFont[] = [];
  if (root.fonts !== undefined) {
    if (Array.isArray(root.fonts)) {
      fonts = root.fonts.flatMap((entry, index): DesignFont[] => {
        const e = section(entry, `fonts[${index}]`);
        const file = path(e.file, null, `fonts[${index}].file`);
        const family = typeof e.family === 'string' && /^[\w \-]+$/.test(e.family) ? e.family : null;
        if (!file || !family) {
          warnings.push(`fonts[${index}] : « family » (lettres, chiffres, espaces) et « file » sont obligatoires.`);
          return [];
        }
        return [{ family, file, weight: text(e.weight, '400', `fonts[${index}].weight`) }];
      });
    } else {
      warnings.push('fonts : liste [ … ] attendue.');
    }
  }

  // — Interface, titre, cellules, grille, fond —
  const ui = section(root.ui, 'ui');
  const title = section(root.title, 'title');
  const cells = section(root.cells, 'cells');
  const grid = section(root.grid, 'grid');
  const background = section(root.background, 'background');

  // — Les deux thèmes —
  const themesRaw = section(root.themes, 'themes');
  const readTheme = (name: ThemeName): DesignTheme => {
    const base = fallback.themes[name];
    const t = section(themesRaw[name], `themes.${name}`);
    const colorsRaw = section(t.colors, `themes.${name}.colors`);
    const interfaceRaw = section(t.interface, `themes.${name}.interface`);
    const cellColors = Object.fromEntries(
      CELL_COLOR_KEYS.map((key) => [key, color(colorsRaw[key], base.cells[key], `themes.${name}.colors.${key}`)]),
    ) as CellColors;
    const uiColors = Object.fromEntries(
      UI_COLOR_KEYS.map((key) => [key, color(interfaceRaw[key], base.interface[key], `themes.${name}.interface.${key}`)]),
    ) as UiColors;
    return {
      cells: cellColors,
      interface: uiColors,
      // Pour les images, « absent » = rien (et non l'image de la DA de secours : un autre dossier).
      titleImage: path(t.titleImage, null, `themes.${name}.titleImage`),
      backgroundImage: path(t.backgroundImage, null, `themes.${name}.backgroundImage`),
    };
  };

  const pack: DesignPack = {
    name: text(root.name, fallback.name, 'name'),
    description: text(root.description, fallback.description, 'description'),
    defaultTheme: choice(root.defaultTheme, ['night', 'day'] as const, fallback.defaultTheme, 'defaultTheme'),
    fonts,
    ui: {
      fontFamily: text(ui.fontFamily, fallback.ui.fontFamily, 'ui.fontFamily'),
      textScale: number(ui.textScale, fallback.ui.textScale, 0.5, 2, 'ui.textScale'),
      frame: choice(ui.frame, ['notched', 'flat'] as const, fallback.ui.frame, 'ui.frame'),
      borderWidth: number(ui.borderWidth, fallback.ui.borderWidth, 0, 8, 'ui.borderWidth'),
    },
    title: {
      text: text(title.text, fallback.title.text, 'title.text'),
      imageHeight: number(title.imageHeight, fallback.title.imageHeight, 16, 200, 'title.imageHeight'),
    },
    cells: {
      icon: path(cells.icon, null, 'cells.icon'),
      scale: number(cells.scale, fallback.cells.scale, 0.3, 1.3, 'cells.scale'),
      iconMinZoom: number(cells.iconMinZoom, fallback.cells.iconMinZoom, 2, 40, 'cells.iconMinZoom'),
    },
    grid: { style: choice(grid.style, ['lines', 'crosses'] as const, fallback.grid.style, 'grid.style') },
    background: { opacity: number(background.opacity, fallback.background.opacity, 0, 1, 'background.opacity') },
    themes: { night: readTheme('night'), day: readTheme('day') },
  };
  return { pack, warnings };
}

/** Tous les fichiers (images, polices) cités par une DA, relatifs à son dossier : sert à vérifier qu'ils existent. */
export function designAssets(pack: DesignPack): string[] {
  const files = new Set<string>();
  for (const font of pack.fonts) files.add(font.file);
  if (pack.cells.icon) files.add(pack.cells.icon);
  for (const theme of Object.values(pack.themes)) {
    if (theme.titleImage) files.add(theme.titleImage);
    if (theme.backgroundImage) files.add(theme.backgroundImage);
  }
  return [...files];
}

/** « #rrggbb » + opacité → « rgba(r, g, b, a) » (sert à déduire le remplissage de la sélection). */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return color;
  const channel = (index: number) => parseInt(hex.slice(1 + 2 * index, 3 + 2 * index), 16);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

/** Palette du rendu (canvas) d'un thème. */
export function paletteOf(theme: DesignTheme): Palette {
  const c = theme.cells;
  return {
    background: c.background,
    grid: c.grid,
    gridMajor: c.gridMajor,
    newborn: c.newborn,
    alive: c.alive,
    pulse: c.pulse,
    trace: c.trace,
    selectionStroke: c.selection,
    selectionFill: withAlpha(c.selection, 0.1),
    erase: c.erase,
  };
}

/**
 * Une DA « vide » mais valide : sert uniquement de point de départ pour lire la toute
 * première DA (celle qui servira ensuite de secours aux autres). Rien n'en est affiché.
 */
export const BLANK_DESIGN: DesignPack = (() => {
  const colors = Object.fromEntries(CELL_COLOR_KEYS.map((key) => [key, '#000000'])) as CellColors;
  const ui = Object.fromEntries(UI_COLOR_KEYS.map((key) => [key, '#000000'])) as UiColors;
  const theme: DesignTheme = { cells: colors, interface: ui, titleImage: null, backgroundImage: null };
  return {
    name: 'vide',
    description: '',
    defaultTheme: 'night',
    fonts: [],
    ui: { fontFamily: 'sans-serif', textScale: 1, frame: 'notched', borderWidth: 3 },
    title: { text: 'Jeu de la vie', imageHeight: 46 },
    cells: { icon: null, scale: 1, iconMinZoom: 6 },
    grid: { style: 'lines' },
    background: { opacity: 1 },
    themes: { night: theme, day: theme },
  };
})();

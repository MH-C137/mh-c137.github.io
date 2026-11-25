/**
 * ============================================================================
 *  overrides.ts — Les réglages de l'outil « Config DA » (options avancées)
 * ============================================================================
 *
 * L'outil de personnalisation permet d'essayer des couleurs et des styles DIRECTEMENT dans
 * le site, séparément pour le mode nuit et le mode jour. Ces réglages ne modifient pas le
 * fichier `da.json` : ils se posent PAR-DESSUS la DA (un « calque » de modifications), sont
 * retenus dans le navigateur (localStorage), et peuvent être copiés en JSON pour être
 * recopiés dans `da.json` quand on a trouvé ce qui plaît.
 *
 * Fichier pur (aucun navigateur) : la lecture vérifie tout (le stockage peut contenir
 * n'importe quoi), la fusion est testée avec Node.
 */

import type { ThemeName } from '../render/theme';
import {
  BACKGROUND_STYLES,
  CELL_COLOR_KEYS,
  COLOR,
  GRID_STYLES,
  ROLE_KEYS,
  UI_COLOR_KEYS,
  type Roles,
  type BackgroundStyle,
  type CellColors,
  type DesignPack,
  type DesignTheme,
  type GridStyle,
  type UiColors,
} from './schema';

/** Ce que la personne a changé pour UN thème (tout est facultatif : absent = valeur de la DA). */
export interface ThemeOverrides {
  /** Les rôles choisis (parmi les couleurs de la palette) : les nuances qui en dépendent sont déduites. */
  roles?: Roles;
  cells?: Partial<CellColors>;
  interface?: Partial<UiColors>;
  gridStyle?: GridStyle;
  backgroundStyle?: BackgroundStyle;
}

export type DesignOverrides = Record<ThemeName, ThemeOverrides>;

export const NO_OVERRIDES: DesignOverrides = { night: {}, day: {} };

/** Vrai s'il n'y a aucun réglage pour ce thème. */
export function isEmptyOverrides(overrides: ThemeOverrides): boolean {
  return (
    Object.keys(overrides.roles ?? {}).length === 0 &&
    Object.keys(overrides.cells ?? {}).length === 0 &&
    Object.keys(overrides.interface ?? {}).length === 0 &&
    overrides.gridStyle === undefined &&
    overrides.backgroundStyle === undefined
  );
}

/**
 * Relit des réglages venus du stockage du navigateur. On ne garde que ce qui est valide :
 * des couleurs bien formées (une valeur de ce fichier finit dans du CSS) et des styles connus.
 */
export function parseOverrides(raw: unknown): DesignOverrides {
  const result: DesignOverrides = { night: {}, day: {} };
  if (typeof raw !== 'object' || raw === null) return result;
  const object = raw as Record<string, unknown>;
  for (const theme of ['night', 'day'] as const) {
    const source = object[theme];
    if (typeof source !== 'object' || source === null) continue;
    const s = source as Record<string, unknown>;
    const pick = <K extends string>(keys: readonly K[], block: unknown): Partial<Record<K, string>> => {
      const out: Partial<Record<K, string>> = {};
      if (typeof block !== 'object' || block === null) return out;
      for (const key of keys) {
        const value = (block as Record<string, unknown>)[key];
        if (typeof value === 'string' && COLOR.test(value.trim())) out[key] = value.trim();
      }
      return out;
    };
    const roles = pick(ROLE_KEYS, s.roles);
    if (Object.keys(roles).length > 0) result[theme].roles = roles;
    const cells = pick(CELL_COLOR_KEYS, s.cells);
    const ui = pick(UI_COLOR_KEYS, s.interface);
    if (Object.keys(cells).length > 0) result[theme].cells = cells;
    if (Object.keys(ui).length > 0) result[theme].interface = ui;
    if ((GRID_STYLES as readonly unknown[]).includes(s.gridStyle)) result[theme].gridStyle = s.gridStyle as GridStyle;
    if ((BACKGROUND_STYLES as readonly unknown[]).includes(s.backgroundStyle)) {
      result[theme].backgroundStyle = s.backgroundStyle as BackgroundStyle;
    }
  }
  return result;
}

/** Le thème de la DA avec les réglages de la personne par-dessus. */
export function applyOverrides(theme: DesignTheme, overrides: ThemeOverrides): DesignTheme {
  return {
    ...theme,
    cells: { ...theme.cells, ...overrides.cells },
    interface: { ...theme.interface, ...overrides.interface },
    gridStyle: overrides.gridStyle ?? theme.gridStyle,
    backgroundStyle: overrides.backgroundStyle ?? theme.backgroundStyle,
  };
}

/** Style du quadrillage réellement utilisé pour un thème (le sien, sinon celui de la DA). */
export function effectiveGrid(pack: DesignPack, theme: DesignTheme): GridStyle {
  return theme.gridStyle ?? pack.grid.style;
}

/** Style du fond réellement utilisé pour un thème (le sien, sinon celui de la DA). */
export function effectiveBackground(pack: DesignPack, theme: DesignTheme): BackgroundStyle {
  return theme.backgroundStyle ?? pack.background.style;
}

/**
 * Les réglages sous la forme d'un morceau de `da.json` (bloc `themes`), à copier-coller dans le
 * fichier de la DA quand on a trouvé ce qui plaît.
 */
export function overridesToJson(overrides: DesignOverrides): string {
  const themes: Record<string, unknown> = {};
  for (const theme of ['night', 'day'] as const) {
    const o = overrides[theme];
    if (isEmptyOverrides(o)) continue;
    themes[theme] = {
      ...(o.cells ? { colors: o.cells } : {}),
      ...(o.interface ? { interface: o.interface } : {}),
      ...(o.gridStyle ? { gridStyle: o.gridStyle } : {}),
      ...(o.backgroundStyle ? { backgroundStyle: o.backgroundStyle } : {}),
    };
  }
  return JSON.stringify({ themes }, null, 2);
}

// ────────────────────────────────────────────────────────────────────────────
//  Couleurs : passer d'une couleur CSS (« #rrggbb », « rgba(…) ») au sélecteur de couleur de la page, et inversement
// ────────────────────────────────────────────────────────────────────────────

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Lit une couleur CSS (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba()). Renvoie null si le format n'est pas reconnu. */
export function parseCssColor(css: string): Rgba | null {
  const text = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    let digits = hex[1]!;
    if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
    const channel = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return { r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? channel(3) / 255 : 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(text);
  if (fn) {
    const alpha = fn[4] === undefined ? 1 : fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
    return { r: Math.round(+fn[1]!), g: Math.round(+fn[2]!), b: Math.round(+fn[3]!), a: Math.min(1, Math.max(0, alpha)) };
  }
  return null;
}

const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

/** « #rrggbb » d'une couleur CSS (sans la transparence) : c'est ce que comprend le sélecteur de couleur. Noir si illisible. */
export function hexOf(css: string): string {
  const c = parseCssColor(css);
  return c ? `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}` : '#000000';
}

/** Transparence (0 à 1) d'une couleur CSS ; 1 si illisible. */
export function alphaOf(css: string): number {
  return parseCssColor(css)?.a ?? 1;
}

/** Une couleur « #rrggbb » avec une transparence : « #rrggbb » si opaque, sinon « rgba(r, g, b, a) ». */
export function colorWithAlpha(hex: string, alpha: number): string {
  const c = parseCssColor(hex);
  if (!c) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 100) / 100;
  return a >= 1 ? `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}` : `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/** Remplace la couleur d'une valeur CSS en gardant sa transparence (le sélecteur de la page ne gère pas la transparence). */
export function recolor(css: string, hex: string): string {
  return colorWithAlpha(hex, alphaOf(css));
}

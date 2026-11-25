/**
 * Tests du calcul des nuances (rôles → couleurs) de l'outil « Config DA » : contraste,
 * mélange, éclaircissement, choix de l'écriture lisible, et indépendance des rôles.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bestOn, contrastRatio, deriveFromRoles, isDark, luminance, mix, nudge, readableOn, roleBaseColor } from '../src/da/derive';
import { BLANK_DESIGN, parseDesign } from '../src/da/schema';

const read = (id: string) => JSON.parse(readFileSync(join(__dirname, '..', 'src', 'da', id, 'da.json'), 'utf8'));
const pixel = parseDesign(read('pixel'), BLANK_DESIGN).pack;
const nova = parseDesign(read('nova'), pixel).pack;
const palette = nova.palette.map((c) => c.color); // bleu clair, jaune, bleu nuit, violet, blanc
const [BLEU_CLAIR, JAUNE, BLEU_NUIT, VIOLET, BLANC] = palette as [string, string, string, string, string];
const night = nova.themes.night;

describe('Contraste et luminosité', () => {
  it('valeurs connues (WCAG) : noir sur blanc = 21, identique = 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
  });

  it('sombre ou clair', () => {
    expect(isDark(BLEU_NUIT)).toBe(true);
    expect(isDark(JAUNE)).toBe(false);
    expect(isDark(BLANC)).toBe(false);
  });
});

describe('Mélanges', () => {
  it('mélange, éclaircit les sombres, assombrit les clairs', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    const extremes = { light: BLANC, dark: BLEU_NUIT };
    expect(luminance(nudge(BLEU_NUIT, 0.2, extremes))).toBeGreaterThan(luminance(BLEU_NUIT)); // sombre → plus clair
    expect(luminance(nudge(JAUNE, 0.2, extremes))).toBeLessThan(luminance(JAUNE)); // clair → plus sombre
  });
});

describe('Écriture lisible', () => {
  it('choisit, parmi la palette, la couleur la plus lisible sur un fond', () => {
    expect(bestOn(BLEU_NUIT, palette)).toBe(BLANC);
    expect(bestOn(JAUNE, palette)).toBe(BLEU_NUIT);
    expect(bestOn(VIOLET, palette)).toBe(BLANC);
  });

  it('éclaircit une couleur jusqu\'à ce qu\'elle soit lisible sur un fond sombre', () => {
    const extremes = { light: BLANC, dark: BLEU_NUIT };
    expect(contrastRatio(VIOLET, '#1a2350')).toBeLessThan(3.5); // violet sur bleu nuit : trop faible
    expect(contrastRatio(readableOn(VIOLET, '#1a2350', extremes), '#1a2350')).toBeGreaterThanOrEqual(3.5);
    expect(readableOn(BLANC, '#1a2350', extremes)).toBe(BLANC); // déjà lisible : inchangé
  });
});

describe('Rôles → nuances', () => {
  it('sans rôle choisi, rien ne change', () => {
    expect(deriveFromRoles(night, {}, palette)).toEqual({ cells: {}, interface: {} });
  });

  it('« détails » = violet : bouton actif violet, texte du bouton lisible, titres lisibles sur les panneaux', () => {
    const { interface: ui } = deriveFromRoles(night, { details: VIOLET }, palette);
    expect(ui.accentFill).toBe(VIOLET);
    expect(ui.onAccent).toBe(BLANC);
    expect(ui.line).toBe(VIOLET); // les bords suivent les détails tant qu'on ne choisit pas de bords
    expect(contrastRatio(ui.accent!, night.interface.surface)).toBeGreaterThanOrEqual(3.5);
  });

  it('« panneaux » = jaune : boutons dérivés, écriture discrète fondue dans le panneau', () => {
    const { interface: ui } = deriveFromRoles(night, { panels: JAUNE }, palette);
    expect(ui.surface).toBe(JAUNE);
    expect(luminance(ui.surface2!)).toBeLessThan(luminance(JAUNE)); // panneau clair → boutons un peu plus sombres
    expect(ui.hover).not.toBe(ui.surface2);
    expect(contrastRatio(ui.danger!, JAUNE)).toBeGreaterThanOrEqual(3.5); // le rouge d'alerte reste lisible sur du jaune
  });

  it('les rôles sont indépendants : le fond des pastilles ne touche pas la page', () => {
    const tile = deriveFromRoles(night, { tile: BLANC }, palette);
    expect(tile.cells).toEqual({ tile: BLANC });
    expect(tile.interface).toEqual({});
    const page = deriveFromRoles(night, { page: BLEU_CLAIR }, palette);
    expect(page.cells.tile).toBeUndefined();
    expect(page.cells.background).toBe(BLEU_CLAIR);
    expect(page.interface.bg).toBe(BLEU_CLAIR);
  });

  it('« page » : les lignes de la grille et la vitre s\'adaptent, en gardant leur transparence', () => {
    const { cells } = deriveFromRoles(night, { page: BLEU_CLAIR }, palette);
    expect(cells.glass).toMatch(/^rgba\(84, 142, 188, 0\.62\)$/);
    expect(cells.grid).toMatch(/^rgba\(\d+, \d+, \d+, 0\.2\)$/);
  });

  it('le choix actuel d\'un rôle sans réglage est la couleur de la DA', () => {
    expect(roleBaseColor(night, 'panels')).toBe(night.interface.surface);
    expect(roleBaseColor(night, 'tile')).toBe(night.cells.tile);
  });
});

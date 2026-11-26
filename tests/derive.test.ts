/**
 * Tests du calcul des nuances (rôles → couleurs) de l'outil « Config DA » : contraste,
 * mélange, éclaircissement, choix de l'écriture lisible, et indépendance des rôles.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bestOn, contrastRatio, deriveFromRoles, isDark, luminance, mix, nudge, readableOn, roleBaseColor, visibleGridColors } from '../src/da/derive';
import { alphaOf, hexOf } from '../src/da/overrides';
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
    expect(roleBaseColor(night, 'title')).toBe(night.interface.titleInk);
  });

  it('« title » : seule la couleur de l\'image du titre change', () => {
    const { cells, interface: ui } = deriveFromRoles(night, { title: BLEU_CLAIR }, palette);
    expect(ui.titleInk).toBe(BLEU_CLAIR);
    expect(Object.keys(ui)).toEqual(['titleInk']);
    expect(Object.keys(cells)).toHaveLength(0);
  });

  it('« thumbnails » ne change que les miniatures ; la cellule née ne change pas les miniatures', () => {
    const thumbs = deriveFromRoles(night, { thumbnails: BLEU_CLAIR }, palette);
    expect(Object.keys(thumbs.interface)).toEqual(['thumbInk']);
    expect(Object.keys(thumbs.cells)).toHaveLength(0);
    const born = deriveFromRoles(night, { newborn: BLEU_CLAIR }, palette);
    expect(born.interface.thumbInk).toBeUndefined();
  });

  it('une nouvelle légende garde le titre lisible dessus (contraste d\'au moins 3)', () => {
    for (const legend of palette) {
      const { interface: ui } = deriveFromRoles(night, { legend }, palette);
      expect(contrastRatio(ui.titleInk ?? night.interface.titleInk, legend)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Fond toujours visible', () => {
  it('quelle que soit la couleur de la page, les lignes de la grille et les étoiles restent visibles', () => {
    for (const page of palette) {
      const { cells } = deriveFromRoles(night, { page }, palette);
      const lines = mix(page, bestOn(page, palette), 1); // la couleur de ligne choisie
      expect(contrastRatio(lines, page)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(cells.stars!, page)).toBeGreaterThan(1.5); // jamais confondues avec la page
      expect(cells.stars).not.toBe(page);
    }
  });

  it('si on choisit aussi les étoiles, ce choix est respecté', () => {
    expect(deriveFromRoles(night, { page: BLEU_NUIT, stars: JAUNE }, palette).cells.stars).toBe(JAUNE);
  });
});

describe('Garde-fou de la grille', () => {
  it('une grille déjà visible n\'est pas modifiée (les valeurs des DA passent)', () => {
    for (const pack of [nova, pixel]) {
      for (const theme of [pack.themes.night, pack.themes.day]) {
        const { grid, gridMajor, background } = theme.cells;
        expect(visibleGridColors({ grid, gridMajor }, background, palette)).toEqual({ grid, gridMajor });
      }
    }
  });

  it('une grille de la couleur de la page est remplacée par une couleur qui contraste', () => {
    const fixed = visibleGridColors({ grid: 'rgba(37, 49, 101, 0.2)', gridMajor: '#253165' }, BLEU_NUIT, palette);
    expect(contrastRatio(mix(BLEU_NUIT, hexOf(fixed.grid), alphaOf(fixed.grid)), BLEU_NUIT)).toBeGreaterThan(1.12);
    expect(fixed.grid).not.toBe('rgba(37, 49, 101, 0.2)');
  });
});

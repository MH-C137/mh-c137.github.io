/**
 * Tests de l'outil « Config DA » : lecture sûre des réglages, fusion avec la DA, export JSON,
 * et conversions de couleurs (sélecteur de couleur ↔ valeurs CSS avec transparence).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  alphaOf,
  applyOverrides,
  colorWithAlpha,
  effectiveBackground,
  effectiveGrid,
  hexOf,
  isEmptyOverrides,
  overridesToJson,
  parseCssColor,
  parseOverrides,
  recolor,
} from '../src/da/overrides';
import { BLANK_DESIGN, parseDesign } from '../src/da/schema';

const pixel = parseDesign(JSON.parse(readFileSync(join(__dirname, '..', 'src', 'da', 'pixel', 'da.json'), 'utf8')), BLANK_DESIGN).pack;

describe('Lecture des réglages', () => {
  it('garde ce qui est valide et ignore le reste', () => {
    const o = parseOverrides({
      night: {
        cells: { alive: '#ff8000', newborn: 'url(javascript:alert(1))', inconnue: '#000000' },
        interface: { fg: 'rgba(255, 255, 255, 0.5)' },
        gridStyle: 'crosses',
        backgroundStyle: 'galaxie',
      },
      day: 'n\'importe quoi',
    });
    expect(o.night.cells).toEqual({ alive: '#ff8000' });
    expect(o.night.interface).toEqual({ fg: 'rgba(255, 255, 255, 0.5)' });
    expect(o.night.gridStyle).toBe('crosses');
    expect(o.night.backgroundStyle).toBeUndefined();
    expect(o.day).toEqual({});
  });

  it('un contenu illisible donne « aucun réglage »', () => {
    expect(parseOverrides(null)).toEqual({ night: {}, day: {} });
    expect(parseOverrides(42)).toEqual({ night: {}, day: {} });
    expect(isEmptyOverrides({})).toBe(true);
    expect(isEmptyOverrides({ gridStyle: 'lines' })).toBe(false);
  });
});

describe('Fusion avec la DA', () => {
  it('les réglages passent par-dessus la DA, thème par thème', () => {
    const merged = applyOverrides(pixel.themes.night, { cells: { alive: '#123456' }, gridStyle: 'crosses' });
    expect(merged.cells.alive).toBe('#123456');
    expect(merged.cells.newborn).toBe(pixel.themes.night.cells.newborn); // le reste ne bouge pas
    expect(effectiveGrid(pixel, merged)).toBe('crosses');
    expect(effectiveGrid(pixel, pixel.themes.night)).toBe(pixel.grid.style); // sans réglage : le style de la DA
    expect(effectiveBackground(pixel, merged)).toBe(pixel.background.style);
    expect(effectiveBackground(pixel, applyOverrides(pixel.themes.day, { backgroundStyle: 'none' }))).toBe('none');
  });

  it('l\'export JSON ne contient que ce qui a été changé', () => {
    const json = JSON.parse(
      overridesToJson({ night: { cells: { alive: '#ffffff' }, backgroundStyle: 'constellation' }, day: {} }),
    );
    expect(json).toEqual({ themes: { night: { colors: { alive: '#ffffff' }, backgroundStyle: 'constellation' } } });
  });
});

describe('Couleurs', () => {
  it('lit les formats CSS', () => {
    expect(parseCssColor('#3cf2ff')).toEqual({ r: 60, g: 242, b: 255, a: 1 });
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor('rgba(37, 49, 101, 0.62)')).toEqual({ r: 37, g: 49, b: 101, a: 0.62 });
    expect(parseCssColor('rouge')).toBeNull();
  });

  it('passe du CSS au sélecteur de couleur et inversement, en gardant la transparence', () => {
    expect(hexOf('rgba(37, 49, 101, 0.62)')).toBe('#253165');
    expect(alphaOf('rgba(37, 49, 101, 0.62)')).toBe(0.62);
    expect(colorWithAlpha('#253165', 0.5)).toBe('rgba(37, 49, 101, 0.5)');
    expect(colorWithAlpha('#253165', 1)).toBe('#253165');
    expect(recolor('rgba(255, 255, 255, 0.2)', '#ff0000')).toBe('rgba(255, 0, 0, 0.2)');
    expect(hexOf('n\'importe quoi')).toBe('#000000');
  });
});

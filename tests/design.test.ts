/**
 * Tests du système de DA (directions artistiques) : le schéma, et surtout les VRAIS fichiers
 * src/da/<nom>/da.json du projet (couleurs valides, images et polices qui existent).
 * Ces tests protègent les artistes : une faute dans un da.json est signalée ici, pas sur le site.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLANK_DESIGN, designAssets, paletteOf, parseDesign, withAlpha } from '../src/da/schema';

const DA_DIR = join(__dirname, '..', 'src', 'da');
const readJson = (id: string): unknown => JSON.parse(readFileSync(join(DA_DIR, id, 'da.json'), 'utf8'));
const folders = readdirSync(DA_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

/** DA de secours = la DA « pixel » du projet, lue telle quelle. */
const pixel = parseDesign(readJson('pixel'), BLANK_DESIGN).pack;

describe('Vérification d\'un da.json', () => {
  it('un fichier vide est complété par la DA de secours (sans erreur)', () => {
    const { pack, warnings } = parseDesign({}, pixel);
    expect(warnings).toEqual([]);
    expect(pack.themes.night.cells.newborn).toBe(pixel.themes.night.cells.newborn);
    expect(pack.fonts).toEqual([]); // les polices d'une autre DA ne sont pas reprises
  });

  it('corrige les valeurs fausses et les signale', () => {
    const { pack, warnings } = parseDesign(
      {
        ui: { textScale: 99, frame: 'rond' },
        grid: { style: 'etoiles' },
        themes: { night: { colors: { newborn: 'url(javascript:alert(1))', alive: '#ff8000' } } },
        cells: { icon: '../../secret.png' },
      },
      pixel,
    );
    expect(pack.ui.textScale).toBe(pixel.ui.textScale);
    expect(pack.ui.frame).toBe('notched');
    expect(pack.grid.style).toBe('lines');
    expect(pack.themes.night.cells.newborn).toBe(pixel.themes.night.cells.newborn); // couleur dangereuse refusée
    expect(pack.themes.night.cells.alive).toBe('#ff8000'); // couleur valide gardée
    expect(pack.cells.icon).toBeNull(); // chemin qui sort du dossier refusé
    expect(warnings.length).toBe(5);
  });

  it('refuse un fichier qui n\'est pas un objet', () => {
    expect(parseDesign('bonjour', pixel).warnings.length).toBe(1);
  });

  it('palette du rendu et remplissage de sélection', () => {
    expect(withAlpha('#3cf2ff', 0.1)).toBe('rgba(60, 242, 255, 0.1)');
    const palette = paletteOf(pixel.themes.night);
    expect(palette.newborn).toBe('#3cf2ff');
    expect(palette.selectionFill).toBe('rgba(60, 242, 255, 0.1)');
  });
});

describe.each(folders)('DA « %s » (fichiers réels)', (id) => {
  const { pack, warnings } = parseDesign(readJson(id), pixel);

  it('da.json est lisible et sans correction nécessaire', () => {
    expect(warnings).toEqual([]);
  });

  it('toutes les images et polices citées existent', () => {
    const missing = designAssets(pack).filter((file) => !existsSync(join(DA_DIR, id, file)));
    expect(missing).toEqual([]);
  });
});

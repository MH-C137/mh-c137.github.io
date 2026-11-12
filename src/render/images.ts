/**
 * ============================================================================
 *  images.ts — La bibliothèque d'images (« habillages » des cellules)
 * ============================================================================
 *
 * Les artistes importent des images ; chaque image reçoit un numéro (1, 2, 3…).
 * Le numéro 0 est réservé : « pas d'image » (forme néon par défaut).
 * Le monde ne stocke que ces numéros (voir world.ts) : c'est léger, et une
 * même image peut habiller des milliers de cellules sans être copiée.
 *
 * Préparation des images (faite UNE fois, à l'import) :
 *   1. On recadre l'image en carré, centré (comme `object-fit: cover` en CSS).
 *   2. On la réduit en une « tuile » de TILE_SIZE pixels, aux coins arrondis
 *      comme les cellules. Dessiner une petite tuile des milliers de fois par
 *      seconde est bien plus rapide que dessiner la grande image d'origine.
 *   3. On calcule sa couleur moyenne : quand on dézoome et que les cases font
 *      quelques pixels, on dessine cette couleur au lieu de l'image (illisible
 *      à cette taille de toute façon).
 */

import { Emitter } from '../core/events';

/** Taille (en pixels) des tuiles préparées. */
export const TILE_SIZE = 96;
/** Arrondi des coins, en proportion du côté (le même que les cellules). */
export const CORNER_RATIO = 0.22;

export interface SkinImage {
  /** Numéro de l'image (≥ 1). */
  readonly id: number;
  readonly name: string;
  /** Tuile carrée prête à dessiner. */
  readonly tile: HTMLCanvasElement;
  /** Couleur moyenne, au format CSS "rgb(r, g, b)". */
  readonly averageColor: string;
  /** Miniature pour l'interface (adresse « data: »). */
  readonly thumbnailUrl: string;
}

export class ImageLibrary extends Emitter<{ change: void }> {
  private readonly images = new Map<number, SkinImage>();
  private nextId = 1;
  private _current = 0;

  /** Image utilisée par le pinceau et les structures (0 = aucune). */
  get current(): number {
    return this._current;
  }

  set current(id: number) {
    this._current = id === 0 || this.images.has(id) ? id : 0;
    this.emit('change', undefined);
  }

  get(id: number): SkinImage | undefined {
    return this.images.get(id);
  }

  list(): SkinImage[] {
    return [...this.images.values()];
  }

  /**
   * Importe un fichier image et le prépare (voir l'explication en haut du fichier).
   * @returns l'image prête, avec son numéro.
   */
  async addFile(file: File): Promise<SkinImage> {
    const source = await loadImage(file);
    const tile = document.createElement('canvas');
    tile.width = TILE_SIZE;
    tile.height = TILE_SIZE;
    const context = tile.getContext('2d') as CanvasRenderingContext2D;

    // Recadrage carré centré : on prend le plus grand carré possible au milieu.
    const side = Math.min(source.width, source.height);
    const sourceX = (source.width - side) / 2;
    const sourceY = (source.height - side) / 2;

    // Coins arrondis : on dessine d'abord la forme, puis on « découpe » (clip) dedans.
    context.beginPath();
    roundedRectPath(context, 0, 0, TILE_SIZE, TILE_SIZE, TILE_SIZE * CORNER_RATIO);
    context.clip();
    context.drawImage(source.image, sourceX, sourceY, side, side, 0, 0, TILE_SIZE, TILE_SIZE);

    const image: SkinImage = {
      id: this.nextId++,
      name: file.name,
      tile,
      averageColor: averageColor(source.image, sourceX, sourceY, side),
      thumbnailUrl: tile.toDataURL('image/png'),
    };
    this.images.set(image.id, image);
    this.emit('change', undefined);
    return image;
  }
}

/**
 * Charge un fichier image dans un objet dessinable, avec ses dimensions.
 * Méthode rapide d'abord (`createImageBitmap`) ; si le navigateur la refuse
 * (vieux navigateur, ou image SVG), solution de repli avec un élément <img>.
 */
async function loadImage(file: File): Promise<{ image: CanvasImageSource; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.src = url;
    await element.decode();
    // Un SVG sans taille déclarée a des dimensions nulles : on lui en donne une.
    const width = element.naturalWidth || 512;
    const height = element.naturalHeight || 512;
    // L'adresse temporaire doit rester valide tant que l'image sert à dessiner la tuile :
    // on la libère un peu plus tard.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { image: element, width, height };
  }
}

/**
 * Couleur moyenne d'une zone d'image.
 * Astuce : on réduit l'image à 1 × 1 pixel ; le navigateur fait lui-même la
 * moyenne des couleurs en réduisant. Il suffit ensuite de lire ce pixel.
 */
function averageColor(image: CanvasImageSource, x: number, y: number, side: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  context.drawImage(image, x, y, side, side, 0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Trace un rectangle aux coins arrondis (utilise `roundRect` si le navigateur
 * le connaît, sinon des arcs de cercle « à la main »).
 */
export function roundedRectPath(
  path: CanvasRenderingContext2D | Path2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  if (typeof path.roundRect === 'function') {
    path.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  path.moveTo(x + r, y);
  path.arcTo(x + width, y, x + width, y + height, r);
  path.arcTo(x + width, y + height, x, y + height, r);
  path.arcTo(x, y + height, x, y, r);
  path.arcTo(x, y, x + width, y, r);
  path.closePath();
}

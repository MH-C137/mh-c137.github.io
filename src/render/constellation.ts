/**
 * ============================================================================
 *  constellation.ts — Un ciel d'étoiles sans fin, FIXE dans le monde
 * ============================================================================
 *
 * Le fond est une immense toile d'étoiles, dans l'esprit du fond de l'équipe artistique :
 * beaucoup de poussière minuscule, des étoiles moyennes, de rares grosses étoiles, regroupées
 * en amas. Elle est ANCRÉE AU MONDE : une étoile a une place précise parmi les cases de la
 * grille. Quand on zoome ou qu'on déplace la vue, les étoiles suivent la grille exactement,
 * comme si on explorait une vraie constellation (elles ne « partent » pas sur le côté).
 *
 * Comment faire une toile sans fin sans l'avoir en mémoire ? En la découpant en CARRÉS
 * (« chunks ») de 32 × 32 cases, générés à la demande :
 *   - les étoiles d'un carré sont tirées au hasard avec une « graine » calculée à partir des
 *     coordonnées du carré : le même carré donne TOUJOURS les mêmes étoiles (aucun
 *     stockage, aucune couture entre deux carrés, et c'est testable) ;
 *   - la quantité d'étoiles d'un carré dépend d'un « bruit » lisse (un peu comme un relief) :
 *     certains endroits sont denses (des amas), d'autres presque vides ;
 *   - les carrés déjà calculés sont gardés en mémoire (une réserve limitée), pour ne pas
 *     recalculer à chaque image.
 *
 * Ce fichier a deux parties : le PLACEMENT (calcul pur, testé avec Node) et la classe
 * `Constellation` (le DESSIN dans un canvas).
 */

/** Côté d'un carré de la toile, en cases du monde. */
export const CHUNK = 32;
/** Nombre d'étoiles par case² en densité 1 (poussière comprise). */
const STARS_PER_CELL2 = 0.35;

/**
 * Mélange de bits (une « fonction de hachage ») : à partir de trois entiers, donne un
 * entier de 32 bits qui paraît aléatoire mais est toujours le même pour les mêmes entrées.
 */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Petit générateur de nombres pseudo-aléatoires (mulberry32) : avec la même « graine », il
 * donne toujours la même suite.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit lisse entre 0 et 1 : des valeurs au hasard aux coins d'une grille, mélangées en douceur entre les coins. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const smooth = (t: number) => t * t * (3 - 2 * t); // « lissage » : pas de cassure entre deux coins
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const corner = (cx: number, cy: number) => hash2(cx, cy, seed) / 4294967296;
  const top = corner(x0, y0) * (1 - tx) + corner(x0 + 1, y0) * tx;
  const bottom = corner(x0, y0 + 1) * (1 - tx) + corner(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Facteur de densité du carré (cx, cy) : autour de 1 en moyenne, de 0,2 (presque vide) à 2,6
 * (amas). Deux « échelles » de bruit : de grands amas (≈ 5 carrés) et de petits détails (≈ 2 carrés).
 */
export function densityFactor(cx: number, cy: number, seed: number): number {
  const noise = 0.65 * valueNoise(cx / 5, cy / 5, seed) + 0.35 * valueNoise(cx / 1.7, cy / 1.7, seed + 1);
  return 0.2 + 2.4 * noise * noise; // le carré accentue les contrastes : des amas nets, des vides
}

/** Répartition des tailles : [part des étoiles, rayon mini, rayon maxi] en CASES. Beaucoup de poussière, peu de grosses étoiles. */
const SIZE_CLASSES: ReadonlyArray<readonly [number, number, number]> = [
  [0.72, 0.04, 0.11], // poussière
  [0.24, 0.15, 0.4], // étoiles moyennes
  [0.04, 0.55, 1.3], // grosses étoiles
];

/** Valeurs mémorisées par étoile, à la suite les unes des autres : x, y (cases du monde), rayon (cases), angle, transparence. */
export const STAR_FIELDS = 5;

/**
 * Les étoiles du carré (cx, cy), dans un tableau plat : [x, y, rayon, angle, transparence, x, y, …].
 *
 * @param density 1 = quantité normale, 2 = deux fois plus d'étoiles…
 * @param seed    graine : change tout le ciel
 */
export function chunkStars(cx: number, cy: number, density: number, seed: number): Float32Array {
  const random = seededRandom(hash2(cx, cy, seed));
  const count = Math.round(CHUNK * CHUNK * STARS_PER_CELL2 * density * densityFactor(cx, cy, seed));
  const stars = new Float32Array(count * STAR_FIELDS);
  for (let i = 0; i < count; i++) {
    // Taille : on choisit une classe selon sa part, puis un rayon dans la classe.
    let pick = random();
    let range = SIZE_CLASSES[0]!;
    for (const candidate of SIZE_CLASSES) {
      range = candidate;
      if (pick < candidate[0]) break;
      pick -= candidate[0];
    }
    const offset = i * STAR_FIELDS;
    stars[offset] = cx * CHUNK + random() * CHUNK;
    stars[offset + 1] = cy * CHUNK + random() * CHUNK;
    stars[offset + 2] = range[1] + random() * (range[2] - range[1]);
    stars[offset + 3] = random() * Math.PI * 2;
    stars[offset + 4] = 0.45 + random() * 0.55;
  }
  return stars;
}

// ────────────────────────────────────────────────────────────────────────────
//  Dessin
// ────────────────────────────────────────────────────────────────────────────

type Icon = CanvasImageSource & { width: number; height: number };

/** Taille (px) de l'étoile colorée préparée une fois (elle est ensuite agrandie ou réduite). */
const STAR_SIZE = 256;
/** Nombre maximum de carrés calculés par image : au très grand dézoom, le ciel se remplit en quelques images. */
const CHUNKS_PER_FRAME = 120;
/** Nombre de carrés gardés en mémoire. */
const CACHE_LIMIT = 1500;
/** Nombre maximum d'étoiles dessinées par image (sécurité pour la fluidité). */
const MAX_DRAWN = 14000;
/** En dessous de cette taille d'affichage (px), une étoile est trop petite pour être dessinée. */
const MIN_RADIUS_PX = 0.7;
/** Une étoile plus petite que cela (px) est dessinée comme un simple point carré. */
const DOT_RADIUS_PX = 2.2;
/** En dessous de ce zoom (px par case), le ciel disparaît en douceur. */
const FADE_OUT_BELOW = 1.8;
const HIDDEN_BELOW = 0.8;

export class Constellation {
  /** Carrés déjà calculés (clé « cx,cy »). La Map garde l'ordre d'insertion : le plus ancien part en premier. */
  private readonly cache = new Map<string, Float32Array>();
  private star: HTMLCanvasElement | null = null;
  private color = '#ffffff';

  /**
   * @param icon    forme des grosses étoiles (la silhouette de l'icône de la DA) ; sans icône, tout est dessiné en petits carrés
   * @param density quantité d'étoiles (1 = normal)
   * @param seed    graine du ciel
   */
  constructor(
    private readonly icon: Icon | null,
    private readonly density: number,
    private readonly seed = 2024,
  ) {}

  /** (Re)prépare l'étoile colorée (au démarrage et à chaque changement de thème). */
  rebuild(color: string): void {
    this.color = color;
    if (!this.icon) return;
    const canvas = document.createElement('canvas');
    canvas.width = STAR_SIZE;
    canvas.height = STAR_SIZE;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.imageSmoothingQuality = 'high';
    const ratio = Math.min(STAR_SIZE / this.icon.width, STAR_SIZE / this.icon.height);
    const width = this.icon.width * ratio;
    const height = this.icon.height * ratio;
    context.drawImage(this.icon, (STAR_SIZE - width) / 2, (STAR_SIZE - height) / 2, width, height);
    context.globalCompositeOperation = 'source-in'; // colore seulement la silhouette
    context.fillStyle = color;
    context.fillRect(0, 0, STAR_SIZE, STAR_SIZE);
    this.star = canvas;
  }

  /** Les étoiles d'un carré, depuis la réserve ou calculées (et gardées). */
  private chunk(cx: number, cy: number): Float32Array {
    const key = `${cx},${cy}`;
    let stars = this.cache.get(key);
    if (!stars) {
      stars = chunkStars(cx, cy, this.density, this.seed);
      this.cache.set(key, stars);
      if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value as string);
    }
    return stars;
  }

  /**
   * Dessine le ciel derrière tout le reste.
   *
   * Les étoiles sont en coordonnées du MONDE (cases) : pour les placer à l'écran, on applique
   * la même formule que pour la grille : `(x − centreX) × zoom + largeur / 2`.
   *
   * @param centerX, centerY  centre de la vue, en cases (la caméra)
   * @param zoom              pixels écran par case
   * @param opacity           transparence générale (0 à 1)
   */
  draw(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    zoom: number,
    opacity: number,
  ): void {
    if (zoom < HIDDEN_BELOW) return; // trop dézoomé : ce serait des millions d'étoiles minuscules
    const fade = Math.min(1, (zoom - HIDDEN_BELOW) / (FADE_OUT_BELOW - HIDDEN_BELOW));
    const base = context.getTransform();
    const ratio = base.a; // facteur Retina de l'écran

    const left = centerX - width / 2 / zoom;
    const top = centerY - height / 2 / zoom;
    const margin = 1.5; // une grosse étoile peut dépasser de son carré
    const firstX = Math.floor((left - margin) / CHUNK);
    const lastX = Math.floor((left + width / zoom + margin) / CHUNK);
    const firstY = Math.floor((top - margin) / CHUNK);
    const lastY = Math.floor((top + height / zoom + margin) / CHUNK);

    context.fillStyle = this.color;
    let budget = CHUNKS_PER_FRAME;
    let drawn = 0;
    for (let cy = firstY; cy <= lastY; cy++) {
      for (let cx = firstX; cx <= lastX; cx++) {
        if (!this.cache.has(`${cx},${cy}`)) {
          if (budget-- <= 0) continue; // on calculera ce carré aux images suivantes
        }
        const stars = this.chunk(cx, cy);
        for (let i = 0; i < stars.length; i += STAR_FIELDS) {
          const radius = stars[i + 2]! * zoom; // rayon en pixels
          if (radius < MIN_RADIUS_PX) continue;
          const x = (stars[i]! - centerX) * zoom + width / 2;
          const y = (stars[i + 1]! - centerY) * zoom + height / 2;
          if (x < -radius || y < -radius || x > width + radius || y > height + radius) continue;
          if (++drawn > MAX_DRAWN) return;
          context.globalAlpha = stars[i + 4]! * opacity * fade;
          if (this.star && radius >= DOT_RADIUS_PX) {
            // Étoile tournée de `angle` : on pose la matrice (échelle × rotation × position), puis on la remet comme avant.
            const angle = stars[i + 3]!;
            const scale = (radius * 2) / STAR_SIZE;
            const cos = Math.cos(angle) * scale * ratio;
            const sin = Math.sin(angle) * scale * ratio;
            context.setTransform(cos, sin, -sin, cos, x * ratio, y * ratio);
            context.drawImage(this.star, -STAR_SIZE / 2, -STAR_SIZE / 2);
            context.setTransform(base);
          } else {
            context.fillRect(x - radius, y - radius, radius * 2, radius * 2); // poussière : un point
          }
        }
      }
    }
    context.globalAlpha = 1;
  }
}

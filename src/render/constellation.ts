/**
 * ============================================================================
 *  constellation.ts — Un fond d'étoiles « quasi infini »
 * ============================================================================
 *
 * Une grande toile d'étoiles dessinée par le site (pas une image fixe), dans l'esprit du
 * fond de l'équipe artistique : beaucoup de poussière minuscule, des étoiles moyennes, de
 * rares grosses étoiles, le tout regroupé en amas.
 *
 * L'impression d'infini repose sur trois idées :
 *   1. UNE TUILE QUI SE RECOLLE : la toile est générée sur un carré, et une étoile qui
 *      dépasse d'un bord est redessinée de l'autre côté (« tore »). Posée en mosaïque,
 *      on ne voit aucune couture.
 *   2. DEUX COUCHES de périodes différentes (ex. 1 400 px et 1 030 px) : leurs motifs ne
 *      retombent ensemble que très rarement, donc on ne reconnaît pas la répétition.
 *   3. LE PARALLAXE : le fond suit le déplacement de la grille en plus lentement (la
 *      couche lointaine encore plus lentement). Comme dans une vraie vitre devant un
 *      ciel : la grille bouge, le ciel défile derrière, plus loin.
 *
 * Ce fichier a deux parties : `scatterStars` (le PLACEMENT, calcul pur, testé avec Node)
 * et la classe `Constellation` (le DESSIN dans un canvas).
 */

export interface Star {
  /** Position dans la tuile (0 ≤ x, y < taille). */
  readonly x: number;
  readonly y: number;
  /** Rayon, en pixels. */
  readonly radius: number;
  /** Rotation (radians) : toutes les étoiles ne pointent pas vers le haut. */
  readonly angle: number;
  /** Transparence (0 à 1) : les étoiles lointaines sont plus pâles. */
  readonly alpha: number;
}

/**
 * Petit générateur de nombres pseudo-aléatoires (mulberry32) : avec la même « graine », il
 * donne toujours la même suite. Le fond est donc identique à chaque visite (et testable).
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

/** Répartition des tailles : [part des étoiles, rayon mini, rayon maxi] (px). Beaucoup de poussière, peu de grosses étoiles. */
const SIZE_CLASSES: ReadonlyArray<readonly [number, number, number]> = [
  [0.72, 0.8, 2.2], // poussière
  [0.24, 3, 8], // étoiles moyennes
  [0.04, 11, 26], // grosses étoiles
];

/**
 * Place les étoiles d'une tuile carrée de `size` pixels.
 *
 * Algorithme :
 *   - on tire quelques CENTRES d'amas au hasard ;
 *   - 80 % des étoiles sont tirées autour d'un centre (écart aléatoire de forme « cloche »,
 *     obtenu en additionnant 3 tirages), les 20 % restants sont réparties partout ;
 *   - la taille suit `SIZE_CLASSES` ;
 *   - toutes les positions sont ramenées dans la tuile (modulo) : c'est le « tore ».
 *
 * @param size    côté de la tuile, en pixels
 * @param density 1 = quantité normale, 2 = deux fois plus d'étoiles…
 * @param seed    graine du hasard
 */
export function scatterStars(size: number, density: number, seed: number): Star[] {
  const random = seededRandom(seed);
  const count = Math.round(((size * size) / 1600) * density); // ~1 étoile pour 1600 px²
  const clusterCount = 7 + Math.floor(random() * 4);
  const clusters = Array.from({ length: clusterCount }, () => ({
    x: random() * size,
    y: random() * size,
    spread: size * (0.07 + random() * 0.1),
  }));
  const bell = () => (random() + random() + random() - 1.5) / 1.5; // entre −1 et 1, plutôt proche de 0
  const wrap = (value: number) => ((value % size) + size) % size;

  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    if (random() < 0.8) {
      const cluster = clusters[Math.floor(random() * clusters.length)]!;
      x = cluster.x + bell() * cluster.spread * 2;
      y = cluster.y + bell() * cluster.spread * 2;
    } else {
      x = random() * size;
      y = random() * size;
    }
    // Taille : on choisit une classe selon sa part, puis un rayon dans la classe.
    let pick = random();
    let range = SIZE_CLASSES[0]!;
    for (const candidate of SIZE_CLASSES) {
      range = candidate;
      if (pick < candidate[0]) break;
      pick -= candidate[0];
    }
    const radius = range[1] + random() * (range[2] - range[1]);
    stars.push({ x: wrap(x), y: wrap(y), radius, angle: random() * Math.PI * 2, alpha: 0.45 + random() * 0.55 });
  }
  return stars;
}

/**
 * Les positions où dessiner une étoile pour que la tuile se recolle : l'étoile elle-même, plus
 * une copie décalée d'une période de l'autre côté si elle dépasse d'un bord.
 */
export function wrappedPositions(star: Star, size: number): Array<[number, number]> {
  const xs = [star.x];
  const ys = [star.y];
  if (star.x - star.radius < 0) xs.push(star.x + size);
  if (star.x + star.radius > size) xs.push(star.x - size);
  if (star.y - star.radius < 0) ys.push(star.y + size);
  if (star.y + star.radius > size) ys.push(star.y - size);
  return xs.flatMap((x) => ys.map((y): [number, number] => [x, y]));
}

// ────────────────────────────────────────────────────────────────────────────
//  Dessin
// ────────────────────────────────────────────────────────────────────────────

/** Une couche : une tuile déjà dessinée, avec sa période et sa « profondeur ». */
interface Layer {
  readonly canvas: HTMLCanvasElement;
  /** Côté de la tuile à l'écran, en pixels. */
  readonly period: number;
  /** Part du déplacement de la grille suivie par cette couche (les couches lointaines en suivent moins). */
  readonly depth: number;
}

type Icon = CanvasImageSource & { width: number; height: number };

/** La tuile est dessinée en demi-résolution : en l'agrandissant, le navigateur l'adoucit (fond « flou », donc loin). */
const BAKE_SCALE = 0.5;

export class Constellation {
  private layers: Layer[] = [];

  /**
   * @param icon  forme des étoiles (la silhouette de l'icône de la DA) ; sans icône, de petits points
   * @param density quantité d'étoiles (1 = normal)
   */
  constructor(
    private readonly icon: Icon | null,
    private readonly density: number,
  ) {}

  /** (Re)dessine les tuiles dans la couleur donnée (appelé au démarrage et à chaque changement de thème). */
  rebuild(color: string): void {
    // Couche lointaine : petite période, étoiles pâles. Couche proche : grande période.
    const specs = [
      { period: 1030, depth: 0.55, seed: 1031, fade: 0.55 },
      { period: 1400, depth: 1, seed: 7919, fade: 1 },
    ];
    this.layers = specs.map(({ period, depth, seed, fade }) => ({
      canvas: this.bake(period, seed, color, fade),
      period,
      depth,
    }));
  }

  /** Dessine une tuile : les étoiles placées par `scatterStars`, recollées sur les bords. */
  private bake(period: number, seed: number, color: string, fade: number): HTMLCanvasElement {
    const side = Math.round(period * BAKE_SCALE);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.scale(BAKE_SCALE, BAKE_SCALE);

    // Étoile teintée, préparée une fois : on dessine l'icône puis on la colore (source-in).
    let tinted: HTMLCanvasElement | null = null;
    if (this.icon) {
      tinted = document.createElement('canvas');
      tinted.width = 96;
      tinted.height = 96;
      const t = tinted.getContext('2d') as CanvasRenderingContext2D;
      const ratio = Math.min(96 / this.icon.width, 96 / this.icon.height);
      t.drawImage(this.icon, (96 - this.icon.width * ratio) / 2, (96 - this.icon.height * ratio) / 2, this.icon.width * ratio, this.icon.height * ratio);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = color;
      t.fillRect(0, 0, 96, 96);
    }

    for (const star of scatterStars(period, this.density, seed)) {
      context.globalAlpha = star.alpha * fade;
      for (const [x, y] of wrappedPositions(star, period)) {
        if (tinted && star.radius >= 2.5) {
          context.save();
          context.translate(x, y);
          context.rotate(star.angle);
          context.drawImage(tinted, -star.radius, -star.radius, star.radius * 2, star.radius * 2);
          context.restore();
        } else {
          context.fillStyle = color; // poussière : un petit point
          context.fillRect(x - star.radius, y - star.radius, star.radius * 2, star.radius * 2);
        }
      }
    }
    return canvas;
  }

  /**
   * Pose la constellation derrière tout le reste.
   * @param offsetX, offsetY  déplacement de la grille, en pixels écran (la position de la caméra × le zoom)
   * @param parallax          part de ce déplacement suivie par le fond (0 = fixe)
   */
  draw(context: CanvasRenderingContext2D, width: number, height: number, offsetX: number, offsetY: number, parallax: number): void {
    for (const layer of this.layers) {
      const shift = parallax * layer.depth;
      // Décalage de la mosaïque, ramené entre −période et 0 pour couvrir l'écran avec le moins de tuiles possible.
      const startX = ((((-offsetX * shift) % layer.period) + layer.period) % layer.period) - layer.period;
      const startY = ((((-offsetY * shift) % layer.period) + layer.period) % layer.period) - layer.period;
      for (let x = startX; x < width; x += layer.period) {
        for (let y = startY; y < height; y += layer.period) {
          context.drawImage(layer.canvas, x, y, layer.period, layer.period);
        }
      }
    }
  }
}

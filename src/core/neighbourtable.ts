/**
 * ============================================================================
 *  neighbourtable.ts — La table « case → nombre de voisines » (cœur de World.step)
 * ============================================================================
 *
 * Pour passer à la génération suivante, World compte, pour chaque case touchée par une cellule
 * vivante, combien elle a de voisines vivantes. Avec une `Map` JavaScript, chaque ajout « emballe »
 * la clé (un grand nombre à virgule) dans un petit objet : pour 100 000 cellules, ça fait
 * près d'un million d'objets créés à CHAQUE génération, et le ramasse-miettes ne suit plus.
 *
 * Cette table évite ça : c'est une table de hachage à « adressage ouvert » rangée dans deux
 * tableaux typés (aucun objet créé) :
 *
 *   keys[i]   la clé de la case (le nombre qui code x et y, voir coords.ts) ;
 *   values[i] 0 = emplacement libre, sinon  (voisines × 2) + (1 si la case est vivante).
 *
 * Comment ça marche :
 *   - On calcule un emplacement de départ avec une fonction de hachage (un « mélangeur » de bits).
 *   - Si l'emplacement est pris par une AUTRE case, on essaie le suivant (sondage linéaire) ;
 *     on s'arrête à la bonne case ou au premier emplacement libre.
 *   - La table fait toujours plus de deux fois le nombre de cases possibles (9 par cellule vivante) :
 *     elle n'est jamais pleine, donc les recherches restent très courtes.
 *   - Les tableaux sont gardés d'une génération à l'autre (on ne réalloue que s'il faut grandir).
 *
 * Le fichier ne dépend de rien (pas de DOM) : il peut tourner dans un Web Worker.
 */

/** 2^32, pour séparer une clé en « partie haute » et « partie basse » de 32 bits. */
const TWO_32 = 4294967296;

export class NeighbourTable {
  private keys = new Float64Array(0);
  private values = new Uint8Array(0);
  /** Masque de la table en cours d'utilisation (taille − 1, la taille est une puissance de 2). */
  private mask = 0;

  /**
   * Prépare une table vide capable de recevoir les voisines de `livingCells` cellules vivantes.
   * Au pire, chaque vivante touche 8 cases voisines : on prévoit au moins deux fois plus de places.
   */
  reset(livingCells: number): void {
    let size = 1024;
    while (size < livingCells * 18) size *= 2;
    if (this.keys.length < size) {
      this.keys = new Float64Array(size);
      this.values = new Uint8Array(size);
    } else {
      this.values.fill(0, 0, size); // on ne remet à zéro que la partie utilisée
    }
    this.mask = size - 1;
  }

  /** Emplacement de départ d'une clé : on mélange les deux moitiés du nombre. */
  private slotOf(key: number): number {
    const high = Math.floor(key / TWO_32);
    const low = key - high * TWO_32;
    let hash = Math.imul(low | 0, 0x9e3779b1) ^ Math.imul(high, 0x85ebca6b);
    hash ^= hash >>> 15;
    return hash & this.mask;
  }

  /** Ajoute une voisine vivante (+2) à la case `key`, en la créant si besoin. */
  addNeighbour(key: number): void {
    const { keys, values, mask } = this;
    let slot = this.slotOf(key);
    while (values[slot] !== 0 && keys[slot] !== key) slot = (slot + 1) & mask;
    if (values[slot] === 0) keys[slot] = key;
    values[slot] += 2;
  }

  /** Emplacement de la case `key`, ou -1 si aucune cellule vivante ne la touche. */
  find(key: number): number {
    const { keys, values, mask } = this;
    let slot = this.slotOf(key);
    while (values[slot] !== 0) {
      if (keys[slot] === key) return slot;
      slot = (slot + 1) & mask;
    }
    return -1;
  }

  /** Nombre de voisines vivantes de la case à l'emplacement `slot`. */
  neighboursAt(slot: number): number {
    return (this.values[slot] as number) >> 1;
  }

  /** Marque la case à l'emplacement `slot` comme « vivante » (elle ne pourra pas naître). */
  markAlive(slot: number): void {
    this.values[slot] = (this.values[slot] as number) | 1;
  }

  /** Nombre d'emplacements de la table en cours (pour la parcourir de 0 à `size − 1`). */
  get size(): number {
    return this.mask + 1;
  }

  /** Vrai si l'emplacement contient une case. */
  isUsed(slot: number): boolean {
    return (this.values[slot] as number) !== 0;
  }

  /** Clé de la case à l'emplacement `slot`. */
  keyAt(slot: number): number {
    return this.keys[slot] as number;
  }

  /** Vrai si la case à l'emplacement `slot` est marquée vivante. */
  isAliveAt(slot: number): boolean {
    return ((this.values[slot] as number) & 1) === 1;
  }
}

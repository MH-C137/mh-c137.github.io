/**
 * ============================================================================
 *  world.ts — Le MONDE : la grille quasi infinie et le calcul des générations
 * ============================================================================
 *
 * C'est le cœur du programme. Ce fichier ne touche JAMAIS à l'affichage (pas de
 * canvas, pas de HTML) : il peut donc être testé seul, réutilisé dans un autre
 * programme, ou déplacé plus tard dans un « Web Worker » (calcul en arrière-plan).
 *
 * ─── Idée 1 : une représentation « creuse » ──────────────────────────────────
 * Un monde de 67 millions × 67 millions de cases ne tient dans aucune mémoire.
 * Mais il est presque entièrement vide ! On ne stocke donc QUE les cellules
 * vivantes, dans une table de hachage (`Map`) : clé de la case → informations.
 * Le coût mémoire et le temps de calcul dépendent du nombre de cellules
 * vivantes, pas de la taille du monde.
 *
 * ─── Idée 2 : les 4 états affichés ───────────────────────────────────────────
 *   - « née »            : vivante, et âge = 0 (elle vient d'apparaître) ;
 *   - « vivante »        : vivante depuis au moins une génération (âge ≥ 1) ;
 *   - « vient de mourir » : vivante à la génération précédente, morte maintenant
 *                           (on garde leur liste : c'est la « trace ») ;
 *   - « morte »          : tout le reste (le fond).
 *
 * ─── Idée 3 : les habillages (images) ────────────────────────────────────────
 * Chaque cellule vivante peut porter une image (numéro ≠ 0). Une cellule qui
 * naît hérite de l'image MAJORITAIRE parmi ses voisines vivantes (ses
 * « parents » : 3 avec la règle classique). C'est une variante connue du jeu
 * de la vie (« Immigration », « QuadLife ») : les images se propagent et se
 * disputent le territoire, sans changer les règles de vie et de mort.
 */

import {
  NEIGHBOR_DELTAS,
  isInsideWorld,
  isKeyInsideWorld,
  keyX,
  keyY,
  toKey,
  type CellRect,
} from './coords';
import { createPattern, type Pattern } from './pattern';
import { CONWAY, type Rule } from './rules';

/**
 * Une « photo » complète du monde à un instant donné, dans des tableaux compacts.
 * Sert à l'historique (pour reculer dans le temps) et, plus tard, à la sauvegarde.
 */
export interface WorldSnapshot {
  readonly generation: number;
  /** Clés des cellules vivantes. */
  readonly keys: Float64Array;
  /** Âge de chaque cellule vivante (même ordre que `keys`). */
  readonly ages: Uint32Array;
  /** Habillage de chaque cellule (même ordre), ou `null` s'il n'y a aucune image. */
  readonly skins: Uint16Array | null;
  /** Clés des cellules mortes à la dernière génération (la « trace »). */
  readonly trace: Float64Array;
}

/** Nombre de cellules mémorisées dans une photo (sert à limiter la mémoire). */
export function snapshotSize(snapshot: WorldSnapshot): number {
  return snapshot.keys.length + snapshot.trace.length;
}

export class World {
  /** Cellules vivantes : clé → âge (0 = née à cette génération). */
  private ages = new Map<number, number>();
  /** Habillages : clé → numéro d'image. Seules les cellules avec une image (≠ 0) y figurent. */
  private skins = new Map<number, number>();
  /** Cellules mortes lors du dernier passage de génération. */
  private trace: number[] = [];
  private _generation = 0;

  /** Règle d'évolution utilisée (patron Stratégie, voir rules.ts). */
  rule: Rule = CONWAY;

  /** Numéro de la génération actuelle (0 au départ). */
  get generation(): number {
    return this._generation;
  }

  /** Nombre de cellules vivantes. */
  get population(): number {
    return this.ages.size;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Lecture
  // ──────────────────────────────────────────────────────────────────────────

  isAlive(x: number, y: number): boolean {
    return this.ages.has(toKey(x, y));
  }

  /** Âge de la cellule (x, y), ou -1 si elle est morte. */
  getAge(x: number, y: number): number {
    return this.ages.get(toKey(x, y)) ?? -1;
  }

  /** Habillage de la cellule (x, y) : 0 si aucune image (ou cellule morte). */
  getSkin(x: number, y: number): number {
    return this.skins.get(toKey(x, y)) ?? 0;
  }

  /** Appelle `visit` pour chaque cellule vivante. */
  forEachCell(visit: (x: number, y: number, age: number, skin: number) => void): void {
    const hasSkins = this.skins.size > 0;
    for (const [key, age] of this.ages) {
      visit(keyX(key), keyY(key), age, hasSkins ? (this.skins.get(key) ?? 0) : 0);
    }
  }

  /** Appelle `visit` pour chaque cellule « qui vient de mourir ». */
  forEachTrace(visit: (x: number, y: number) => void): void {
    for (const key of this.trace) visit(keyX(key), keyY(key));
  }

  /** Plus petit rectangle contenant toutes les cellules vivantes (null si le monde est vide). */
  boundingBox(): CellRect | null {
    if (this.ages.size === 0) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const key of this.ages.keys()) {
      const x = keyX(key);
      const y = keyY(key);
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Modifications par l'utilisateur (pinceau, gomme, structures…)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Rend la cellule (x, y) vivante ou morte.
   * - Une cellule dessinée est « née » (âge 0) : elle s'affiche comme une naissance.
   * - Repeindre une cellule déjà vivante avec une autre image change seulement son image.
   * - Effacer une cellule ne laisse pas de trace (la trace ne vient que de l'évolution).
   *
   * @returns vrai si quelque chose a changé (utile pour ne pas redessiner pour rien).
   */
  setCell(x: number, y: number, alive: boolean, skin = 0): boolean {
    if (!isInsideWorld(x, y)) return false;
    const key = toKey(x, y);
    if (!alive) {
      if (!this.ages.has(key)) return false;
      this.ages.delete(key);
      this.skins.delete(key);
      return true;
    }
    let changed = false;
    if (!this.ages.has(key)) {
      this.ages.set(key, 0);
      changed = true;
    }
    if ((this.skins.get(key) ?? 0) !== skin) {
      if (skin === 0) this.skins.delete(key);
      else this.skins.set(key, skin);
      changed = true;
    }
    return changed;
  }

  /**
   * Pose une structure avec son coin haut-gauche en (originX, originY).
   * Mode « ajout » : les cases vides de la structure n'effacent rien.
   * @returns le nombre de cellules modifiées.
   */
  placePattern(pattern: Pattern, originX: number, originY: number): number {
    let changed = 0;
    for (const [x, y, skin] of pattern.cells) {
      if (this.setCell(originX + x, originY + y, true, skin)) changed++;
    }
    return changed;
  }

  /** Copie les cellules d'un rectangle sous forme de structure (null s'il est vide). */
  extractRect(rect: CellRect): Pattern | null {
    const cells: Array<[number, number, number]> = [];
    this.forEachCell((x, y, _age, skin) => {
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) cells.push([x, y, skin]);
    });
    return cells.length > 0 ? createPattern(cells) : null;
  }

  /** Efface toutes les cellules (et la trace) d'un rectangle. @returns le nombre de cellules effacées. */
  clearRect(rect: CellRect): number {
    const inside = (key: number) => {
      const x = keyX(key);
      const y = keyY(key);
      return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
    };
    let removed = 0;
    for (const key of [...this.ages.keys()]) {
      if (inside(key)) {
        this.ages.delete(key);
        this.skins.delete(key);
        removed++;
      }
    }
    this.trace = this.trace.filter((key) => !inside(key));
    return removed;
  }

  /** Vide entièrement le monde et remet le compteur de générations à 0. */
  clear(): void {
    this.ages.clear();
    this.skins.clear();
    this.trace = [];
    this._generation = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  L'algorithme : passer à la génération suivante
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calcule la génération suivante.
   *
   * Problème : on ne peut pas parcourir les 4,5 millions de milliards de cases
   * du monde. Mais seule une case qui touche une cellule vivante (ou qui en est
   * une) peut changer d'état ! On ne regarde donc que celles-là.
   *
   * PASSE 1 — « Chaque vivante prévient ses voisines ».
   *   Pour chaque cellule vivante, on ajoute 1 au compteur de voisines de ses
   *   8 voisines. Astuce : dans un même nombre on range DEUX informations :
   *     valeur = (nombre de voisines vivantes) × 2  +  (1 si la case elle-même est vivante)
   *   Le bit de poids faible (valeur & 1) dit « vivante ou non », le reste
   *   (valeur >> 1, c'est-à-dire divisé par 2) donne le nombre de voisines.
   *   Une seule table suffit, et elle contient exactement les cases à examiner.
   *
   * PASSE 2 — « On applique la règle ».
   *   Pour chaque case de la table :
   *     - vivante et `survival[voisines]`  → elle survit, son âge augmente de 1 ;
   *     - morte et `birth[voisines]`       → elle naît (âge 0) et hérite d'une image ;
   *     - sinon                            → elle est morte à la génération suivante.
   *
   * PASSE 3 — « La trace ».
   *   Toute cellule vivante avant mais absente après vient de mourir.
   *
   * IMPORTANT : on construit la nouvelle génération dans de NOUVELLES tables, sans
   * toucher à l'ancienne pendant le calcul. Sinon, une case déjà mise à jour
   * fausserait le compte de ses voisines (toutes les cases doivent changer
   * « en même temps »). C'est le principe du double tampon (double buffering).
   *
   * Complexité : O(P), où P est le nombre de cellules vivantes (chaque vivante
   * touche 9 cases). Indépendant de la taille du monde.
   */
  step(): void {
    // PASSE 1 : compter les voisines.
    const counts = new Map<number, number>();
    for (const key of this.ages.keys()) {
      counts.set(key, (counts.get(key) ?? 0) | 1); // marque « je suis vivante »
      for (const delta of NEIGHBOR_DELTAS) {
        const neighbour = key + delta;
        counts.set(neighbour, (counts.get(neighbour) ?? 0) + 2); // +1 voisine (×2)
      }
    }

    // PASSE 2 : appliquer la règle.
    const nextAges = new Map<number, number>();
    const nextSkins = new Map<number, number>();
    const hasSkins = this.skins.size > 0;
    const { birth, survival } = this.rule;
    for (const [key, value] of counts) {
      const neighbours = value >> 1;
      if (value & 1) {
        if (survival[neighbours]) {
          nextAges.set(key, (this.ages.get(key) ?? 0) + 1);
          if (hasSkins) {
            const skin = this.skins.get(key);
            if (skin !== undefined) nextSkins.set(key, skin);
          }
        }
      } else if (birth[neighbours] && isKeyInsideWorld(key)) {
        nextAges.set(key, 0);
        if (hasSkins) {
          const skin = this.inheritedSkin(key);
          if (skin !== 0) nextSkins.set(key, skin);
        }
      }
    }

    // PASSE 3 : la trace des cellules qui viennent de mourir.
    const trace: number[] = [];
    for (const key of this.ages.keys()) {
      if (!nextAges.has(key)) trace.push(key);
    }

    this.ages = nextAges;
    this.skins = nextSkins;
    this.trace = trace;
    this._generation++;
  }

  /**
   * Image héritée par une cellule qui naît en `key`.
   *
   * On regarde l'image de chaque voisine vivante (0 = pas d'image), puis on
   * garde la plus fréquente : un « vote à la majorité ». En cas d'égalité, on
   * prend le plus petit numéro (0 en priorité). La règle est ainsi
   * DÉTERMINISTE : le même passé donne toujours le même futur, ce qui est
   * indispensable pour l'historique et les tests.
   */
  private inheritedSkin(key: number): number {
    const parents: number[] = [];
    for (const delta of NEIGHBOR_DELTAS) {
      const neighbour = key + delta;
      if (this.ages.has(neighbour)) parents.push(this.skins.get(neighbour) ?? 0);
    }
    let best = 0;
    let bestVotes = 0;
    for (const candidate of parents) {
      let votes = 0;
      for (const other of parents) if (other === candidate) votes++;
      if (votes > bestVotes || (votes === bestVotes && candidate < best)) {
        best = candidate;
        bestVotes = votes;
      }
    }
    return best;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Photos (historique, sauvegardes)
  // ──────────────────────────────────────────────────────────────────────────

  /** Prend une photo compacte et indépendante de l'état actuel du monde. */
  snapshot(): WorldSnapshot {
    const count = this.ages.size;
    const keys = new Float64Array(count);
    const ages = new Uint32Array(count);
    const skins = this.skins.size > 0 ? new Uint16Array(count) : null;
    let i = 0;
    for (const [key, age] of this.ages) {
      keys[i] = key;
      ages[i] = age;
      if (skins) skins[i] = this.skins.get(key) ?? 0;
      i++;
    }
    return { generation: this._generation, keys, ages, skins, trace: Float64Array.from(this.trace) };
  }

  /** Remet le monde exactement dans l'état d'une photo. */
  restore(snapshot: WorldSnapshot): void {
    const ages = new Map<number, number>();
    const skins = new Map<number, number>();
    for (let i = 0; i < snapshot.keys.length; i++) {
      const key = snapshot.keys[i] as number;
      ages.set(key, snapshot.ages[i] as number);
      const skin = snapshot.skins?.[i] ?? 0;
      if (skin !== 0) skins.set(key, skin);
    }
    this.ages = ages;
    this.skins = skins;
    this.trace = Array.from(snapshot.trace);
    this._generation = snapshot.generation;
  }
}

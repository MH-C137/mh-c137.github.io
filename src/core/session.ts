/**
 * ============================================================================
 *  session.ts — Le format de « reprise » : ce qu'on garde quand on recharge la page
 * ============================================================================
 *
 * Quand on rafraîchit la page (ou qu'elle plante), on veut retrouver :
 *   - la grille telle qu'on l'a laissée (cellules vivantes, numéro de génération) ;
 *   - « Mes structures » (celles qu'on a sauvegardées depuis une sélection) ;
 *   - la vue (centre et zoom) et la vitesse.
 *
 * Ce fichier ne sait PAS où l'on stocke tout ça (c'est le travail de ui/persistence.ts, qui utilise
 * le stockage du navigateur) : il transforme seulement l'état en TEXTE et le texte en état. Il ne
 * dépend donc ni du DOM ni de `window`, et se teste avec Node.
 *
 * ─── Idée 1 : on ne garde que les cellules vivantes, en « plages » ──────────────────────────────
 * Une plage = une colonne de cellules vivantes consécutives, notée « x, y de départ, longueur ».
 * Un planeur tient en 5 nombres, un carré plein de 1 000 × 1 000 cellules en 3 000 (une plage par
 * colonne), au lieu de 1 000 000 de cases. On trie d'abord les clés des cellules (voir coords.ts :
 * la clé range x puis y), donc les cellules d'une même colonne se suivent.
 * L'âge des cellules n'est pas gardé : à la reprise, toutes sont « vivantes » (âge 1).
 *
 * ─── Idée 2 : on NE FAIT JAMAIS CONFIANCE au texte relu ─────────────────────────────────────────
 * Le texte vient du stockage du navigateur : il a pu être abîmé (écriture interrompue), changé
 * (autre version du site) ou modifié à la main. `parseSession` vérifie tout (version, types, nombres
 * finis et entiers, coordonnées dans le monde, nombre de cellules, tailles) et renvoie `null` au
 * moindre doute : mieux vaut repartir d'une grille vide que planter la page.
 */

import { isInsideWorld, keyX, keyY, toKey } from './coords';
import { toRle } from './rle';
import type { Pattern } from './pattern';
import type { World, WorldSnapshot } from './world';

/** Numéro du format. Si un jour il change, les anciennes sauvegardes sont simplement ignorées. */
export const SESSION_VERSION = 1;

/** Limites (sécurité) : au-delà, la sauvegarde est refusée ou la reprise ignorée. */
export const MAX_SESSION_CHARS = 3_000_000;
export const MAX_SESSION_CELLS = 1_000_000;
export const MAX_SAVED_STRUCTURES = 100;
export const MAX_STRUCTURE_RLE_CHARS = 200_000;
export const MAX_STRUCTURE_NAME_CHARS = 60;

/** Une structure de « Mes structures », sous forme de texte. */
export interface SavedStructure {
  readonly name: string;
  /** La structure au format RLE (voir rle.ts). */
  readonly rle: string;
}

/** Tout ce qu'on garde d'une session. */
export interface SavedSession {
  readonly version: typeof SESSION_VERSION;
  readonly generation: number;
  /** Plages de cellules vivantes, à plat : x, y, longueur, x, y, longueur… (colonnes verticales). */
  readonly runs: readonly number[];
  readonly structures: readonly SavedStructure[];
  readonly camera: { readonly x: number; readonly y: number; readonly zoom: number };
  /** Vitesse en générations par seconde. */
  readonly speed: number;
}

/**
 * Transforme les cellules vivantes d'un monde en plages (voir « Idée 1 »).
 *
 * Algorithme : on prend les clés triées ; tant que la clé suivante est la clé précédente + 1 ET qu'elle est
 * dans la même colonne, la plage s'allonge ; sinon on ferme la plage et on en ouvre une autre. Coût : O(n log n)
 * (le tri), n étant le nombre de cellules vivantes.
 */
export function encodeRuns(world: World): number[] {
  const keys = world.snapshot().keys; // copie : on peut la trier sans toucher au monde
  keys.sort(); // un Float64Array se trie par ordre numérique
  const runs: number[] = [];
  let i = 0;
  while (i < keys.length) {
    const start = keys[i] as number;
    const x = keyX(start);
    const y = keyY(start);
    let length = 1;
    while (i + length < keys.length && keys[i + length] === start + length && keyX(keys[i + length] as number) === x) length++;
    runs.push(x, y, length);
    i += length;
  }
  return runs;
}

/**
 * Reconstruit une « photo » du monde à partir des plages (l'opération inverse de `encodeRuns`).
 * Toutes les cellules reprennent à l'âge 1 (vivantes), sans trace ni image.
 */
export function snapshotFromRuns(runs: readonly number[], generation: number): WorldSnapshot {
  let count = 0;
  for (let i = 2; i < runs.length; i += 3) count += runs[i] as number;
  const keys = new Float64Array(count);
  let next = 0;
  for (let i = 0; i < runs.length; i += 3) {
    const x = runs[i] as number;
    const y = runs[i + 1] as number;
    const length = runs[i + 2] as number;
    for (let k = 0; k < length; k++) keys[next++] = toKey(x, y + k);
  }
  return { generation, keys, ages: new Uint32Array(count).fill(1), skins: null, trace: new Float64Array(0) };
}

/** Vrai si `value` est un nombre entier fini. */
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
/** Vrai si `value` est un nombre fini (entier ou décimal). */
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Écrit une session en texte (JSON). Renvoie `null` si le résultat dépasse MAX_SESSION_CHARS ou si le
 * monde a trop de cellules : l'appelant garde alors seulement ce qui est petit (les structures).
 */
export function serializeSession(session: SavedSession): string | null {
  if (session.runs.length / 3 > MAX_SESSION_CELLS) return null;
  const text = JSON.stringify(session);
  return text.length > MAX_SESSION_CHARS ? null : text;
}

/**
 * Lit un texte de session en vérifiant TOUT (voir « Idée 2 »).
 * @returns la session, ou `null` si le texte est absent, abîmé, d'une autre version ou démesuré.
 */
export function parseSession(text: string | null): SavedSession | null {
  if (text === null || text.length > MAX_SESSION_CHARS) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== SESSION_VERSION) return null;
  if (!isInteger(data.generation) || data.generation < 0) return null;
  if (!isFiniteNumber(data.speed) || data.speed <= 0 || data.speed > 1000) return null;

  const camera = data.camera as Record<string, unknown> | undefined;
  if (typeof camera !== 'object' || camera === null) return null;
  if (!isFiniteNumber(camera.x) || !isFiniteNumber(camera.y) || !isFiniteNumber(camera.zoom)) return null;
  if (Math.abs(camera.x) > 2 ** 26 || Math.abs(camera.y) > 2 ** 26 || camera.zoom <= 0 || camera.zoom > 1000) return null;

  // Les plages : triplets d'entiers, longueur ≥ 1, toutes les cellules dans le monde, total borné.
  if (!Array.isArray(data.runs) || data.runs.length % 3 !== 0 || data.runs.length / 3 > MAX_SESSION_CELLS) return null;
  let cells = 0;
  for (let i = 0; i < data.runs.length; i += 3) {
    const x: unknown = data.runs[i];
    const y: unknown = data.runs[i + 1];
    const length: unknown = data.runs[i + 2];
    if (!isInteger(x) || !isInteger(y) || !isInteger(length) || length < 1) return null;
    cells += length;
    if (cells > MAX_SESSION_CELLS) return null;
    if (!isInsideWorld(x, y) || !isInsideWorld(x, y + length - 1)) return null;
  }

  // Mes structures : noms et textes RLE bornés. (Le RLE lui-même est relu plus tard par parseRle, qui a ses propres limites.)
  if (!Array.isArray(data.structures) || data.structures.length > MAX_SAVED_STRUCTURES) return null;
  const structures: SavedStructure[] = [];
  for (const item of data.structures as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { name, rle } = item as Record<string, unknown>;
    if (typeof name !== 'string' || typeof rle !== 'string') return null;
    if (name.length > MAX_STRUCTURE_NAME_CHARS || rle.length > MAX_STRUCTURE_RLE_CHARS) return null;
    structures.push({ name, rle });
  }

  return {
    version: SESSION_VERSION,
    generation: data.generation,
    runs: data.runs as number[],
    structures,
    camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
    speed: data.speed,
  };
}

/** Une structure de la bibliothèque sous forme de texte (pour la sauvegarde). */
export function saveStructure(name: string, pattern: Pattern): SavedStructure {
  return { name: name.slice(0, MAX_STRUCTURE_NAME_CHARS), rle: toRle(pattern) };
}

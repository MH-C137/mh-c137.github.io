/**
 * ============================================================================
 *  patterns.ts — La bibliothèque de structures (panneau de droite)
 * ============================================================================
 *
 * Les structures célèbres sont écrites au format RLE (voir core/rle.ts), le
 * standard de la communauté. Pour en ajouter une : copier son RLE depuis
 * LifeWiki (https://conwaylife.com/wiki) et ajouter une entrée ci-dessous.
 *
 * Les descriptions sont écrites pour des collégiens : courtes et concrètes.
 */

import { Emitter } from '../core/events';
import type { Pattern } from '../core/pattern';
import { parseRle } from '../core/rle';

export type PatternCategory =
  | 'Stables'
  | 'Oscillateurs'
  | 'Vaisseaux'
  | 'Canons'
  | 'Mathusalems'
  | 'Mes structures';

/** Ordre d'affichage des catégories dans le panneau. */
export const CATEGORY_ORDER: readonly PatternCategory[] = [
  'Mes structures',
  'Stables',
  'Oscillateurs',
  'Vaisseaux',
  'Canons',
  'Mathusalems',
];

export interface PatternEntry {
  readonly id: string;
  readonly name: string;
  readonly category: PatternCategory;
  readonly description: string;
  readonly pattern: Pattern;
}

/** Définition « brute » : le RLE est converti en structure au chargement. */
interface BuiltinDefinition {
  id: string;
  name: string;
  category: PatternCategory;
  description: string;
  rle: string;
}

const BUILTIN_DEFINITIONS: BuiltinDefinition[] = [
  // ── Stables : elles ne changent jamais ───────────────────────────────────
  { id: 'block', name: 'Bloc', category: 'Stables', rle: '2o$2o!',
    description: 'Ne bouge jamais : chaque cellule a exactement 3 voisines.' },
  { id: 'beehive', name: 'Ruche', category: 'Stables', rle: 'b2o$o2bo$b2o!',
    description: 'Stable : aucune cellule ne naît ni ne meurt.' },
  { id: 'boat', name: 'Bateau', category: 'Stables', rle: '2o$obo$bo!',
    description: 'Stable, en forme de petit bateau.' },
  { id: 'loaf', name: 'Pain', category: 'Stables', rle: 'b2o$o2bo$bobo$2bo!',
    description: 'Stable, en forme de miche de pain.' },

  // ── Oscillateurs : elles reviennent à leur forme après quelques générations ──
  { id: 'blinker', name: 'Clignotant', category: 'Oscillateurs', rle: '3o!',
    description: 'Horizontal, vertical, horizontal… Période 2.' },
  { id: 'toad', name: 'Crapaud', category: 'Oscillateurs', rle: 'b3o$3o!',
    description: 'Respire entre deux formes. Période 2.' },
  { id: 'beacon', name: 'Phare', category: 'Oscillateurs', rle: '2o2b$2o2b$2b2o$2b2o!',
    description: 'Deux blocs dont les coins clignotent. Période 2.' },
  { id: 'pulsar', name: 'Pulsar', category: 'Oscillateurs',
    rle: '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!',
    description: 'Grand oscillateur symétrique. Période 3.' },
  { id: 'pentadecathlon', name: 'Pentadécathlon', category: 'Oscillateurs',
    rle: '2bo4bo2b$2ob4ob2o$2bo4bo!',
    description: 'Revient à sa forme toutes les 15 générations.' },

  // ── Vaisseaux : ils se déplacent ─────────────────────────────────────────
  { id: 'glider', name: 'Planeur', category: 'Vaisseaux', rle: 'bo$2bo$3o!',
    description: 'Avance en diagonale : 1 case toutes les 4 générations.' },
  { id: 'lwss', name: 'Vaisseau léger', category: 'Vaisseaux', rle: 'bo2bo$o4b$o3bo$4o!',
    description: 'Avance à l’horizontale : 2 cases toutes les 4 générations.' },

  // ── Canons : ils fabriquent des vaisseaux à l'infini ─────────────────────
  { id: 'gosper-gun', name: 'Canon à planeurs', category: 'Canons',
    rle: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',
    description: 'Le canon de Gosper (1970) : un planeur toutes les 30 générations.' },

  // ── Mathusalems : petits départs, très longue agitation ──────────────────
  { id: 'r-pentomino', name: 'R-pentomino', category: 'Mathusalems', rle: 'b2o$2ob$bo!',
    description: '5 cellules qui s’agitent pendant 1103 générations !' },
  { id: 'diehard', name: 'Diehard', category: 'Mathusalems', rle: '6bob$2o6b$bo3b3o!',
    description: 'Disparaît entièrement après 130 générations.' },
  { id: 'acorn', name: 'Gland', category: 'Mathusalems', rle: 'bo5b$3bo3b$2o2b3o!',
    description: '7 cellules qui explosent pendant 5206 générations.' },
];

/** Les structures célèbres, prêtes à l'emploi. */
export const BUILTIN_PATTERNS: readonly PatternEntry[] = BUILTIN_DEFINITIONS.map((definition) => ({
  id: definition.id,
  name: definition.name,
  category: definition.category,
  description: definition.description,
  pattern: parseRle(definition.rle).pattern,
}));

/** Retrouve une structure célèbre par son identifiant (ex. "glider"). */
export function builtinPattern(id: string): Pattern {
  const entry = BUILTIN_PATTERNS.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Structure inconnue : ${id}`);
  return entry.pattern;
}

/**
 * La bibliothèque complète : structures célèbres + structures de l'utilisateur.
 * Observable : le panneau de droite se met à jour quand on en ajoute une.
 */
export class PatternLibrary extends Emitter<{ change: void }> {
  private readonly custom: PatternEntry[] = [];

  /** Toutes les structures, structures de l'utilisateur en premier. */
  entries(): readonly PatternEntry[] {
    return [...this.custom, ...BUILTIN_PATTERNS];
  }

  /** Ajoute une structure créée par l'utilisateur (depuis une sélection ou un fichier). */
  addCustom(pattern: Pattern, name?: string): PatternEntry {
    const number = this.custom.length + 1;
    const entry: PatternEntry = {
      id: `custom-${number}`,
      name: name ?? `Ma structure ${number}`,
      category: 'Mes structures',
      description: `${pattern.cells.length} cellules, ${pattern.width} × ${pattern.height} cases.`,
      pattern,
    };
    this.custom.unshift(entry);
    this.emit('change', undefined);
    return entry;
  }
}

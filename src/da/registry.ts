/**
 * ============================================================================
 *  registry.ts — Trouver les DA du projet et choisir celle qu'on utilise
 * ============================================================================
 *
 * Vite (l'outil qui fabrique le site) sait lister les fichiers d'un dossier AU MOMENT DE
 * LA FABRICATION (`import.meta.glob`) : on récupère ainsi tous les `src/da/<nom>/da.json`
 * et toutes les images / polices de leurs dossiers `assets/`, sans les écrire à la main.
 * Ajouter un dossier de DA suffit : il est trouvé tout seul.
 *
 * Choix de la DA : `?da=nom` dans l'adresse (pour essayer), sinon `ACTIVE_DA` (active.ts).
 * Un nom inconnu est ignoré (on garde la DA active).
 */

import pixelFallback from './pixel/da.json';
import { ACTIVE_DA } from './active';
import { BLANK_DESIGN, parseDesign, type DesignPack } from './schema';

/** Tous les da.json, par chemin (`./nova/da.json`). */
const DESIGN_FILES = import.meta.glob<unknown>('./*/da.json', { eager: true, import: 'default' });
/** Toutes les images et polices, par chemin (`./nova/assets/etoile.png` → adresse utilisable dans la page). */
const ASSET_URLS = import.meta.glob<string>('./*/assets/**/*', { eager: true, query: '?url', import: 'default' });

/** La DA de secours : tout ce qu'un da.json oublie est pris ici (c'est la DA « pixel », complète). */
export const FALLBACK_DESIGN: DesignPack = parseDesign(pixelFallback, BLANK_DESIGN).pack;

export interface LoadedDesign {
  /** Nom du dossier (ex. "nova"). */
  readonly id: string;
  readonly pack: DesignPack;
  /** Corrections faites en lisant da.json (à afficher dans la console). */
  readonly warnings: readonly string[];
  /** Transforme un chemin du da.json (« assets/etoile.png ») en adresse utilisable dans la page. */
  readonly url: (relativePath: string) => string | undefined;
}

/** Noms des DA disponibles (les dossiers de src/da/). */
export function availableDesigns(): string[] {
  return Object.keys(DESIGN_FILES).map((file) => file.split('/')[1]!);
}

/** Charge une DA par son nom (ou null si elle n'existe pas). */
export function loadDesign(id: string): LoadedDesign | null {
  const raw = DESIGN_FILES[`./${id}/da.json`];
  if (raw === undefined) return null;
  const { pack, warnings } = parseDesign(raw, FALLBACK_DESIGN);
  return {
    id,
    pack,
    warnings,
    url: (relativePath) => ASSET_URLS[`./${id}/${relativePath.replace(/^\.\//, '')}`],
  };
}

/** La DA à utiliser : `?da=nom` si elle existe, sinon `ACTIVE_DA`, sinon la DA de secours. */
export function chooseDesign(): LoadedDesign {
  let wanted: string | null = null;
  try {
    wanted = new URLSearchParams(window.location.search).get('da');
  } catch {
    // Pas d'adresse lisible (cas rare) : on ignore.
  }
  return (wanted ? loadDesign(wanted) : null) ?? loadDesign(ACTIVE_DA) ?? loadDesign('pixel')!;
}

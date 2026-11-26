/**
 * ============================================================================
 *  persistence.ts — Reprendre là où on s'était arrêté (rafraîchir la page sans tout perdre)
 * ============================================================================
 *
 * Ce fichier garde dans le navigateur (localStorage, PAS dans les cookies : un cookie est renvoyé au
 * serveur à chaque requête et limité à 4 Ko) :
 *   - la grille (cellules vivantes, génération), la vue et la vitesse ;
 *   - « Mes structures ».
 * Au chargement de la page, on les remet. La grille revient TOUJOURS EN PAUSE : jamais de lecture
 * automatique. Le format du texte et sa vérification sont dans core/session.ts.
 *
 * ─── Quand sauvegarde-t-on ? ────────────────────────────────────────────────────────────────────
 * Pas à chaque génération (ce serait énorme à 60 images par seconde) :
 *   - un petit délai après un changement (0,6 s à l'arrêt, 3 s pendant la lecture) ;
 *   - tout de suite quand la page se cache ou se ferme (`visibilitychange`, `pagehide`) :
 *     c'est le moment sûr, même sur téléphone où `beforeunload` n'est pas fiable.
 *
 * ─── Et si la grille sauvegardée fait planter la page ? ─────────────────────────────────────────
 * Le piège d'une reprise automatique : une grille qui plante, rechargée à chaque ouverture,
 * planterait EN BOUCLE. Protection : avant de remettre la grille on écrit un drapeau
 * « restauration en cours » ; on l'efface quand les deux premières images ont été dessinées. Si la
 * page se ferme AVANT (plantage, mémoire pleine), le drapeau est encore là à l'ouverture suivante :
 * on abandonne la grille (on garde « Mes structures ») et on repart d'une grille vide.
 *
 * Tout accès au stockage est entouré de try / catch : il peut être refusé (navigation privée, iframe)
 * ou plein ; dans ce cas on ne retient simplement rien.
 */

import type { App } from '../app';
import { parseRle } from '../core/rle';
import {
  encodeRuns,
  parseSession,
  saveStructure,
  serializeSession,
  snapshotFromRuns,
  SESSION_VERSION,
  type SavedSession,
} from '../core/session';
import { MAX_ZOOM, MIN_ZOOM } from '../render/camera';

const SESSION_KEY = 'jeu-de-la-vie:session:v1';
const RESTORING_KEY = 'jeu-de-la-vie:session:restauration';

/** Délais (ms) avant de sauvegarder après un changement. */
const SAVE_DELAY_IDLE = 600;
const SAVE_DELAY_RUNNING = 3000;

/** Lit une clé du stockage (null si absente ou si le stockage est refusé). */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Écrit (ou efface, avec null) une clé. Renvoie faux si le navigateur refuse (stockage plein ou interdit). */
function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function setupPersistence(app: App): void {
  const { world, simulation, camera, library } = app;

  /** L'état actuel sous forme de session. */
  const currentSession = (): SavedSession => ({
    version: SESSION_VERSION,
    generation: world.generation,
    runs: encodeRuns(world),
    structures: library.customEntries().map((entry) => saveStructure(entry.name, entry.pattern)),
    camera: { x: camera.centerX, y: camera.centerY, zoom: camera.zoom },
    speed: simulation.speed,
  });

  // ── 1. Remettre ce qui avait été gardé ───────────────────────────────────
  const stale = readStorage(RESTORING_KEY) === '1';
  const saved = parseSession(readStorage(SESSION_KEY));
  if (saved) {
    // Les structures d'abord : elles sont petites et sûres. La plus ancienne est ajoutée en premier
    // (addCustom met la nouvelle en tête de liste : l'ordre d'origine est ainsi retrouvé).
    for (const item of [...saved.structures].reverse()) {
      try {
        library.addCustom(parseRle(item.rle).pattern, item.name);
      } catch {
        // Une structure illisible est ignorée : les autres sont remises.
      }
    }
    if (stale) {
      app.notify('La dernière grille n’a pas pu s’ouvrir : on repart d’une grille vide (tes structures sont gardées)');
      writeStorage(SESSION_KEY, null);
      writeStorage(RESTORING_KEY, null); // c'est réglé : le drapeau est effacé (sinon on abandonnerait aussi la prochaine fois)
    } else if (saved.runs.length > 0) {
      writeStorage(RESTORING_KEY, '1'); // « restauration en cours » (effacé après les deux premières images)
      simulation.restoreEdit(snapshotFromRuns(saved.runs, saved.generation)); // met en pause
      simulation.speed = saved.speed;
      camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, saved.camera.zoom));
      camera.centerX = saved.camera.x;
      camera.centerY = saved.camera.y;
      app.invalidate();
      app.notify('Ta dernière grille a été retrouvée (en pause)');
      requestAnimationFrame(() => requestAnimationFrame(() => writeStorage(RESTORING_KEY, null)));
    }
  } else if (stale) {
    writeStorage(RESTORING_KEY, null); // plus rien à restaurer : on nettoie le drapeau
  }

  // ── 2. Sauvegarder ───────────────────────────────────────────────────────
  let timer: number | null = null;
  let warnedTooBig = false;

  /** Écrit la session dans le stockage (tout de suite). */
  const save = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    const session = currentSession();
    if (session.runs.length === 0 && session.structures.length === 0) {
      writeStorage(SESSION_KEY, null); // rien à garder : on ne laisse pas de vieille grille
      return;
    }
    let text = serializeSession(session);
    if (text === null) {
      // Grille trop grande pour être gardée : on garde « Mes structures » et la vue, sans la grille.
      if (!warnedTooBig) {
        warnedTooBig = true;
        app.notify('Cette grille est trop grande pour être gardée au rechargement');
      }
      text = serializeSession({ ...session, runs: [] });
    }
    if (text !== null) writeStorage(SESSION_KEY, text);
  };

  /** Programme une sauvegarde (une seule à la fois : les changements rapprochés sont regroupés). */
  const schedule = () => {
    if (timer !== null) return;
    const delay = simulation.playState === 'paused' ? SAVE_DELAY_IDLE : SAVE_DELAY_RUNNING;
    timer = window.setTimeout(save, delay);
  };

  simulation.on('change', schedule);
  camera.on('change', schedule);
  library.on('change', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);
}

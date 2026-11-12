/**
 * ============================================================================
 *  actions.ts — Les actions de l'utilisateur, partagées par boutons ET clavier
 * ============================================================================
 *
 * Chaque action est une fonction : le bouton « Copier » et le raccourci Ctrl+C
 * appellent la même. Un seul endroit à corriger si le comportement doit changer.
 */

import type { App } from '../app';
import { looksLikeRle, parseRle, toRle } from '../core/rle';

/** Texte RLE de la dernière copie : permet de reconnaître un « coller » de notre propre copie. */
let lastCopiedRle = '';

export function copySelection(app: App): void {
  const pattern = app.editor.copySelection();
  if (!pattern) {
    app.notify('La sélection est vide');
    return;
  }
  writeToSystemClipboard(toRle(pattern));
  app.notify('Copié ! Ctrl+V pour coller');
}

export function cutSelection(app: App): void {
  const pattern = app.editor.cutSelection();
  if (!pattern) {
    app.notify('La sélection est vide');
    return;
  }
  writeToSystemClipboard(toRle(pattern));
  app.notify('Coupé ! Ctrl+V pour coller');
}

export function deleteSelection(app: App): void {
  if (!app.editor.selection) return;
  app.editor.deleteSelection();
  app.notify('Sélection supprimée');
}

export function saveSelection(app: App): void {
  if (app.editor.saveSelectionAsStructure()) {
    app.notify('Ajoutée dans « Mes structures »');
  } else {
    app.notify('La sélection est vide');
  }
}

/**
 * Coller : si le texte collé est du RLE venu d'ailleurs (ex. copié sur LifeWiki),
 * on le lit ; sinon on reprend notre dernière copie (qui garde les images).
 */
export function pasteText(app: App, text: string): void {
  if (text && looksLikeRle(text) && text !== lastCopiedRle) {
    try {
      const parsed = parseRle(text);
      app.editor.startStamp(parsed.pattern);
      warnIfOtherRule(app, parsed.rule);
      app.notify(`Structure collée${parsed.name ? ` : ${parsed.name}` : ''} — clique pour la poser`);
    } catch (error) {
      app.notify((error as Error).message);
    }
    return;
  }
  if (!app.editor.pasteClipboard()) app.notify('Rien à coller : copie d’abord une sélection');
}

/**
 * Importe des fichiers : les images rejoignent la bibliothèque d'images, les
 * fichiers .rle / .txt sont lus comme des structures. Si on connaît l'endroit du
 * dépôt (glisser-déposer sur la grille), la structure y est posée directement.
 */
export async function importFiles(
  app: App,
  files: Iterable<File>,
  dropPoint?: { x: number; y: number },
): Promise<void> {
  let imported = 0;
  let lastImageId = 0;
  for (const file of files) {
    try {
      if (file.type.startsWith('image/')) {
        lastImageId = (await app.images.addFile(file)).id;
        imported++;
      } else if (/\.(rle|txt)$/i.test(file.name) || file.type.startsWith('text/')) {
        const parsed = parseRle(await file.text());
        if (dropPoint) {
          const cell = app.camera.screenToCell(dropPoint.x, dropPoint.y);
          app.editor.placePatternAt(parsed.pattern, cell.x, cell.y);
          app.notify(`« ${parsed.name ?? file.name} » posée`);
        } else {
          app.editor.startStamp(parsed.pattern);
        }
        warnIfOtherRule(app, parsed.rule);
      } else {
        app.notify(`Format non reconnu : ${file.name}`);
      }
    } catch {
      app.notify(`Impossible de lire « ${file.name} »`);
    }
  }
  if (lastImageId !== 0) {
    app.images.current = lastImageId; // la dernière image importée devient l'image du pinceau
    app.notify(imported > 1 ? `${imported} images importées` : 'Image importée : le pinceau l’utilise');
  }
}

function warnIfOtherRule(app: App, rule: string | undefined): void {
  if (rule && rule.replace(/\s/g, '').toUpperCase() !== 'B3/S23') {
    app.notify(`Attention : cette structure est prévue pour la règle ${rule}`);
  }
}

/** Écrit dans le presse-papiers du système (peut être refusé : ce n'est pas grave). */
function writeToSystemClipboard(text: string): void {
  lastCopiedRle = text;
  navigator.clipboard?.writeText(text).catch(() => {
    // Refusé (iframe, navigateur ancien…) : le copier-coller interne fonctionne quand même.
  });
}

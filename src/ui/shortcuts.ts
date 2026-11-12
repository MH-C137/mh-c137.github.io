/**
 * ============================================================================
 *  shortcuts.ts — Raccourcis clavier, coller (Ctrl+V), dépôt de fichiers
 * ============================================================================
 *
 *   Espace        lecture / pause              S  sélection     D  main (déplacer)
 *   →  /  ←       une génération avant/arrière  P  pinceau       G  gomme
 *   Maj + → / ←   lecture avant / arrière      R  tourner la structure en main
 *   + / − / 0     zoomer / dézoomer / recentrer F  retourner la structure en main
 *   M             afficher / masquer le menu   N  mode nuit / jour
 *   Ctrl+C / X / V  copier / couper / coller   Suppr  supprimer la sélection
 *   Échap         annuler (sélection, structure en main)
 */

import type { App } from '../app';
import { copySelection, cutSelection, deleteSelection, importFiles, pasteText } from './actions';
import { isTyping, measureUiInsets } from './dom';

export function setupShortcuts(app: App, menu: { toggleMenu: () => void }): void {
  const { editor, simulation, camera } = app;

  window.addEventListener('keydown', (event) => {
    if (isTyping(event.target) || event.altKey) return;
    const target = event.target as HTMLElement;
    // Espace / Entrée sur un bouton qui a le focus (navigation au clavier) : on laisse le bouton agir.
    if ((event.key === ' ' || event.key === 'Enter') && target.closest?.('button')) return;
    // Flèches sur un curseur (slider) qui a le focus : on laisse le curseur bouger.
    if (event.key.startsWith('Arrow') && target instanceof HTMLInputElement) return;

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === 'c' && editor.selection) {
        event.preventDefault();
        copySelection(app);
      } else if (key === 'x' && editor.selection) {
        event.preventDefault();
        cutSelection(app);
      }
      return; // Ctrl+V est géré par l'événement « paste » ci-dessous
    }

    // « 0 » : on regarde la TOUCHE physique (event.code), car sur un clavier AZERTY
    // la touche 0 du haut donne « à » sans Majuscule.
    if (event.code === 'Digit0' || event.code === 'Numpad0') {
      event.preventDefault();
      editor.centerView(measureUiInsets());
      return;
    }

    let handled = true;
    switch (event.key) {
      case ' ':
        simulation.togglePlay();
        break;
      case 'ArrowRight':
        if (event.shiftKey) simulation.play('forward');
        else simulation.stepOnceForward();
        break;
      case 'ArrowLeft':
        if (event.shiftKey) simulation.play('backward');
        else simulation.stepOnceBackward();
        break;
      case 'Escape':
        editor.cancel();
        break;
      case 'Delete':
      case 'Backspace':
        deleteSelection(app);
        break;
      case '+':
      case '=':
        camera.setZoom(camera.zoom * 1.5);
        break;
      case '-':
        camera.setZoom(camera.zoom / 1.5);
        break;
      default:
        handled = handleLetter(app, event.key.toLowerCase(), menu);
    }
    if (handled) event.preventDefault();
  });

  // Coller : le navigateur nous donne le texte du presse-papiers.
  document.addEventListener('paste', (event) => {
    if (isTyping(event.target)) return;
    event.preventDefault();
    pasteText(app, event.clipboardData?.getData('text/plain') ?? '');
  });

  setupFileDrop(app);
}

/** Raccourcis « une lettre ». @returns vrai si la touche a été utilisée. */
function handleLetter(app: App, key: string, menu: { toggleMenu: () => void }): boolean {
  switch (key) {
    case 's': app.editor.setTool('select'); return true;
    case 'd': app.editor.setTool('hand'); return true;
    case 'p': app.editor.setTool('brush'); return true;
    case 'g': app.editor.setTool('eraser'); return true;
    case 'r': app.editor.rotateHeld(); return true;
    case 'f': app.editor.flipHeld(); return true;
    case 'm': menu.toggleMenu(); return true;
    case 'n': app.theme.toggle(); return true;
    default: return false;
  }
}

/**
 * Déposer des fichiers depuis l'ordinateur n'importe où sur la page :
 * images → bibliothèque d'images ; fichiers .rle / .txt → structure posée à l'endroit du dépôt.
 */
function setupFileDrop(app: App): void {
  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault(); // indispensable pour autoriser le dépôt
    document.body.classList.add('is-file-over');
  });
  window.addEventListener('dragleave', (event) => {
    if (event.relatedTarget === null) document.body.classList.remove('is-file-over');
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    document.body.classList.remove('is-file-over');
    const files = [...(event.dataTransfer?.files ?? [])];
    void importFiles(app, files, { x: event.clientX, y: event.clientY });
  });
}

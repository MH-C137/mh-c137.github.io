/**
 * ============================================================================
 *  actionbars.ts — Barres contextuelles : sélection et tampon, + messages
 * ============================================================================
 *
 * Ces barres n'apparaissent que lorsqu'elles servent :
 *   - une sélection existe       → « Copier · Couper · Supprimer · Garder »
 *   - une structure est en main  → « Tourner · Retourner · Terminé »
 */

import type { App } from '../app';
import { copySelection, cutSelection, deleteSelection, saveSelection } from './actions';
import { byId } from './dom';

export function setupActionBars(app: App): void {
  const selectionBar = byId('selection-bar');
  const stampBar = byId('stamp-bar');

  selectionBar.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest('button')?.dataset.action;
    if (action === 'copy') copySelection(app);
    else if (action === 'cut') cutSelection(app);
    else if (action === 'delete') deleteSelection(app);
    else if (action === 'save') saveSelection(app);
    else if (action === 'close') app.editor.setSelection(null);
  });

  stampBar.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest('button')?.dataset.action;
    if (action === 'rotate') app.editor.rotateHeld();
    else if (action === 'flip') app.editor.flipHeld();
    else if (action === 'done') app.editor.stopStamp();
  });

  app.editor.on('selection', (rect) => {
    selectionBar.hidden = rect === null;
  });
  app.editor.on('tool', (tool) => {
    stampBar.hidden = tool !== 'stamp';
  });
}

/**
 * Petit message temporaire juste au-dessus de la barre du bas (« Copié ! »…).
 * `role="status"` dans le HTML : les lecteurs d'écran l'annoncent aussi.
 * @param dock la barre du bas : le message se place au-dessus, quelle que soit sa hauteur.
 */
export function createNotifier(element: HTMLElement, dock: HTMLElement): (message: string) => void {
  let timer = 0;
  return (message: string) => {
    element.textContent = message;
    element.style.bottom = `${window.innerHeight - dock.getBoundingClientRect().top + 12}px`;
    element.classList.add('is-visible');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => element.classList.remove('is-visible'), 2400);
  };
}

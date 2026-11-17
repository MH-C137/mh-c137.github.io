/**
 * ============================================================================
 *  options.ts — Le menu déroulant « Options » (bouton à trois barres, en haut à gauche)
 * ============================================================================
 *
 * Contenu pour l'instant :
 *   - « Grille » : affiche ou masque les lignes de la grille ;
 *   - « Aide » (?) : relance le didacticiel.
 *
 * Le menu se ferme quand on clique ailleurs, avec Échap, ou quand on masque
 * l'interface avec l'œil. Comme partout, le bouton « Grille » APPELLE
 * viewSettings.toggleGrid() puis se met à jour en ÉCOUTANT l'événement « change ».
 */

import type { App } from '../app';
import { byId } from './dom';
import type { Tutorial } from './tutorial';

export function setupOptions(app: App, tutorial: Tutorial): void {
  const button = byId<HTMLButtonElement>('menu-toggle');
  const menu = byId('options-menu');
  const gridItem = byId<HTMLButtonElement>('opt-grid');
  const gridState = byId('opt-grid-state');
  const helpItem = byId<HTMLButtonElement>('opt-help');

  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => setOpen(menu.hidden === true));
  gridItem.addEventListener('click', () => app.viewSettings.toggleGrid());
  helpItem.addEventListener('click', () => {
    setOpen(false);
    tutorial.start();
  });

  // Clic ailleurs ou Échap : on ferme.
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !(event.target as Element).closest('#options-menu, #menu-toggle')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  // Interface masquée (œil ou touche M) : le menu se ferme aussi.
  new MutationObserver(() => {
    if (byId('ui').classList.contains('is-hidden')) setOpen(false);
  }).observe(byId('ui'), { attributes: true, attributeFilter: ['class'] });

  const renderGrid = () => {
    const visible = app.viewSettings.gridVisible;
    gridItem.setAttribute('aria-checked', String(visible));
    gridState.textContent = visible ? 'activée' : 'désactivée';
  };
  app.viewSettings.on('change', renderGrid);
  renderGrid();
}

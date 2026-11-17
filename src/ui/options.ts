/**
 * ============================================================================
 *  options.ts — Le menu déroulant « Options » (bouton à trois barres, en haut à gauche)
 * ============================================================================
 *
 * Contenu pour l'instant :
 *   - « Grille » : affiche ou masque les lignes de la grille ;
 *   - « Aide » (?) : relance le didacticiel ;
 *   - « Options avancées » : affiche en plus le choix des couleurs des cellules ici,
 *     et ailleurs Annuler / Rétablir, les types de trait et l'image des cellules mortes.
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
  const advancedItem = byId<HTMLButtonElement>('opt-advanced');
  const advancedState = byId('opt-advanced-state');
  const colors = byId('opt-colors');

  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => setOpen(menu.hidden === true));
  gridItem.addEventListener('click', () => app.viewSettings.toggleGrid());
  advancedItem.addEventListener('click', () => app.viewSettings.toggleAdvanced());
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

  // Options avancées : texte de l'interrupteur, et affichage des sélecteurs de couleur.
  const renderAdvanced = () => {
    const visible = app.viewSettings.advancedVisible;
    advancedItem.setAttribute('aria-checked', String(visible));
    advancedState.textContent = visible ? 'affichées' : 'masquées';
    colors.hidden = !visible;
  };
  app.viewSettings.on('change', renderAdvanced);
  renderAdvanced();

  // Couleurs des cellules (options avancées) : deux sélecteurs de couleur + « Remettre ».
  const newbornPicker = byId<HTMLInputElement>('color-newborn');
  const alivePicker = byId<HTMLInputElement>('color-alive');
  const resetColors = byId<HTMLButtonElement>('color-reset');
  newbornPicker.addEventListener('input', () => app.theme.setColor('newborn', newbornPicker.value));
  alivePicker.addEventListener('input', () => app.theme.setColor('alive', alivePicker.value));
  resetColors.addEventListener('click', () => app.theme.resetColors());
  const renderColors = () => {
    // Les sélecteurs montrent les couleurs réellement utilisées (thème + choix).
    newbornPicker.value = app.theme.palette.newborn;
    alivePicker.value = app.theme.palette.alive;
    resetColors.disabled = !app.theme.hasCustomColors;
  };
  app.theme.on('change', renderColors);
  renderColors();
}

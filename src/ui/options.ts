/**
 * ============================================================================
 *  options.ts — Le menu déroulant « Options » (bouton à trois barres, en haut à gauche)
 * ============================================================================
 *
 * Contenu pour l'instant :
 *   - « Grille » : affiche ou masque les lignes de la grille ;
 *   - « Aide » (?) : relance le didacticiel ;
 *   - « Retour » : seulement si le jeu est intégré à un site plus grand, qui ajoute dans la page une balise
 *     <meta name="retour-url" content="/" data-label="Retour à AlgoGo"> (adresse et texte du lien) ;
 *   - « Options avancées » : affiche en plus « Config DA » (voir daconfig.ts) ici, et ailleurs
 *     Annuler / Rétablir, les types de trait et les images.
 *
 * Le menu se ferme quand on clique ailleurs, avec Échap, ou quand on masque
 * l'interface avec l'œil. Comme partout, le bouton « Grille » APPELLE
 * viewSettings.toggleGrid() puis se met à jour en ÉCOUTANT l'événement « change ».
 */

import type { App } from '../app';
import { byId } from './dom';
import type { DaConfig } from './daconfig';
import type { Tutorial } from './tutorial';

export function setupOptions(app: App, tutorial: Tutorial, daConfig: DaConfig | null): void {
  const button = byId<HTMLButtonElement>('menu-toggle');
  const menu = byId('options-menu');
  const gridItem = byId<HTMLButtonElement>('opt-grid');
  const gridState = byId('opt-grid-state');
  const helpItem = byId<HTMLButtonElement>('opt-help');
  // « Config DA » : absent de la version AlgoGo (le panneau et son bouton ne sont pas livrés : null).
  const daItem = daConfig ? byId<HTMLButtonElement>('opt-da') : null;
  const advancedItem = byId<HTMLButtonElement>('opt-advanced');
  const advancedState = byId('opt-advanced-state');

  // Lien de retour : affiché seulement si le site qui héberge le jeu l'a demandé avec la balise <meta name="retour-url">.
  const backMeta = document.querySelector<HTMLMetaElement>('meta[name="retour-url"]');
  if (backMeta?.content) {
    const back = byId<HTMLAnchorElement>('opt-back');
    back.href = backMeta.content;
    byId('opt-back-label').textContent = backMeta.dataset.label ?? 'Retour au site';
    back.hidden = false;
  }

  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => setOpen(menu.hidden === true));
  gridItem.addEventListener('click', () => app.viewSettings.toggleGrid());
  advancedItem.addEventListener('click', () => app.viewSettings.toggleAdvanced());
  daItem?.addEventListener('click', () => {
    setOpen(false);
    daConfig?.toggle();
  });
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

  // Options avancées : texte de l'interrupteur, et affichage du bouton « Config DA ».
  const renderAdvanced = () => {
    const visible = app.viewSettings.advancedVisible;
    advancedItem.setAttribute('aria-checked', String(visible));
    advancedState.textContent = visible ? 'affichées' : 'masquées';
    if (daItem) daItem.hidden = !visible;
  };
  app.viewSettings.on('change', renderAdvanced);
  renderAdvanced();
}

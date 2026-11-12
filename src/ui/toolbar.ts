/**
 * ============================================================================
 *  toolbar.ts — Barre d'outils, bouton « menu » et bouton jour / nuit
 * ============================================================================
 *
 * Principe commun à toute l'interface : les boutons APPELLENT des méthodes
 * (setTool, toggle…), puis l'interface se met à jour en ÉCOUTANT les
 * événements (patron Observateur). On ne met jamais l'affichage à jour « à la
 * main » dans le clic : ainsi le bouton reste juste même si l'outil change
 * depuis le clavier.
 */

import type { App } from '../app';
import type { ToolId } from '../input/tools';
import { byId } from './dom';

export function setupToolbar(app: App): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-tool]')];
  for (const button of buttons) {
    button.addEventListener('click', () => app.editor.setTool(button.dataset.tool as ToolId));
  }
  const render = (tool: ToolId) => {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    }
  };
  app.editor.on('tool', render);
  render(app.editor.tool.id);
}

/** Bouton « afficher / masquer le menu » et bouton jour / nuit. Renvoie de quoi basculer le menu au clavier. */
export function setupMenu(app: App): { toggleMenu: () => void } {
  const ui = byId('ui');
  const menuButton = byId<HTMLButtonElement>('menu-toggle');
  const themeButton = byId<HTMLButtonElement>('theme-toggle');

  const setMenuVisible = (visible: boolean) => {
    ui.classList.toggle('is-hidden', !visible);
    ui.inert = !visible; // les panneaux cachés ne reçoivent plus le clavier
    const label = visible ? 'Masquer le menu (M)' : 'Afficher le menu (M)';
    menuButton.setAttribute('aria-pressed', String(visible));
    menuButton.setAttribute('aria-label', label);
    menuButton.title = label;
  };
  const toggleMenu = () => setMenuVisible(ui.classList.contains('is-hidden'));
  menuButton.addEventListener('click', toggleMenu);

  themeButton.addEventListener('click', () => app.theme.toggle());
  const renderTheme = () => {
    const label = app.theme.name === 'night' ? 'Passer en mode jour (N)' : 'Passer en mode nuit (N)';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  };
  app.theme.on('change', renderTheme);
  renderTheme();

  setMenuVisible(true);
  return { toggleMenu };
}

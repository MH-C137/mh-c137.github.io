/**
 * ============================================================================
 *  dom.ts — Petits utilitaires pour manipuler la page HTML
 * ============================================================================
 */

import type { Insets } from '../render/camera';

/** Récupère un élément par son id, avec une erreur claire s'il n'existe pas. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément #${id} introuvable dans index.html`);
  return element as T;
}

/** Crée un élément HTML avec des attributs et des enfants, en une ligne. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

/**
 * Après un clic à la souris, on retire le focus du bouton : sinon la barre
 * d'espace « recliquerait » ce bouton au lieu de mettre en pause.
 */
export function releaseFocusAfterClick(root: HTMLElement): void {
  root.addEventListener('pointerup', (event) => {
    const target = event.target as HTMLElement;
    const focusable = target.closest('button, input[type="range"]') as HTMLElement | null;
    if (focusable) requestAnimationFrame(() => focusable.blur());
  });
}

/**
 * Mesure la place prise par les panneaux sur chaque bord de l'écran, pour que
 * « recentrer » cadre les cellules dans la zone vraiment visible.
 */
export function measureUiInsets(): Insets {
  const ui = document.getElementById('ui');
  if (!ui || ui.classList.contains('is-hidden')) return { left: 40, right: 40, top: 70, bottom: 40 };
  const box = (id: string) => document.getElementById(id)?.getBoundingClientRect();
  const toolbar = box('toolbar');
  const library = box('library');
  const titleBar = box('title-bar');
  const dock = box('dock');
  return {
    left: (toolbar?.right ?? 0) + 24,
    right: (library ? window.innerWidth - library.left : 0) + 24,
    top: (titleBar?.bottom ?? 0) + 24,
    bottom: (dock ? window.innerHeight - dock.top : 0) + 24,
  };
}

/** Vrai si l'utilisateur est en train d'écrire dans un champ (on ignore alors les raccourcis). */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && target.type !== 'range';
}

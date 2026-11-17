/**
 * ============================================================================
 *  tooltips.ts — Les infobulles discrètes des boutons
 * ============================================================================
 *
 * Quand la souris reste un instant sur un bouton (ou quand on y arrive au
 * clavier), une petite bulle dit ce que fait le bouton : « Crayon : fait naître
 * des cellules (P) ».
 *
 * Comment ça marche : UN seul écouteur pour toute la page (« délégation
 * d'événements »). Au survol, on remonte depuis l'élément touché jusqu'au
 * premier parent qui a un attribut `title`. On range alors son texte dans
 * `data-tip` et on retire `title` : sinon le navigateur afficherait SA propre
 * infobulle par-dessus la nôtre. Les boutons nouveaux (structures, images…)
 * marchent donc sans rien ajouter, même ceux créés plus tard par le programme.
 *
 * Pas d'infobulle au doigt (pas de « survol » sur un écran tactile).
 */

import { byId } from './dom';
import { placePopup, type Side } from './placement';

/** Attente avant d'afficher la bulle, pour ne pas clignoter quand la souris traverse l'écran. */
const SHOW_DELAY_MS = 350;

/** Où poser la bulle selon la zone de l'écran où se trouve le bouton. */
function preferredSides(element: HTMLElement): Side[] {
  if (element.closest('.toolbar')) return ['right', 'left'];
  if (element.closest('.dock')) return ['top', 'bottom'];
  if (element.closest('.library')) return ['left', 'top', 'bottom'];
  if (element.closest('.options-menu')) return ['right', 'bottom'];
  return ['bottom', 'top'];
}

export function setupTooltips(): void {
  const tip = byId('tooltip');
  let current: HTMLElement | null = null;
  /** Bouton cliqué : pas de bulle tant que la souris ne l'a pas quitté. */
  let muted: HTMLElement | null = null;
  let timer = 0;

  /** Lit le texte de l'infobulle, en déplaçant `title` vers `data-tip` (voir l'en-tête du fichier). */
  const textOf = (element: HTMLElement): string => {
    const title = element.getAttribute('title');
    if (title) {
      element.dataset.tip = title;
      element.removeAttribute('title');
    }
    return element.dataset.tip ?? '';
  };

  const hide = () => {
    window.clearTimeout(timer);
    tip.hidden = true;
  };

  const show = (element: HTMLElement) => {
    const text = textOf(element);
    if (!text || !element.isConnected) return;
    tip.textContent = text;
    tip.hidden = false;
    const target = element.getBoundingClientRect();
    const place = placePopup(
      target,
      { width: tip.offsetWidth, height: tip.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      preferredSides(element),
      8,
    );
    tip.style.left = `${Math.round(place.x)}px`;
    tip.style.top = `${Math.round(place.y)}px`;
  };

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const element = (event.target as Element).closest<HTMLElement>('[title], [data-tip]');
    if (element === current) return;
    hide();
    current = element;
    if (!element) {
      muted = null;
      return;
    }
    textOf(element); // retire tout de suite `title` : pas de double infobulle
    if (element !== muted) timer = window.setTimeout(() => show(element), SHOW_DELAY_MS);
  });

  // Un clic, une molette ou Échap font disparaître la bulle.
  document.addEventListener('pointerdown', () => {
    muted = current;
    hide();
  });
  document.addEventListener('wheel', hide, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  // Au clavier : la bulle apparaît tout de suite sur le bouton qui a le focus.
  document.addEventListener('focusin', (event) => {
    const element = (event.target as Element).closest<HTMLElement>('[title], [data-tip]');
    if (!element || !(event.target as Element).matches(':focus-visible')) return;
    current = element;
    show(element);
  });
  document.addEventListener('focusout', hide);
}

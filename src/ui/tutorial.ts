/**
 * ============================================================================
 *  tutorial.ts — Le didacticiel : un parcours en bulles à la première visite
 * ============================================================================
 *
 * Une bulle à la fois, posée à côté de l'élément expliqué (qui est entouré
 * d'un cadre en pointillés). On avance avec « Suivant », on recule avec
 * « Précédent », on peut tout fermer (×, Échap ou « Passer le didacticiel »).
 * Le compteur « 2/6 » est dans le coin de la bulle.
 *
 * Les étapes (textes, éléments visés) sont dans data/tour.ts.
 *
 * Première visite : le didacticiel s'ouvre tout seul, puis le navigateur
 * retient (localStorage) qu'il a été vu. Le menu Options → « Aide » (ou la
 * touche ?) le relance quand on veut.
 *
 * Clavier pendant le didacticiel : → suivant, ← précédent, Échap ferme. On
 * écoute en phase de « capture » pour passer AVANT les raccourcis du jeu
 * (qui utilisent aussi les flèches pour avancer d'une génération).
 */

import type { App } from '../app';
import { TOUR_STEPS, type TourStep } from '../data/tour';
import { byId, el } from './dom';
import { placePopup } from './placement';

const STORAGE_KEY = 'jeu-de-la-vie:didacticiel-vu';
/** Marge autour de l'élément entouré, en pixels. */
const SPOT_PADDING = 6;

export interface Tutorial {
  /** Ouvre le didacticiel à la première étape. */
  start(): void;
  /** Vrai pendant que le didacticiel est ouvert. */
  readonly isOpen: boolean;
}

export function setupTutorial(_app: App, menu: { showMenu: () => void }): Tutorial {
  const tour = byId('tour');
  const spot = byId('tour-spot');
  const stepLabel = byId('tour-step');
  const title = byId('tour-title');
  const text = byId('tour-text');
  const previous = byId<HTMLButtonElement>('tour-prev');
  const next = byId<HTMLButtonElement>('tour-next');
  const skip = byId<HTMLButtonElement>('tour-skip');
  const close = byId<HTMLButtonElement>('tour-close');

  /** Numéro de l'étape affichée (0 = la première), ou -1 si le didacticiel est fermé. */
  let index = -1;

  /** Affiche l'étape `index` : textes, compteur, boutons, puis position de la bulle. */
  const render = () => {
    const step = TOUR_STEPS[index]!;
    const last = index === TOUR_STEPS.length - 1;
    stepLabel.textContent = `${index + 1}/${TOUR_STEPS.length}`;
    title.textContent = step.title;
    text.replaceChildren(...renderStep(step));
    previous.disabled = index === 0;
    next.textContent = last ? 'Terminer' : 'Suivant';
    skip.hidden = last;
    position();
    next.focus({ preventScroll: true });
  };

  /**
   * Place la bulle : à côté de l'élément visé (voir placePopup), ou au centre
   * de l'écran quand l'étape ne vise rien (ou que l'élément est invisible).
   */
  const position = () => {
    if (index < 0) return;
    const step = TOUR_STEPS[index]!;
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const box = target?.getBoundingClientRect();
    const size = { width: tour.offsetWidth, height: tour.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    if (box && box.width > 0 && box.height > 0) {
      spot.hidden = false;
      spot.style.left = `${box.x - SPOT_PADDING}px`;
      spot.style.top = `${box.y - SPOT_PADDING}px`;
      spot.style.width = `${box.width + 2 * SPOT_PADDING}px`;
      spot.style.height = `${box.height + 2 * SPOT_PADDING}px`;
      const place = placePopup(box, size, viewport, step.sides, 16 + SPOT_PADDING);
      tour.style.left = `${Math.round(place.x)}px`;
      tour.style.top = `${Math.round(place.y)}px`;
    } else {
      spot.hidden = true;
      tour.style.left = `${Math.round((viewport.width - size.width) / 2)}px`;
      tour.style.top = `${Math.round((viewport.height - size.height) / 2)}px`;
    }
  };

  /** Clavier pendant le didacticiel (voir l'en-tête du fichier). */
  const onKey = (event: KeyboardEvent) => {
    const action =
      event.key === 'Escape' ? finish : event.key === 'ArrowRight' ? goNext : event.key === 'ArrowLeft' ? goPrevious : null;
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    action();
  };

  const goNext = () => {
    if (index >= TOUR_STEPS.length - 1) finish();
    else {
      index++;
      render();
    }
  };

  const goPrevious = () => {
    if (index > 0) {
      index--;
      render();
    }
  };

  /** Ferme le didacticiel (fin, croix, « passer » ou Échap) et retient qu'il a été vu. */
  const finish = () => {
    if (index < 0) return;
    index = -1;
    tour.hidden = true;
    spot.hidden = true;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', position);
    (document.activeElement as HTMLElement | null)?.blur();
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Stockage indisponible (navigation privée, iframe…) : il se rouvrira à la prochaine visite.
    }
  };

  const start = () => {
    menu.showMenu(); // les éléments expliqués doivent être visibles
    index = 0;
    tour.hidden = false;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', position);
    render();
  };

  next.addEventListener('click', goNext);
  previous.addEventListener('click', goPrevious);
  skip.addEventListener('click', finish);
  close.addEventListener('click', finish);

  // Première visite : on ouvre tout seul, après que la page a fini de se mettre en place.
  let seen = false;
  try {
    seen = localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Stockage indisponible : on considère que c'est une première visite.
  }
  if (!seen) window.setTimeout(start, 500);

  return {
    start,
    get isOpen() {
      return index >= 0;
    },
  };
}

/**
 * Construit le contenu d'une étape : phrase d'introduction, LISTE (une ligne
 * par idée, avec un carré de couleur ou un mot en avant), puis conclusion.
 * Les carrés réutilisent les classes `.swatch-*` de la légende : mêmes couleurs.
 */
function renderStep(step: TourStep): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  if (step.intro) blocks.push(el('p', {}, [step.intro]));
  if (step.items) {
    const lines = step.items.map((item) => {
      const marker = item.swatch
        ? el('span', { class: `swatch swatch-${item.swatch}`, 'aria-hidden': 'true' })
        : el('span', { class: 'tour-bullet', 'aria-hidden': 'true' });
      const words: Array<Node | string> = item.label ? [el('b', {}, [item.label]), ' ', item.text] : [item.text];
      return el('li', {}, [marker, el('span', {}, words)]);
    });
    blocks.push(el('ul', { class: 'tour-list' }, lines));
  }
  if (step.outro) blocks.push(el('p', {}, [step.outro]));
  return blocks;
}

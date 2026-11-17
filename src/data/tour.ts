/**
 * ============================================================================
 *  tour.ts — Les étapes du didacticiel (le « parcours » de la première visite)
 * ============================================================================
 *
 * Chaque étape pointe vers un élément de la page (sélecteur CSS) et dit ce
 * qu'il fait. Pour ajouter ou changer une étape, il suffit de modifier cette
 * liste : le compteur « 3/6 » et les boutons Précédent / Suivant s'adaptent seuls.
 *
 * Présentation : une phrase d'introduction, puis une LISTE (une idée par ligne,
 * avec un petit carré de couleur ou un mot en couleur devant), puis éventuellement
 * une conclusion. Courtes phrases, mots simples, tutoiement (public : collégiens).
 */

import type { Side } from '../ui/placement';

/** Les 4 états d'une cellule : sert à dessiner le carré de couleur devant la ligne. */
export type TourSwatch = 'newborn' | 'alive' | 'trace' | 'dead';

/** Une ligne de liste : soit un carré de couleur, soit un mot en avant (`label`), puis le texte. */
export interface TourItem {
  readonly text: string;
  readonly label?: string;
  readonly swatch?: TourSwatch;
}

export interface TourStep {
  /** Titre court de l'étape. */
  readonly title: string;
  /** Phrase d'introduction (au-dessus de la liste). */
  readonly intro?: string;
  /** La liste : une idée par ligne. */
  readonly items?: readonly TourItem[];
  /** Phrase de conclusion (sous la liste). */
  readonly outro?: string;
  /** Sélecteur CSS de l'élément mis en avant (null = bulle centrée, sans élément). */
  readonly target: string | null;
  /** Côtés préférés pour poser la bulle autour de l'élément. */
  readonly sides?: readonly Side[];
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'Bienvenue !',
    intro: 'Ici, tu dessines des cellules et tu regardes ce qu\'elles deviennent. Il n\'y a que 3 règles :',
    items: [
      { text: 'Une cellule qui a 2 ou 3 voisines survit.' },
      { text: 'Une case vide qui a exactement 3 voisines : une cellule naît.' },
      { text: 'Sinon, la cellule meurt.' },
    ],
    target: null,
  },
  {
    title: 'Les couleurs',
    intro: 'La couleur d\'une cellule dit où elle en est :',
    items: [
      { swatch: 'newborn', text: 'Elle vient de naître : elle s\'allume.' },
      { swatch: 'alive', text: 'Elle vit depuis longtemps.' },
      { swatch: 'trace', text: 'Elle vient de mourir : elle s\'éteint.' },
      { swatch: 'dead', text: 'Case vide : rien n\'y vit.' },
    ],
    outro: 'Une cellule qui survit clignote toutes les 3 générations.',
    target: '#title-bar',
    sides: ['bottom', 'right'],
  },
  {
    title: 'Dessiner',
    items: [
      { label: 'Crayon', text: 'fait naître des cellules.' },
      { label: 'Gomme', text: 'les efface. Survole-la pour régler sa taille.' },
      { label: 'Main', text: 'déplace la vue.' },
      { label: 'Sélection', text: 'entoure une zone à copier.' },
      { label: 'Molette', text: 'zoome.' },
    ],
    target: '#toolbar',
    sides: ['right', 'bottom'],
  },
  {
    title: 'Faire vivre',
    items: [
      { label: 'Lecture', text: 'lance la vie.' },
      { label: '+1', text: 'avance d\'une génération.' },
      { label: '−1', text: 'recule : tu remontes le temps !' },
      { label: 'Vitesse', text: 'règle la rapidité.' },
    ],
    target: '.transport',
    sides: ['top', 'right'],
  },
  {
    title: 'Structures et images',
    intro: 'Des formes toutes prêtes à poser :',
    items: [
      { label: 'Glisse', text: 'une structure sur la grille.' },
      { label: 'Touche R', text: 'pour la tourner.' },
      { label: 'Images', text: 'importe les tiennes à la place des cellules.' },
    ],
    target: '#library',
    sides: ['left', 'bottom'],
  },
  {
    title: 'Options et aide',
    items: [
      { label: 'Trois barres', text: 'ouvrent les options : grille, aide, options avancées.' },
      { label: 'Œil', text: 'cache toute l\'interface.' },
    ],
    outro: 'Bon jeu !',
    target: '#menu-toggle',
    sides: ['bottom', 'right'],
  },
];

/**
 * ============================================================================
 *  tour.ts — Les étapes du didacticiel (le « parcours » de la première visite)
 * ============================================================================
 *
 * Chaque étape pointe vers un élément de la page (sélecteur CSS) et dit ce
 * qu'il fait. Pour ajouter ou changer une étape, il suffit de modifier cette
 * liste : le compteur « 3/6 » et les boutons Précédent / Suivant s'adaptent seuls.
 * Les textes sont courts et parlent aux collégiens (tutoiement, mots simples).
 */

import type { Side } from '../ui/placement';

export interface TourStep {
  /** Titre court de l'étape. */
  readonly title: string;
  /** Paragraphes de texte. */
  readonly text: readonly string[];
  /** Sélecteur CSS de l'élément mis en avant (null = bulle centrée, sans élément). */
  readonly target: string | null;
  /** Côtés préférés pour poser la bulle autour de l'élément. */
  readonly sides?: readonly Side[];
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'Bienvenue !',
    text: [
      'Ici, tu dessines des cellules et tu regardes ce qu\'elles deviennent.',
      'Trois règles seulement : une cellule qui a 2 ou 3 voisines survit. Une case vide qui a exactement 3 voisines voit naître une cellule. Dans tous les autres cas, la cellule meurt.',
    ],
    target: null,
  },
  {
    title: 'Les couleurs',
    text: [
      'Cyan : la cellule vient de naître. Violet : elle est vivante (elle clignote en violet clair toutes les 3 générations). Violet foncé : elle vient de mourir.',
    ],
    target: '#title-bar',
    sides: ['bottom', 'right'],
  },
  {
    title: 'Dessiner',
    text: [
      'Le crayon fait naître des cellules, la gomme les efface. Survole la gomme pour régler sa taille.',
      'Molette pour zoomer, outil Main pour déplacer la vue.',
    ],
    target: '#toolbar',
    sides: ['right', 'bottom'],
  },
  {
    title: 'Faire vivre',
    text: [
      'Lecture lance la vie. +1 avance d\'une génération, −1 recule : tu peux même remonter le temps !',
      'Le curseur Vitesse règle le nombre de générations par seconde.',
    ],
    target: '.transport',
    sides: ['top', 'right'],
  },
  {
    title: 'Structures et images',
    text: [
      'Glisse une structure sur la grille (ou clique dessus, puis clique sur la grille). Touche R pour la tourner.',
      'Tu peux aussi importer tes images : elles remplacent les cellules.',
    ],
    target: '#library',
    sides: ['left', 'bottom'],
  },
  {
    title: 'Options et aide',
    text: [
      'Le bouton à trois barres ouvre les options : afficher la grille, revoir ce didacticiel. L\'œil, en haut à droite, cache toute l\'interface.',
      'Bon jeu !',
    ],
    target: '#menu-toggle',
    sides: ['bottom', 'right'],
  },
];

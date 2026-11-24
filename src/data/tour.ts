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
export type TourSwatch = 'newborn' | 'alive' | 'trace' | 'fade' | 'dead';

/** Une ligne de liste : soit un carré de couleur, soit un mot en avant (`label`), puis le texte. */
export interface TourItem {
  readonly text: string;
  readonly label?: string;
  readonly swatch?: TourSwatch;
  /** Ligne affichée seulement si la DA active a ce réglage (`fade` : le reflet des cellules mortes). */
  readonly only?: 'fade';
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
  /**
   * Sélecteur CSS de l'élément mis en avant (null = bulle centrée, sans élément).
   * Une liste de sélecteurs entoure plusieurs éléments d'un seul cadre.
   */
  readonly target: string | readonly string[] | null;
  /** Fait défiler un panneau jusqu'en haut ou en bas avant d'afficher l'étape (ex. la bibliothèque jusqu'aux images). */
  readonly scroll?: { readonly container: string; readonly to: 'top' | 'bottom' };
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
      { swatch: 'fade', text: 'Morte depuis un moment : il ne reste que son contour.', only: 'fade' },
      { swatch: 'dead', text: 'Case vide : rien n\'y vit.' },
    ],
    outro: 'Une cellule qui survit clignote toutes les 3 générations.',
    target: '#title-bar',
    sides: ['bottom', 'right'],
  },
  {
    title: 'Dessiner',
    items: [
      { label: 'Crayon', text: 'fait naître des cellules. Survole-le pour choisir son épaisseur.' },
      { label: 'Gomme', text: 'les efface. Survole-la pour régler sa taille.' },
      { label: 'Main', text: 'déplace la vue.' },
      { label: 'Sélection', text: 'entoure une zone à copier.' },
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
    title: 'Structures',
    intro: 'Des formes toutes prêtes à poser :',
    items: [
      { label: 'Glisse', text: 'une structure sur la grille.' },
      { label: 'Touche R', text: 'pour la tourner.' },
    ],
    target: '#library',
    sides: ['left', 'bottom'],
    scroll: { container: '.library-body', to: 'top' },
  },
  {
    title: 'Options et aide',
    items: [
      { label: 'Trois barres', text: 'ouvrent les options : grille, aide, options avancées.' },
      { label: 'Options avancées', text: 'ajoutent Annuler / Rétablir, des types de trait, des couleurs…' },
    ],
    target: '#menu-toggle',
    sides: ['bottom', 'right'],
  },
  {
    title: 'Images',
    intro: 'Remplace les cellules par tes propres images :',
    items: [
      { label: 'Importer', text: 'des images depuis ton ordinateur (ou dépose-les sur la page).' },
      { label: 'Clique', text: 'une image pour l\'utiliser avec le crayon et les structures.' },
    ],
    target: ['.images-title', '#image-add'],
    sides: ['left', 'bottom'],
    scroll: { container: '.library-body', to: 'bottom' },
  },
  {
    title: 'Jour, nuit et interface',
    items: [
      { label: 'Soleil / lune', text: 'passe du mode jour au mode nuit.' },
      { label: 'Œil', text: 'cache toute l\'interface pour voir la grille en grand.' },
    ],
    target: ['#theme-toggle', '#eye-toggle'],
    sides: ['bottom', 'left'],
  },
  {
    title: 'Explore les différentes possibilités',
    intro: 'Le jeu de la vie, je vous le laisse si vous voulez... Essayez toutes les possibilités, dessinez vos structures, suivez leur évolution et sauvegardez-les.',
    outro: 'Le plus important, amusez-vous !',
    target: null,
  },
];

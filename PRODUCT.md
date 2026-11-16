# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Des collégiens (et leurs professeurs) qui découvrent le jeu de la vie de Conway : ils dessinent des cellules, lancent la simulation, reculent dans le temps, posent des structures connues. Utilisation en classe, sur ordinateur et tablette. Source : CLAUDE.md du projet.

## Product Purpose
Un jeu de la vie interactif, clair et agréable, qui se présente et s'explique à l'oral dans un cadre scolaire et académique. Réussite : un collégien comprend les règles en jouant, sans notice.

## Positioning
Monde quasi infini, lecture arrière, images à la place des cellules, structures prêtes à poser. Le moteur (`src/core/`) est réutilisable pour un futur « labo génétique » (simulations Python, résultats affichés sur le site).

## Capabilities and Constraints
- Interface en français, au tutoiement, mots concrets (« Effacer », « Tourner »), pas de jargon.
- Site statique sans framework ni dépendance ajoutée sans demande (TypeScript + Vite). Doit marcher dans un sous-dossier ou une iframe (`base: './'`) et en fichier unique (`build:single`).
- Les 4 états de cellule ont un sens fixe : née, vivante, vient de mourir, morte. Une cellule vivante clignote toutes les 3 générations.
- Couleurs : uniquement dans `src/render/theme.ts` (canvas) et les variables CSS de `styles.css`.

## Brand Commitments
Palette néon : cyan (née) et violet (vivante) sur fond noir, plus un mode jour. Direction visuelle choisie par le propriétaire : **arcade pixel**, aucun rectangle arrondi (les rectangles arrondis « sentent l'IA »).

## Product Principles
- Lisible par un collégien avant d'être joli.
- Tout est expliquable à l'oral : le code et l'interface restent simples.
- La grille est la star ; l'interface se fait petite et discrète (ex. le réglage de la gomme n'apparaît qu'au survol).

## Accessibility & Inclusion
Boutons avec `aria-label` et `title` (raccourci inclus), focus clavier visible, contraste suffisant dans les deux thèmes.

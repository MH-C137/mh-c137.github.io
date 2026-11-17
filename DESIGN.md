# Design — Arcade pixel

Décrit l'interface livrée (voir `src/styles.css`, `src/render/theme.ts`, `index.html`).

## Monde
Console d'arcade sobre. Aucun arrondi nulle part (interface, cellules, images, miniatures). Pas de flou, pas de lueur, pas de dégradé de décoration. Un seul rythme : le « gros pixel » (`--px`, 3 px).

## Couleurs (jour / nuit, variables CSS)
- Cellules (source unique `render/theme.ts`) : née cyan `#3cf2ff` / `#008ca6`, vivante violet `#a45cff` / `#6a2bd4`, clignotement `#dcc2ff` / `#3a0f8f`, trace `#2d1b4e` / `#dccdf2`.
- Interface : `--surface`, `--surface-2`, `--line`, `--line-soft`, `--accent`, `--accent-fill` (fond d'un bouton actif) et `--on-accent`, `--danger`, `--drop` (ombre dure).

## Typographie
Pixelify Sans (400 et 700), embarquée dans `src/assets/fonts/` (licence OFL). Minuscules normales : pas de capitales espacées. Titre 24 px, titres de panneau 18 px, texte 16 px, aide 14 px. Chiffres à chasse fixe.

## Cadres et boutons
- Cadre = contour épais aux coins en escalier, fait de 4 ombres pleines (`--notch-line`, `--notch-soft`, `--notch-accent`) + ombre dure décalée (`--drop-shadow`).
- Bouton actif : fond plein d'accent. Bouton pressé : descend de 2 px.
- Focus clavier : contour plein de 3 px, coins carrés.

## Icônes
Pixel art sur une grille de 12 × 12 (SVG de rectangles, `shape-rendering: crispEdges`), affichées à 24 px (échelle 2×).

## Aides
- **Infobulle** : petite, une seule ligne, apparaît après 0,35 s de survol (ou au focus clavier), texte pris dans `title`. Jamais au doigt.
- **Didacticiel** : bulle à cadre d'accent, compteur `n/6` en haut à gauche, croix en haut à droite, élément expliqué entouré de pointillés. Non bloquant.
- **Boutons du haut** : Options (gauche) ; jour / nuit puis œil (droite). L'œil reste visible quand l'interface est masquée.
- **Grille** : lignes visibles dès 5 px par case ; désactivable dans Options.

## Mouvement
Rare et par paliers (`steps()`), jamais de fondu doux. Le réglage de taille de la gomme apparaît au survol de l'icône.

# Les algorithmes du projet, expliqués

Ce document explique **chaque idée algorithmique** du programme, dans l'ordre où elles interviennent. Chaque section indique le fichier où se trouve le code, et chaque fonction du code est elle-même commentée.

---

## 1. Les règles du jeu (notation B/S) — `src/core/rules.ts`

Le jeu de la vie se joue sur une grille de cases, vivantes ou mortes. À chaque **génération**, toutes les cases changent **en même temps**, selon le nombre de leurs 8 voisines vivantes (Moore : haut, bas, gauche, droite et diagonales) :

- une case **morte** avec exactement **3** voisines vivantes **naît** ;
- une case **vivante** avec **2 ou 3** voisines vivantes **survit** ;
- toutes les autres cases meurent (isolement ou surpopulation) ou restent mortes.

On l'écrit `B3/S23` (*Birth* 3, *Survival* 2 et 3). Le programme lit cette notation et la range dans deux tableaux de 9 booléens (`birth[0..8]` et `survival[0..8]`). Appliquer la règle revient alors à lire une case de tableau, en temps constant **O(1)**. D'autres « univers » s'obtiennent en changeant les chiffres : HighLife `B36/S23`, Seeds `B2/S`, etc.

C'est le **patron Stratégie** : le moteur reçoit un objet `Rule` interchangeable au lieu d'avoir les chiffres écrits en dur.

> La règle `B0` est refusée : elle ferait naître simultanément **toutes** les cases vides d'un monde infini.

---

## 2. Un monde quasi infini : la représentation creuse — `src/core/coords.ts`, `src/core/world.ts`

### Le problème

Un tableau 2D classique a une taille fixe. Avec 67 millions × 67 millions de cases, il faudrait des millions de milliards d'octets. Mais un tel monde est presque **entièrement vide**.

### L'idée

On ne stocke **que les cellules vivantes**, dans une table de hachage (`Map`). On parle de représentation **creuse**. La mémoire et le temps de calcul dépendent du nombre de cellules vivantes, pas de la taille du monde.

### La clé d'une case

Pour ranger une case dans la `Map`, on transforme le couple (x, y) en **un seul nombre** :

```
clé = (x + 2^25) × 2^26 + (y + 2^25)
```

- Ajouter 2^25 rend x et y positifs (les coordonnées peuvent être négatives).
- Multiplier par 2^26 (le nombre de valeurs possibles de y) sépare les colonnes, comme lorsqu'on numérote les cases d'un tableau.
- Pour décoder : `x = ⌊clé / 2^26⌋ − 2^25` et `y = (clé mod 2^26) − 2^25`.

**Pourquoi c'est exact.** La plus grande clé vaut environ 2^52. Or les nombres JavaScript (flottants double précision, norme IEEE 754) représentent exactement tous les entiers jusqu'à 2^53. Il n'y a donc aucune erreur d'arrondi.

**Astuce clé.** La voisine (x + dx, y + dy) a pour clé `clé + dx × 2^26 + dy`. Les 8 voisines s'obtiennent par **8 additions**, sans rien décoder. Les 8 décalages sont calculés une fois pour toutes (`NEIGHBOR_DELTAS`).

**Le bord du monde.** On garde une case de marge sur chaque bord, et aucune naissance n'est permise hors du monde. Un planeur avance d'une case toutes les 4 générations : il lui faudrait plus de 100 millions de générations pour atteindre le bord.

---

## 3. Calculer la génération suivante — `World.step()` dans `src/core/world.ts`

### Observation

Seule une case **vivante**, ou **voisine d'une vivante**, peut changer d'état. Une case vide entourée de vide reste vide. On n'examine donc qu'environ 9 × P cases, où P est la population.

### Algorithme en 3 passes

```
PASSE 1 — compter les voisines
  compteurs ← table vide
  pour chaque cellule vivante c :
      compteurs[c] ← compteurs[c] OU 1            (bit 0 = « je suis vivante »)
      pour chacune des 8 voisines v de c :
          compteurs[v] ← compteurs[v] + 2         (+1 voisine, compté ×2)

PASSE 2 — appliquer la règle
  pour chaque case k de compteurs :
      vivante  ← compteurs[k] ET 1                (bit de poids faible)
      voisines ← compteurs[k] ≫ 1                 (division entière par 2)
      si vivante et survival[voisines] : elle survit, âge + 1
      si morte   et birth[voisines]    : elle naît, âge = 0

PASSE 3 — la trace
  toute cellule vivante avant et absente après « vient de mourir »
```

### Deux informations dans un seul nombre

Chaque compteur vaut `2 × (nombre de voisines) + (1 si la case est vivante)`. Le bit de poids faible dit si la case est vivante, le reste donne le nombre de voisines. Une seule table suffit, et elle contient exactement les cases à examiner, y compris une cellule vivante isolée (grâce à son bit 0).

### Le double tampon

La nouvelle génération est construite dans de **nouvelles** tables, sans modifier l'ancienne pendant le calcul. Sinon, une case déjà mise à jour fausserait le compte de ses voisines, alors que toutes les cases doivent changer « en même temps ». C'est ce que faisaient les Commandes différées dans une version orientée objet classique, mais en beaucoup plus rapide.

### Complexité

**O(P)** en temps et en mémoire, avec P la population. C'est indépendant de la taille du monde. Mesure indicative : environ 20 ms par génération pour une soupe aléatoire de 30 000 cellules, historique compris.

---

## 4. Les 4 états affichés — `src/core/world.ts`, `src/render/renderer.ts`

Chaque cellule vivante a un **âge** : le nombre de générations où elle a survécu.

| État | Condition | Couleur (nuit) |
|---|---|---|
| Née | vivante, âge = 0 | cyan |
| Vivante | vivante, âge ≥ 1 | violet |
| Vient de mourir | vivante à la génération précédente, morte maintenant (liste « trace ») | violet sombre |
| Morte | tout le reste | fond noir |

Une cellule dessinée au pinceau a l'âge 0 : elle s'affiche comme une naissance. Une cellule effacée à la gomme ne laisse pas de trace, car la trace ne vient que de l'évolution.

---

## 5. Les images héritées (vote à la majorité) — `World.inheritedSkin()`

Chaque cellule porte un numéro d'image : 0 pour aucune image, sinon une image de la bibliothèque. Les règles de vie et de mort ne changent pas. Seule la **couleur** (l'image) se transmet :

- une cellule qui **survit** garde son image ;
- une cellule qui **naît** regarde ses voisines vivantes (ses « parents », 3 avec la règle classique) et prend l'image **la plus fréquente** ;
- en cas d'égalité (par exemple 3 parents tous différents), elle prend **le plus petit numéro**, avec 0 en priorité.

Cette dernière règle rend le calcul **déterministe** : le même passé donne toujours le même futur. C'est indispensable pour l'historique et pour les tests. C'est une variante connue du jeu de la vie, appelée « Immigration » avec 2 couleurs et « QuadLife » avec 4 : les images se propagent et se disputent le territoire.

---

## 6. Reculer dans le temps — `src/core/history.ts`, `src/simulation/simulation.ts`

### Pourquoi on ne peut pas « calculer » le passé

Le jeu de la vie est **irréversible** :

- plusieurs passés différents mènent au même présent (une cellule isolée et une case vide donnent toutes les deux une case vide) ;
- certaines configurations n'ont **aucun** passé possible : ce sont les **jardins d'Éden**.

Pour reculer, il faut donc **se souvenir** des générations passées.

### Deux piles

```
   passé (pile)                présent              futur (pile)
 [g0, g1, g2, g3]  ←── reculer ──  g4  ── avancer ──→  [g6, g5]
```

- **Avancer** : le présent est empilé dans « passé ». Si « futur » n'est pas vide, on dépile la génération suivante, déjà connue. Sinon, on la calcule.
- **Reculer** : le présent est empilé dans « futur », puis on dépile « passé ».
- **Modifier la grille** (pinceau, structure…) crée un nouvel avenir : on vide « futur ». C'est exactement le comportement de « Annuler / Rétablir » dans un traitement de texte.

### Photos compactes et mémoire bornée

Chaque génération mémorisée est une **photo** (`WorldSnapshot`) rangée dans des tableaux typés : `Float64Array` pour les clés, `Uint32Array` pour les âges, `Uint16Array` pour les images. Une photo coûte environ 14 octets par cellule. On limite le passé à 1 000 générations **et** à 2 millions de cellules au total ; au-delà, les plus anciennes photos sont oubliées.

---

## 7. Le temps : un accumulateur — `Simulation.update()`

L'écran se redessine environ 60 fois par seconde (`requestAnimationFrame`), mais la vitesse est choisie en générations par seconde. À chaque image :

```
réservoir ← réservoir + (temps écoulé en s) × vitesse
n ← partie entière du réservoir     → on calcule n générations
réservoir ← réservoir − n           → la partie décimale est gardée pour la suite
```

La vitesse réelle est ainsi exacte, que l'écran tourne à 30, 60 ou 144 images par seconde. Il y a un garde-fou : au plus 8 générations par image. Au-delà, on vide le réservoir pour ne pas accumuler de retard (onglet en arrière-plan, ordinateur lent).

---

## 8. La caméra : zoomer vers le curseur — `src/render/camera.ts`

La caméra est définie par le point du monde au centre de l'écran (cx, cy) et le **zoom** z (taille d'une case en pixels). Les conversions sont :

```
écranX = (mondeX − cx) × z + largeur/2        mondeX = (écranX − largeur/2) / z + cx
```

**Zoomer en gardant fixe le point sous le curseur (sx, sy).**

1. On note le point du monde P sous le curseur : `P = monde(sx)`.
2. On change le zoom : z → z'.
3. On veut que P soit encore sous le curseur : `(sx − largeur/2) / z' + cx' = P`. On en tire `cx' = P − (sx − largeur/2) / z'`.

Même raisonnement pour y. Le pincement à deux doigts utilise la même fonction, avec pour facteur le rapport des distances entre les doigts, et pour point fixe leur milieu.

**Curseurs logarithmiques.** Le zoom (de 0,25 à 96 px) et la vitesse (de 1 à 120 gén/s) varient par **multiplications**. Le curseur suit donc une échelle exponentielle `valeur = min × (max/min)^(position/100)`, dont la réciproque utilise un logarithme.

---

## 9. Le rendu — `src/render/renderer.ts`

- **Canvas plutôt que HTML.** Des dizaines de milliers d'éléments HTML qui changent 60 fois par seconde seraient trop lents. Le canvas est une surface de pixels sur laquelle on peint soi-même, comme `paintComponent` en Java Swing.
- **Élimination des cases invisibles (« culling »).** On ne dessine que les cellules dont la position tombe dans le rectangle visible.
- **Regroupement par couleur.** Toutes les cellules d'une même couleur sont ajoutées à un même chemin (`Path2D`), rempli en une seule fois. On fait ainsi un ordre de dessin par couleur au lieu d'un par cellule.
- **Niveaux de détail.**
  - Les formes arrondies et l'espacement n'apparaissent qu'à partir de 4 px par case.
  - Les images n'apparaissent qu'à partir de 10 px par case ; en dessous, on dessine leur couleur moyenne.
  - La grille apparaît progressivement avec le zoom, avec une ligne plus visible toutes les 10 cases.
- **Écrans haute densité.** Le canvas a `largeur × devicePixelRatio` pixels réels, et le repère de dessin est agrandi d'autant. On dessine en pixels CSS, et le résultat reste net.
- **Invalidation.** On ne redessine que si quelque chose a changé : simulation, caméra, outil, thème. Quand tout est immobile, le programme ne dessine plus et économise la batterie.
- **Images préparées une fois.** À l'import, chaque image est recadrée en carré, réduite en une petite tuile aux coins arrondis, et sa couleur moyenne est calculée. Pour cela, on réduit l'image à 1×1 pixel et le navigateur fait lui-même la moyenne.

---

## 10. Des traits continus : l'algorithme de Bresenham — `src/input/line.ts`

La souris ne signale sa position qu'environ 60 fois par seconde. Si on la déplace vite, elle saute des cases. On relie donc la case précédente à la case actuelle par une **ligne discrète** (Bresenham, 1962) :

- une variable `erreur` mesure l'écart entre la vraie droite et les cases choisies ;
- à chaque pas, selon cette erreur, on avance en x, en y, ou dans les deux (diagonale) ;
- l'algorithme n'utilise que des additions d'entiers, et chaque case touche la précédente.

Le test `view.test.ts` vérifie ces deux propriétés : les bonnes extrémités, et des cases toujours voisines.

---

## 11. Le format RLE — `src/core/rle.ts`

RLE (*Run Length Encoding*, codage par plages) est le format standard de la communauté (Golly, LifeWiki) :

```
x = 3, y = 3, rule = B3/S23        ← en-tête
bo$2bo$3o!                          ← b = morte, o = vivante, $ = fin de ligne, ! = fin
```

Un nombre devant un symbole le répète : `3o` = trois vivantes d'affilée, `2$` = fin de ligne plus une ligne vide.

- **Lecture.** Un automate parcourt le texte caractère par caractère. Il accumule les chiffres dans un compteur, puis applique le symbole qui suit (avancer, poser des cellules, changer de ligne).
- **Écriture.** Pour chaque ligne, on regroupe les cases identiques consécutives en plages, on supprime les cases mortes en fin de ligne, on regroupe les lignes vides, puis on coupe le texte à 70 caractères.

Un test vérifie que *écrire puis relire* redonne exactement chaque structure de la bibliothèque.

---

## 12. Transformations de structures — `src/core/pattern.ts`

Les coordonnées d'une structure sont relatives à son coin haut-gauche. À l'écran, l'axe y descend.

- **Rotation horaire** : `(x, y) → (hauteur − 1 − y, x)`, et la largeur et la hauteur s'échangent.
- **Miroir** : `(x, y) → (largeur − 1 − x, y)`.

Un test vérifie que 4 rotations, ou 2 miroirs, redonnent la structure d'origine.

---

## 13. Validation : des résultats connus

Le moteur est vérifié sur des comportements **documentés** (LifeWiki). Une erreur, même minime, dans l'algorithme changerait ces nombres.

| Structure | Résultat attendu | Vérifie |
|---|---|---|
| Bloc | identique après 5 générations | stabilité |
| Clignotant, pulsar, pentadécathlon | périodes 2, 3 et 15 | oscillations |
| Planeur | décalé de (+1, +1) en 4 générations | déplacement diagonal |
| Vaisseau léger | décalé de 2 cases en 4 générations | déplacement horizontal |
| Canon de Gosper | +5 cellules (un planeur) toutes les 30 générations | monde infini, collisions |
| R-pentomino | 116 cellules à la génération 1103 | 1 103 générations exactes |
| Diehard | population 0 exactement à la génération 130 | morts |
| Gland | 633 cellules à la génération 5206 | longue évolution |
| Historique | reculer 10 fois redonne exactement les 10 états | piles passé / futur |

---

## 14. Pistes pour aller plus loin

- **Web Worker** : déplacer `World` dans un fil d'exécution séparé, pour que les gros calculs ne figent jamais l'interface. Le moteur n'utilise aucune API du navigateur, donc le déplacement est direct.
- **Grille par blocs** : découper le monde en blocs de 64 × 64 cases stockés dans des tableaux typés, et ne calculer que les blocs actifs. C'est beaucoup plus rapide qu'une `Map` par cellule pour les mondes denses.
- **Bit-packing** : ranger 32 cases dans un entier de 32 bits et compter les voisines avec des opérations logiques. On calcule ainsi 32 cases à la fois.
- **HashLife** (Gosper, 1984) : un arbre de quadrants avec mémorisation des blocs déjà calculés. Il permet de sauter des milliards de générations d'un coup sur les structures régulières.
- **GPU** (WebGPU, ou PyTorch / JAX côté Python) : une génération est une convolution 3×3 suivie de la règle. Idéal pour simuler des milliers de grilles en parallèle, par exemple pour un algorithme génétique.

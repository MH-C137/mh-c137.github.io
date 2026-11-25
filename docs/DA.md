# Changer de direction artistique (DA)

Une **DA** est un dossier `src/da/<nom>/` qui contient **toute l'apparence** du site : couleurs, polices,
forme des cellules, quadrillage, fond, titre, style des cadres. Le code du jeu ne change jamais.

| DA | Style |
|---|---|
| `nova` | La DA de l'équipe artistique : palette bleu clair / jaune / bleu nuit / violet, cellules en étoiles, quadrillage à croix, fond d'étoiles, titre « Nova ». |
| `pixel` | La DA d'origine : arcade pixel, cyan et violet, coins carrés, police pixel. |

## Changer de DA (le plus important)

1. **Essayer sans rien modifier** : ajoute `?da=pixel` (ou `?da=nova`) à l'adresse du site.
   Exemple : `http://localhost:5173/?da=pixel`.
2. **Changer pour tout le monde** : ouvre `src/da/active.ts` et change **un seul mot** :
   ```ts
   export const ACTIVE_DA = 'nova';   // ou 'pixel', ou le nom d'une DA que tu as créée
   ```

## Créer une nouvelle DA

1. Copie un dossier existant : `src/da/nova/` → `src/da/ma-da/`.
2. Remplace les images de `src/da/ma-da/assets/` et modifie `src/da/ma-da/da.json`.
3. Mets `'ma-da'` dans `src/da/active.ts` (ou teste avec `?da=ma-da`).
4. Lance `npm test` : les tests vérifient que **toutes** les couleurs sont valides et que **toutes** les
   images et polices citées existent. Une faute dans `da.json` est expliquée dans la console du
   navigateur (F12) et le site reprend la valeur de la DA `pixel` pour ce champ : il ne casse jamais.

## Ce que contient `da.json`

| Bloc | Rôle |
|---|---|
| `palette` | Les couleurs de la DA, avec leur nom : `[{ "name": "Bleu nuit", "color": "#253165" }, …]`. Ce sont les seules couleurs proposées par l'outil Config DA. |
| `name`, `description`, `defaultTheme` | Nom, description, et thème montré à la première visite (`"day"` ou `"night"`). |
| `fonts` | Les polices à charger : `{ "family": "Nom", "file": "assets/fonts/x.woff2", "weight": "400" }`. |
| `ui` | `fontFamily` (police de l'interface), `textScale` (1 = tailles d'origine ; 0,68 pour une police plus grande), `frame` (`"notched"` = cadres en escalier + ombre dure, `"flat"` = simple contour), `borderWidth` (épaisseur des contours, en pixels). |
| `title` | `text` : le titre (affiché s'il n'y a pas d'image, lu par les lecteurs d'écran sinon, et nom de l'onglet). `imageHeight` : hauteur de l'image du titre. |
| `cells` | `icon` : image dont la **silhouette** sert de forme aux cellules (ex. une étoile) ; `null` = carrés. `scale` : taille dans la case. `iconMinZoom` : sous cette taille de case (px), on dessine des carrés. `traceStyle` : `"filled"` (la cellule qui vient de mourir est pleine) ou `"outline"` (seulement son **contour**, étoile vide). `outlineWidth` : épaisseur de ce contour (ex. 0,08). `pulseHalo` : `true` = la cellule qui clignote a un **halo**. |
| `grid` | `style` : `"lines"` (lignes) ou `"crosses"` (lignes fines + une croix épaisse à chaque croisement). |
| `background` | `style` : `"image"` (l'image du thème, fixe) ou `"constellation"` (un ciel d'étoiles généré par le site, **fixe dans le monde** et sans fin : voir plus bas). `opacity` : transparence (0 à 1). `density` : quantité d'étoiles de la constellation (1 = normal). |
| `themes.night` et `themes.day` | Pour chaque thème : `colors` (fond, grille, `newborn` née, `alive` vivante, `pulse` clignote, `trace` vient de mourir, `glass` la vitre, `stars` couleur des étoiles du fond, `tile` fond des pastilles et miniatures, sélection, gomme), `interface` (couleurs des boutons, panneaux, textes, et `titleBg` / `titleFg` / `titleLine` pour le bloc du titre), `titleImage` et `backgroundImage` (chemins d'images, ou `null`), et si besoin `gridStyle` / `backgroundStyle` (`"none"`, `"image"`, `"constellation"`) pour un style propre à ce thème. |

Les couleurs s'écrivent `#rrggbb` ou `rgba(r, g, b, a)`. Les chemins sont **relatifs au dossier de la DA**
(`assets/etoile.png`).

### La constellation et la vitre

Avec `"style": "constellation"`, le fond est un ciel d'étoiles **généré** (même forme que les cellules), **fixe dans le
monde** : il suit le zoom et le déplacement de la grille exactement comme elle, et il ne finit jamais. Pour qu'on ne
confonde jamais le fond avec la grille et les cellules, le site pose entre les deux une **vitre** : une teinte translucide
(`colors.glass`) qui estompe le fond. Pour une vitre plus claire ou plus opaque, change la dernière valeur de `glass`
(ex. `rgba(37, 49, 101, 0.62)` → `0.8`).

### Les couleurs des cellules

- `newborn` : la cellule vient de naître · `alive` : elle vit depuis longtemps · `pulse` : elle clignote
  (toutes les 3 générations) · `trace` : elle vient de mourir. Avec des étoiles, **la forme est toujours la même,
  seule la couleur change** : c'est pourquoi il suffit d'une seule image d'étoile.
- La DA Nova n'utilise que **deux couleurs** de cellules, pour rester claire. Nuit : **jaune** = vient de naître, **blanc** = vit (et clignote en blanc, avec un halo), **contour blanc** = vient de mourir, rien = morte. Jour (le jaune est réservé à la nuit) : **violet** = vient de naître, **bleu nuit** = vit (et clignote, avec un halo), **contour bleu nuit** = vient de mourir.

## L'outil « Config DA » : essayer sans toucher aux fichiers

Dans le site : **Options → Options avancées → Config DA**. Les onglets **Mode nuit / Mode jour** règlent chaque thème
séparément (et changent aussi le thème affiché, pour voir l'effet tout de suite).

**On choisit des rôles, pas des dizaines de couleurs.** Pour chaque rôle, une rangée de pastilles : les couleurs de la
**palette de la DA** (`palette` dans `da.json`), les seules proposées, puisqu'elles correspondent à de vraies couleurs de la
charte. Le site **déduit les nuances** qui en dépendent :

| Rôle | Ce qui est déduit |
|---|---|
| Fond de la page | fond de la grille, teinte de la vitre, couleur des lignes de la grille (la plus contrastée de la palette) |
| Panneaux et boutons | boutons (un peu plus clairs si le panneau est sombre, plus sombres s'il est clair), boutons survolés, bords doux, rouge d'alerte rendu lisible |
| Légende et titre | écriture de la légende (la couleur de la palette la plus lisible dessus) |
| Écriture | écriture discrète (fondue dans le panneau) |
| Détails | bouton actif, texte du bouton actif (le plus lisible), titres (éclaircis ou assombris jusqu'à être lisibles sur les panneaux), fond de l'image choisie, et les bords tant qu'on ne choisit pas de bords |
| Bords | bords des panneaux et du bloc de titre |
| Cellule qui vient de naître / vivante | la cellule vivante donne aussi sa couleur au clignotement et au contour de la trace |
| Étoiles du fond | couleur des étoiles de la constellation et de l'image de fond |
| **Fond des pastilles et miniatures** | **indépendant** : le fond derrière les étoiles de la légende et des miniatures de structures (couleur `tile`), sans lien avec le fond de la page |

On règle aussi le style du **quadrillage** (lignes ou croix), le **fond** (aucun, constellation, image) et l'**opacité de la
vitre**. Tout en bas, **« Réglages détaillés »** (replié) garde un sélecteur de couleur libre par élément pour les cas
particuliers. Choisir un rôle efface les réglages détaillés des couleurs qu'il déduit : le dernier choix l'emporte.

Les réglages sont retenus dans le navigateur (ils restent après un rechargement, et même si on coupe les options avancées :
« Remettre le mode nuit / jour » les efface). **Pour garder ce qui plaît :** « Copier la config » donne un bloc `themes`
au format de `da.json`, **couleurs déduites comprises** : envoie-le (ou recopie ses valeurs dans le `da.json` de la DA). Les
réglages ne modifient jamais les fichiers.

## Les images du « DOSSIER RESSOURCES » : lesquelles utiliser ?

Il y a 16 fichiers, mais **très peu de choses différentes** : c'est la même image exportée dans les
4 couleurs de la palette (bleu clair, jaune, bleu nuit, violet), plus une version **blanche**
(« transparent ») pour les fonds sombres.

| Famille | Fichiers | Qui sert à quoi |
|---|---|---|
| Titre « Nova » | `Titre 1 violet`, `titre 2 jaune`, `titre 3 bleu clair`, `titre 4 bleu nuit` | On choisit la couleur selon le **fond** : bleu nuit sur fond blanc (mode jour), jaune sur fond bleu nuit (mode nuit). |
| Fond d'étoiles | `background 1 transparent` (blanc), `2 bleu clair`, `3 violet`, `4 bleu nuit`, `5 jaune` | Idem : bleu clair sur blanc (jour), blanc sur bleu nuit (nuit). |
| Étoile | `icone 1` à `icone 5` | **Une seule suffit** pour les cellules : seule la silhouette compte, la couleur vient de l'état de la cellule. Les autres couleurs servent pour des affiches, etc. |
| Quadrillage | `Quadrillage` | Sert de **modèle** : le site dessine lui-même ce style (`"style": "crosses"`) à toutes les échelles, sans image. |
| Palette | `Palette de couleur` | Les 4 couleurs : `#548ebc` `#cbc737` `#253165` `#6f5ca4`. |

La DA `nova` utilise : le titre jaune (`titre 2 jaune`) la nuit et le titre bleu clair (`titre 3 bleu clair`) le jour, tous deux sur un bloc bleu nuit, et l'étoile blanche. Son fond d'étoiles est **généré** (constellation) ; l'image de fond (`fond.png`, la version blanche) peut aussi être choisie dans la Config DA : le site la **recolore** à la demande (une seule image donne un fond de toutes les couleurs, il n'y a donc pas besoin de fichiers par couleur).
Pour changer une couleur, il suffit de recopier un autre fichier et de changer son nom dans `da.json`.

### Préparer une image (rogner les marges)

Illustrator exporte tout le **plan de travail** : le dessin occupe parfois le tiers de l'image, le reste est
transparent. L'outil `tools/rogner_png.py` garde seulement le dessin (rien à installer, il faut juste Python) :

```bash
python3 tools/rogner_png.py "DOSSIER RESSOURCES/titre 4 bleu nuit.png" src/da/nova/assets/titre-jour.png
python3 tools/rogner_png.py "DOSSIER RESSOURCES/icone 4 etoile transparent.png" src/da/nova/assets/etoile.png
python3 tools/rogner_png.py "DOSSIER RESSOURCES/Palette de couleur.png" --couleur   # affiche la couleur dominante
```

Conseils pour les artistes : exporter en **PNG avec fond transparent**, le plus grand possible (au moins 2×
la taille d'affichage pour rester net sur écran Retina), et **vectoriser le texte** (« Vectoriser » / « Create
Outlines ») avant l'export.

## Polices Adobe (ZT Editorial 90 Trial, BBB Manifont Grotesk…)

On ne peut **pas** mettre ces polices dans le site : une version « Trial » n'a pas le droit d'être
publiée sur le web, et une police Adobe Fonts ne se charge que depuis le service d'Adobe (compte,
connexion, licence). **Bonne nouvelle : ce n'est pas nécessaire pour le titre.** Les lettres de « Nova » et
du sous-titre (avec les contours ajoutés pour les épaissir) sont déjà **dessinées dans l'image** du titre : le site
affiche l'image, pas une police. Pour le reste du texte de l'interface, la DA `nova` utilise **Space Grotesk**
(gratuite, licence OFL, dans `assets/fonts/`), une grotesque proche de l'esprit voulu. Si l'équipe achète une licence
**web** d'une police, on l'ajoute simplement dans `fonts` et `ui.fontFamily` de `da.json`.

## Limites actuelles

- Les **icônes des boutons** (crayon, gomme, œil…) sont en pixel art dans toutes les DA. Pour une autre
  famille d'icônes, il faut que l'artiste les dessine (SVG) : c'est une évolution à prévoir.
- Les **miniatures de structures** (panneau de droite) restent en carrés.
- Le **fond** est fixe à l'écran (il ne suit pas le déplacement de la grille).

## Comment ça marche (pour l'oral)

`registry.ts` trouve tous les `da.json` (Vite liste les dossiers à la fabrication) → `schema.ts` les
**vérifie** et complète ce qui manque avec la DA `pixel` → `runtime.ts` les **applique** : les couleurs de
l'interface deviennent des variables CSS sur `<body>` (`--surface`, `--accent`…), les couleurs des cellules vont
au rendu canvas, l'image de l'étoile devient une petite image par état (`render/sprites.ts`), le quadrillage à croix
est dessiné par `render/renderer.ts`.

# Jeu de la vie

Le jeu de la vie de John Conway (1970), interactif, dans le navigateur.

Le monde est quasi infini. On dessine des cellules au pinceau, on glisse des structures célèbres sur la grille, on peut avancer ou reculer dans le temps, et on peut même habiller les cellules avec des images.

Le projet est pensé pour être accessible à des collégiens, et son code est entièrement commenté (en français) pour être compris et présenté.

---

## Lancer le projet

**Prérequis** : [Node.js](https://nodejs.org) version 20 ou plus récente.

```bash
npm install        # une seule fois : installe les outils
npm run dev        # lance le site en local
```

Ouvre ensuite l'adresse affichée dans le terminal (en général http://localhost:5173). Le site se recharge tout seul à chaque modification du code.

| Commande | Rôle |
|---|---|
| `npm run dev` | Site en local, rechargement automatique |
| `npm test` | Lance les tests automatiques (moteur, format RLE, historique, caméra…) |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run build` | Construit la version en ligne dans `dist/` |
| `npm run build:single` | Construit **un seul fichier** autonome : `dist-single/index.html` |
| `npm run preview` | Affiche en local la version construite |

## Mettre en ligne / brancher sur le site des projets

Le site est **statique** : pas de serveur, pas de base de données. Plusieurs façons de le publier :

- **GitHub Pages (automatique)** : le fichier `.github/workflows/deploy.yml` construit le site et publie `dist/` à chaque push sur `main`. Réglage à faire une seule fois : *Settings → Pages → Build and deployment → Source : « GitHub Actions »*. Attention : publier directement la branche (« Deploy from a branch ») donne une page cassée, car le navigateur ne sait pas lire les fichiers `.ts` de `src/`.

- **Dossier `dist/`** : à déposer tel quel sur n'importe quel hébergement (GitHub Pages, Netlify, serveur de l'école…). Tous les chemins sont relatifs, donc ça marche aussi dans un sous-dossier, par exemple `ecole.fr/projets/jeu-de-la-vie/`.
- **Fichier unique `dist-single/index.html`** : tout est dedans (code, style, icônes). Pratique à envoyer par mail ou à déposer sur un portail.
- **Dans une iframe** : ça marche. Attention seulement : les futures sauvegardes dans le navigateur (localStorage, IndexedDB) seront cloisonnées par site dans une iframe d'un autre domaine. C'est pour ça que la sauvegarde principale prévue est l'export de fichiers.

## Crédits

Les structures énormes (`src/data/rle/*.rle`) viennent de la collection de motifs de **LifeWiki / conwaylife.com** (Breeder 1 : Bill Gosper ; Cordership à 10 moteurs : Dean Hickerson ; Spacefiller 1 : David Bell). Le nom des auteurs est dans les commentaires de chaque fichier. Polices **Jersey 10** (DA pixel) et **Space Grotesk** (DA Nova), licence OFL, dans les dossiers `assets/fonts/` des DA. Images de la DA Nova : équipe artistique (dossier `DOSSIER RESSOURCES/`).

## Style et DA (direction artistique)

Tout ce qui touche à l'apparence est regroupé dans une **DA** : un dossier `src/da/<nom>/` avec un fichier `da.json` (couleurs, polices, forme des cellules, quadrillage, fond, titre) et ses images. Le fond peut être une **constellation quasi infinie** posée derrière une « vitre » (la grille et les cellules restent nettes au premier plan), et les cellules peuvent être des étoiles avec contour. **Changer de DA = changer un mot** dans `src/da/active.ts` (`'nova'` : la DA de l'équipe artistique, étoiles et quadrillage à croix ; `'pixel'` : la DA d'origine), ou ajouter `?da=pixel` à l'adresse pour essayer. Mode d'emploi complet pour les artistes : [`docs/DA.md`](docs/DA.md).

La DA d'origine est en **arcade pixel** : coins carrés partout, cadres en escalier, icônes en pixel art, police Jersey 10 (embarquée, licence OFL, dans `src/da/pixel/assets/fonts/`). Les règles sont dans `DESIGN.md`. Pour redonner des coins arrondis aux cellules, il suffit de changer `CORNER_RATIO` dans `src/render/images.ts`.

## Ce qu'on peut faire

- **Monde quasi infini** (67 millions de cases de côté) avec zoom (molette, curseur, deux doigts) et déplacement.
- **Outils** (dans cet ordre) : crayon, gomme (ou clic droit), main (déplacer la vue), sélection. La **taille de la gomme** (1 à 15 cases) se règle avec un petit slider qui apparaît quand on survole l'icône de gomme.
- **Clignotement** : une cellule qui reste en vie clignote (violet clair) toutes les 3 générations, pour qu'une scène stable ne ressemble pas à un bug.
- **Lecture** : `<<` lecture arrière · `<` une génération en arrière · `||` pause · `>` une génération en avant · `>>` lecture.
- **Vitesse** réglable de 1 à 120 générations par seconde.
- **Modifier pendant la pause** : on ajoute des cellules ou des structures sans tout recommencer.
- **Bibliothèque de structures** (stables, oscillateurs, vaisseaux, canon, mathusalems) : on les glisse sur la grille ou on clique dessus pour les poser comme un tampon. `R` pour les tourner, `F` pour les retourner.
- **Sélection** : copier, couper, supprimer, ou « garder comme structure » (elle s'ajoute alors à la bibliothèque).
- **Format RLE** : on peut coller (Ctrl+V) une structure copiée sur [LifeWiki](https://conwaylife.com/wiki), ou déposer un fichier `.rle` sur la page.
- **Images** : on importe des images (bouton ou glisser-déposer). Le pinceau et les structures posent alors des cellules qui portent cette image. Une cellule qui naît prend l'image la plus présente parmi ses parents, donc les images se propagent et se disputent le terrain.
- **4 couleurs** : née (cyan), vivante (violet), vient de mourir (trace sombre), morte (fond).
- **Mode nuit (néon) / mode jour** (bouton en haut à droite, à gauche de l'œil) et un bouton **œil** pour masquer toute l'interface.
- **Grille vide au départ** : on arrive sur une page vierge, en pause. La grille est bien visible et se masque dans le menu **Options** (bouton à trois barres, en haut à gauche).
- **Intégration dans AlgoGo** : le jeu peut être servi par un site Flask plus grand (voir [`docs/INTEGRATION.md`](docs/INTEGRATION.md) et `tools/exporter_algo_go.sh`) ; dans ce cas, le menu Options propose « Retour à AlgoGo ».
- **Reprise automatique** : au rechargement de la page, la grille, la vue, la vitesse et « Mes structures » reviennent (la grille en pause). Tout reste dans le navigateur. Si une grille faisait planter la page, elle est abandonnée à l'ouverture suivante (pas de plantage en boucle).
- **Didacticiel** : à la première visite, un parcours en 8 bulles (Suivant / Précédent, compteur `1/8`, « Passer le didacticiel »). Pour le revoir : Options → Aide (?), ou la touche `?`.
- **Épaisseur du crayon** (1 à 15) : survole le crayon, un slider apparaît. Le crayon pose plusieurs cellules d'un coup (il ne grossit pas les cellules).
- **Options avancées** (menu Options, interrupteur) : ajoutent
  - **Annuler / Rétablir** sous les outils (`Ctrl+Z`, `Ctrl+Maj+Z`) : défait un trait, une structure posée, « Effacer »… ;
  - le **type de trait** du crayon : plein, damier, points, lignes, colonnes, spray ;
  - la section **Images** du panneau de droite : importer des images, choisir l'image des cellules vivantes et celle des cellules mortes ;
  - **Config DA** : un outil de personnalisation complet (voir ci-dessous).
- **Config DA** (options avancées) : essaie des styles directement dans le site, **séparément pour le mode nuit et le mode jour**. On choisit des **rôles** (page, panneaux, fond de la légende, **titre**, **miniatures des structures** (indépendantes des cellules du jeu), écriture, détails, bords, cellules, étoiles, carré facultatif derrière la légende et les miniatures) parmi les couleurs de la **palette de la DA** (chaque ligne a aussi une pastille **« Défaut »** qui remet la couleur de la DA) et le site **déduit les nuances** (boutons, survol, texte lisible…). On règle aussi le quadrillage (lignes ou croix, **opacité réglable**), le fond (aucun, constellation, image recolorée) et la vitre. Le quadrillage peut aussi y être **masqué** (même réglage que « Grille » dans Options). Réglages retenus dans le navigateur ; **« Copier le diagnostic »** donne l'état du site et du navigateur (utile si quelque chose ne s'affiche pas quelque part) ; **« Copier la config »** les donne au format `da.json` pour les garder.
- **Structures énormes** : Breeder 1 (une usine à usines de canons), le Cordership à 10 moteurs et le Remplisseur, tirés de la collection LifeWiki.
- **Infobulles** : survole n'importe quel bouton pour savoir ce qu'il fait.
- Bouton **Effacer** en deux clics, pour éviter les accidents.

### Raccourcis clavier

| Touche | Action | Touche | Action |
|---|---|---|---|
| `Espace` | lecture / pause | `S` | sélection |
| `→` / `←` | une génération avant / arrière | `D` | main (déplacer) |
| `Maj` + `→` / `←` | lecture avant / arrière | `P` | pinceau |
| `+` / `-` | zoomer / dézoomer | `G` | gomme |
| `0` | recentrer sur les cellules | `R` / `F` | tourner / retourner la structure en main |
| `Ctrl+C` / `X` / `V` | copier / couper / coller | `M` | afficher / masquer l'interface (œil) |
| `Suppr` | supprimer la sélection | `N` | mode nuit / jour |
| `Échap` | annuler (sélection, structure en main) | clic du milieu | déplacer la vue |

## Architecture

```
src/
├── main.ts              Point d'entrée : crée les objets, les relie, lance la boucle d'animation
├── app.ts               Le « contexte » partagé (qui est qui)
├── core/                Logique pure : aucune dépendance au navigateur, entièrement testée
│   ├── coords.ts        Coordonnées ↔ clé numérique unique (monde quasi infini)
│   ├── rules.ts         Règles B/S (patron Stratégie)
│   ├── world.ts         LE MOTEUR : cellules vivantes, calcul d'une génération, photos
│   ├── history.ts       Historique passé / futur (pour reculer dans le temps)
│   ├── pattern.ts       Structures + rotation / miroir
│   ├── edithistory.ts   Annuler / Rétablir les modifications de la personne
│   ├── strokes.ts       Types de trait du crayon (plein, damier, points…)
│   ├── rle.ts           Lecture / écriture du format RLE
│   └── events.ts        Système d'événements (patron Observateur)
├── simulation/
│   └── simulation.ts    Lecture, pause, avance / recul, vitesse (accumulateur de temps)
├── render/              Affichage
│   ├── camera.ts        Zoom et déplacement : conversions écran ↔ monde
│   ├── renderer.ts      Dessin de la grille dans le canvas
│   ├── theme.ts         Palettes nuit / jour (source unique des couleurs)
│   ├── images.ts        Bibliothèque d'images pour habiller les cellules
│   └── thumbnail.ts     Miniatures des structures
├── input/               Interaction
│   ├── tools.ts         Les outils (patron État) : sélection, main, pinceau, gomme, tampon
│   ├── editor.ts        Chef d'orchestre des modifications (outil actif, sélection, structures en main)
│   ├── controller.ts    Souris / doigts / molette → outil actif
│   └── line.ts          Tracé de lignes de cases (Bresenham)
├── data/
│   ├── patterns.ts      Structures célèbres (au format RLE) + « Mes structures »
│   ├── rle/             Fichiers .rle des structures énormes (LifeWiki / conwaylife.com)
│   └── tour.ts          Les étapes du didacticiel
├── da/                  Directions artistiques : un dossier par DA (da.json + assets), active.ts, schéma, application
├── ui/                  Interface (boutons, panneaux, clavier, menu Options, didacticiel, infobulles)
└── styles.css           Apparence
tests/                   Tests automatiques (Vitest)
docs/ALGORITHMES.md      Explication détaillée de chaque algorithme
docs/SECURITE.md         Audit de sécurité et de performance
CLAUDE.md                Consignes pour un agent IA qui reprend le projet
```

**Sens des dépendances.** `core` ne dépend de rien. `simulation` dépend de `core`. `render` et `input` dépendent des deux. `ui` dépend de tout, et `main.ts` assemble l'ensemble. Le moteur peut donc être réutilisé ailleurs : dans un Web Worker, dans un script en ligne de commande, ou pour le futur labo génétique.

**Patrons de conception utilisés.**

- **État** : les outils.
- **Stratégie** : les règles B/S.
- **Observateur** : les événements `change`.
- **Commande** (sous forme d'actions partagées entre boutons et clavier) : `ui/actions.ts`.
- **Injection de dépendances** : `app.ts`.
- **Double tampon** : le calcul des générations.

Les algorithmes sont expliqués pas à pas dans **[docs/ALGORITHMES.md](docs/ALGORITHMES.md)**.

## Tests

`npm test` vérifie le moteur sur des résultats **connus et documentés**. Par exemple :

- le R-pentomino se stabilise à la génération 1103 avec 116 cellules ;
- Diehard disparaît à la génération 130 ;
- le gland finit avec 633 cellules à la génération 5206 ;
- le canon de Gosper produit un planeur toutes les 30 générations.

La moindre erreur dans l'algorithme ferait échouer ces tests.

## Et ensuite ?

Le code est préparé pour la suite :

1. **Sauvegardes** : la reprise automatique existe (`core/session.ts`). Il reste à ajouter l'export / import de fichiers `.rle` / `.json` et une bibliothèque persistante dans IndexedDB (y compris les images, qui ne sont pas gardées au rechargement).
2. **Lien de partage** : encoder le RLE compressé dans l'URL.
3. **Choix de la règle** : `RULE_PRESETS` (HighLife, Seeds, Day & Night) est prêt dans `core/rules.ts`. Il ne manque que le menu.
4. **Performances** : déplacer `World` dans un Web Worker, puis passer à une grille découpée en blocs (ou à HashLife) pour les très grands mondes.
5. **Labo génétique** (projet perso) : les simulations massives se font en Python (PyTorch / JAX sur GPU), qui exporte les meilleurs individus en RLE / JSON. Le site les affiche ensuite dans une page « Labo ».
# Projet-Jeu-de-La-Vie-DSAA

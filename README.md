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

- **Dossier `dist/`** : à déposer tel quel sur n'importe quel hébergement (GitHub Pages, Netlify, serveur de l'école…). Tous les chemins sont relatifs, donc ça marche aussi dans un sous-dossier, par exemple `ecole.fr/projets/jeu-de-la-vie/`.
- **Fichier unique `dist-single/index.html`** : tout est dedans (code, style, icônes). Pratique à envoyer par mail ou à déposer sur un portail.
- **Dans une iframe** : ça marche. Attention seulement : les futures sauvegardes dans le navigateur (localStorage, IndexedDB) seront cloisonnées par site dans une iframe d'un autre domaine. C'est pour ça que la sauvegarde principale prévue est l'export de fichiers.

## Ce qu'on peut faire

- **Monde quasi infini** (67 millions de cases de côté) avec zoom (molette, curseur, deux doigts) et déplacement.
- **Outils** : sélection, main (déplacer la vue), pinceau, gomme (ou clic droit).
- **Lecture** : `<<` lecture arrière · `<` une génération en arrière · `||` pause · `>` une génération en avant · `>>` lecture.
- **Vitesse** réglable de 1 à 120 générations par seconde.
- **Modifier pendant la pause** : on ajoute des cellules ou des structures sans tout recommencer.
- **Bibliothèque de structures** (stables, oscillateurs, vaisseaux, canon, mathusalems) : on les glisse sur la grille ou on clique dessus pour les poser comme un tampon. `R` pour les tourner, `F` pour les retourner.
- **Sélection** : copier, couper, supprimer, ou « garder comme structure » (elle s'ajoute alors à la bibliothèque).
- **Format RLE** : on peut coller (Ctrl+V) une structure copiée sur [LifeWiki](https://conwaylife.com/wiki), ou déposer un fichier `.rle` sur la page.
- **Images** : on importe des images (bouton ou glisser-déposer). Le pinceau et les structures posent alors des cellules qui portent cette image. Une cellule qui naît prend l'image la plus présente parmi ses parents, donc les images se propagent et se disputent le terrain.
- **4 couleurs** : née (cyan), vivante (violet), vient de mourir (trace sombre), morte (fond).
- **Mode nuit (néon) / mode jour**, et un bouton pour **masquer le menu**.
- Bouton **Effacer** en deux clics, pour éviter les accidents.

### Raccourcis clavier

| Touche | Action | Touche | Action |
|---|---|---|---|
| `Espace` | lecture / pause | `S` | sélection |
| `→` / `←` | une génération avant / arrière | `D` | main (déplacer) |
| `Maj` + `→` / `←` | lecture avant / arrière | `P` | pinceau |
| `+` / `-` | zoomer / dézoomer | `G` | gomme |
| `0` | recentrer sur les cellules | `R` / `F` | tourner / retourner la structure en main |
| `Ctrl+C` / `X` / `V` | copier / couper / coller | `M` | afficher / masquer le menu |
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
│   └── demo.ts          Le monde affiché à l'ouverture
├── ui/                  Interface (boutons, panneaux, clavier)
└── styles.css           Apparence
tests/                   Tests automatiques (Vitest)
docs/ALGORITHMES.md      Explication détaillée de chaque algorithme
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

1. **Sauvegardes** : `world.snapshot()` / `restore()` et le format RLE existent déjà. Il reste à ajouter l'export / import de fichiers `.rle` / `.json` et une bibliothèque persistante dans IndexedDB (y compris les images).
2. **Lien de partage** : encoder le RLE compressé dans l'URL.
3. **Choix de la règle** : `RULE_PRESETS` (HighLife, Seeds, Day & Night) est prêt dans `core/rules.ts`. Il ne manque que le menu.
4. **Performances** : déplacer `World` dans un Web Worker, puis passer à une grille découpée en blocs (ou à HashLife) pour les très grands mondes.
5. **Labo génétique** (projet perso) : les simulations massives se font en Python (PyTorch / JAX sur GPU), qui exporte les meilleurs individus en RLE / JSON. Le site les affiche ensuite dans une page « Labo ».
# Projet-Jeu-de-La-Vie-DSAA

# Consignes pour l'agent IA qui travaille sur ce projet

Tu reprends un **jeu de la vie interactif** écrit en TypeScript, sans framework. Lis ce fichier en entier avant de modifier quoi que ce soit, puis `README.md` (fonctionnalités, architecture) et `docs/ALGORITHMES.md` (explication des algorithmes).

## Contexte

- **Projet scolaire et académique.** Le code doit pouvoir être présenté et expliqué à l'oral. Chaque fonction est commentée, et la logique algorithmique est expliquée, pas seulement le « quoi ».
- **Public : des collégiens.** L'interface reste simple, en français, au tutoiement, avec des mots concrets (« Effacer », « Tourner », pas de jargon). Style sobre, rétro, néon cyan / violet sur fond noir, plus un mode jour.
- **Le propriétaire du projet n'est pas développeur web** (il vient de l'IA). Explique tes changements simplement, en français, à la fin de chaque tâche.
- **Projet perso à venir** : un « labo génétique ». Les simulations massives tourneront en Python et exporteront du RLE / JSON, que le site affichera. Le moteur doit donc rester réutilisable.

## Commandes

```bash
npm install          # première fois
npm run dev          # site en local (http://localhost:5173)
npm test             # tests Vitest (doivent TOUS passer)
npm run typecheck    # vérification TypeScript stricte
npm run build        # version en ligne → dist/
npm run build:single # fichier unique autonome → dist-single/index.html
```

## Architecture (à respecter)

```
core/  ←  simulation/  ←  render/ , input/  ←  ui/  ←  main.ts
```

- **`src/core/` ne dépend de RIEN** : ni DOM, ni `window`, ni canvas. C'est la logique pure : monde, règles, historique, RLE, structures, événements. Elle doit rester testable avec Node et déplaçable dans un Web Worker.
- **`main.ts` est le seul endroit qui crée et relie les objets** (racine de composition). Les modules reçoivent leurs dépendances via l'objet `App` (`src/app.ts`), jamais via des variables globales.
- **L'interface ne modifie jamais le monde directement.** Elle appelle `Editor` (modifications) ou `Simulation` (temps). Les actions partagées entre boutons et clavier vivent dans `src/ui/actions.ts`.
- **L'affichage se met à jour en écoutant des événements** (`on('change', …)`, patron Observateur), jamais « à la main » dans un gestionnaire de clic.
- **Après toute modification de la grille par l'utilisateur**, appelle `simulation.markEdited()`, qui vide l'avenir mémorisé, puis `invalidate()`, qui demande un nouveau dessin.

Patrons en place (garde-les cohérents) :

| Patron | Où |
|---|---|
| État | `input/tools.ts` |
| Stratégie | `core/rules.ts` |
| Observateur | `core/events.ts` |
| Double tampon | `World.step()` |
| Injection de dépendances | `app.ts` |
| Actions partagées | `ui/actions.ts` |

## Conventions de code

- TypeScript **strict**. Pas de `any`. Noms de code en **anglais**, commentaires et textes d'interface en **français**.
- **Chaque fichier** commence par un en-tête qui explique son rôle et ses idées principales (regarde `core/world.ts` comme modèle).
- **Chaque fonction ou méthode** a un commentaire qui dit ce qu'elle fait **et comment** : l'algorithme, pourquoi ce choix, sa complexité si elle compte.
- Un nouvel algorithme, c'est trois choses :
  - les commentaires dans le code ;
  - une **section dans `docs/ALGORITHMES.md`** ;
  - un **test sur un résultat connu** (une valeur documentée sur LifeWiki par exemple).
- Couleurs : uniquement dans `render/theme.ts` (canvas) et dans les variables CSS de `styles.css`. Ne jamais coder une couleur en dur ailleurs.
- Les 4 états de cellule ont un sens fixe : née (âge 0), vivante (âge ≥ 1), vient de mourir (trace), morte. Ne change pas cette sémantique.
- Tout accès à `localStorage` / `IndexedDB` est entouré de `try / catch` (le site peut tourner dans une iframe où le stockage est refusé).
- Garde `base: './'` dans `vite.config.ts` (le site doit marcher dans un sous-dossier du site de l'école).

## Recettes

- **Ajouter une structure** : une entrée dans `BUILTIN_DEFINITIONS` (`data/patterns.ts`), avec son RLE copié depuis LifeWiki, une catégorie et une description d'une ligne pour des collégiens. Ajoute un test si elle a une propriété connue (période, vitesse…).
- **Ajouter un outil** : une classe qui implémente `Tool` (`input/tools.ts`), enregistrée dans le constructeur d'`Editor`. Ensuite, un bouton `data-tool="…"` dans `index.html` (avec `aria-label` et `title` incluant le raccourci) et une lettre dans `ui/shortcuts.ts`.
- **Ajouter une règle** : `RULE_PRESETS` existe déjà dans `core/rules.ts`. Il reste à créer un menu dans l'interface qui modifie `world.rule`, puis à appeler `simulation.markEdited()`.
- **Ajouter un panneau** : son HTML dans `index.html` (dans `#ui`, pour qu'il se masque avec le menu), son style dans `styles.css`, et une fonction `setupXxx(app)` dans `src/ui/`, appelée depuis `main.ts`.

## Avant de dire « terminé »

1. `npm run typecheck`, `npm test` et `npm run build` passent sans erreur.
2. Tu as ouvert le site (`npm run dev`) et vérifié à l'œil ce que tu as changé, dans les deux thèmes.
3. Les commentaires, `README.md` (liste des fonctionnalités, raccourcis) et `docs/ALGORITHMES.md` sont à jour.
4. Tu résumes au propriétaire, en français simple : ce qui a changé, comment le tester, et ce qui reste à faire.

## À ne pas faire sans demander

- Ajouter un framework (React, Angular…) ou une dépendance npm.
- Mettre l'état de la grille dans le DOM ou dans un framework (le canvas et `World` s'en chargent).
- Casser la compatibilité du format RLE ou des photos (`WorldSnapshot`), qui serviront aux sauvegardes et au labo génétique.
- Supprimer ou affaiblir un test existant pour le faire passer.

## Feuille de route (dans cet ordre)

1. **Sauvegardes** :
   - export / import `.rle` et `.json`, avec un champ `version` dans le JSON ;
   - bibliothèque persistante dans IndexedDB : structures perso + images (stockées en Blob).
2. **Lien de partage** : RLE compressé (`CompressionStream('deflate-raw')` + base64url) dans le `#hash` de l'URL.
3. **Menu de règles** (HighLife, Seeds, Day & Night…).
4. **Web Worker** pour `World`, puis une grille découpée en blocs de 64 × 64 si les performances l'exigent.
5. **Page « Labo »** : afficher les résultats JSON produits par le labo génétique en Python (meilleurs individus, courbes de fitness).

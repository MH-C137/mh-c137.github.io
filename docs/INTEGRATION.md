# Intégrer le jeu dans le projet AlgoGo (Flask)

Le projet AlgoGo (`Abacuc0/algo_go`) est une application **Flask** : chaque algorithme est un « module » dans `app/`. Le jeu
n'a pas besoin d'être recompilé chez eux : on y dépose le **site déjà construit** (`dist/`, une dizaine de fichiers).

## Comment ça marche

- Le module `app/jeu_vie/` sert le dossier `static/jeu_vie/` (le contenu de `dist/`) à l'adresse `/jeu-vie/`.
- Les chemins du jeu sont **relatifs** (`base: './'` dans `vite.config.ts`) : le jeu marche donc dans n'importe quel dossier.
- La route ajoute dans la page une balise `<meta name="retour-url" content="/" data-label="Retour à AlgoGo">` : le jeu affiche
  alors « Retour à AlgoGo » dans son menu Options (sans cette balise, le lien est caché : le site sur GitHub Pages n'a pas de retour).
- Les données du navigateur du jeu commencent toutes par `jeu-de-la-vie:` : pas de collision avec les autres modules.

## Mettre le jeu à jour chez AlgoGo

```bash
tools/exporter_algo_go.sh /chemin/vers/algo_go
```

Le script construit le site, vide l'ancien dossier (les noms de fichiers changent à chaque construction) et copie le nouveau.
Ensuite, dans le projet AlgoGo : `git add app/jeu_vie`, un commit, puis une pull request depuis une branche perso.

## À ne pas faire

- Ne pas ajouter de `package.json` ni de dossier `node_modules` à la racine d'AlgoGo : leur hébergeur lance `gunicorn` et pourrait
  s'en trouver perturbé.
- Ne pas modifier les fichiers copiés à la main : ils sont écrasés à la prochaine mise à jour.

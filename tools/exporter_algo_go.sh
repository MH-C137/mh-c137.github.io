#!/usr/bin/env bash
# ============================================================================
#  exporter_algo_go.sh — Met le jeu à jour dans le projet AlgoGo (Flask)
# ============================================================================
#  Usage :  tools/exporter_algo_go.sh /chemin/vers/algo_go
#
#  Ce que ça fait :
#    1. construit le site (npm run build → dist/) ;
#    2. vide l'ancien dossier  app/jeu_vie/static/jeu_vie/  du projet AlgoGo (les noms de fichiers changent à
#       chaque construction : sans ce nettoyage, de vieux fichiers s'accumuleraient) ;
#    3. y copie le nouveau site.
#  Ensuite, dans le projet AlgoGo : git add app/jeu_vie && git commit, puis pull request.
set -euo pipefail

cible="${1:?Donne le chemin du projet AlgoGo, par exemple : tools/exporter_algo_go.sh ../algo_go}"
dossier="$cible/app/jeu_vie/static/jeu_vie"
[ -d "$cible/app/jeu_vie" ] || { echo "Je ne trouve pas $cible/app/jeu_vie : est-ce bien le projet AlgoGo ?" >&2; exit 1; }

cd "$(dirname "$0")/.."
npm run build
rm -rf "$dossier"
mkdir -p "$dossier"
cp -r dist/. "$dossier/"
echo "Jeu copié dans $dossier ($(find "$dossier" -type f | wc -l) fichiers)."

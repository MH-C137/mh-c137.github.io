# Audit de sécurité et de performance

Audit fait sur le site du jeu (`src/`, `index.html`, `vite.config.ts`, la mise en ligne GitHub Actions) et sur son intégration dans le projet Flask AlgoGo (`app/jeu_vie`). **Les autres modules d'AlgoGo (KNN, K-means, minimax, génétique) n'ont pas été audités.**

## Résumé

Le site n'a pas de serveur, pas de compte, pas de données personnelles, aucune connexion vers un autre site : la surface d'attaque est petite. Les risques réels venaient des **données reçues** (texte RLE collé, fichier glissé) et du **stockage du navigateur**. Tout ce qui venait de l'extérieur est maintenant borné et vérifié.

## Trouvé et corrigé

| # | Gravité | Problème | Correction | Test |
|---|---|---|---|---|
| 1 | Moyenne | **Lecture du RLE sans limite.** `99999999999o`, ou un nombre de 5 000 chiffres (= « infini » pour JavaScript), faisait créer des milliards de cellules ou bouclait sans fin : l'onglet se figeait. Un texte RLE se copie facilement depuis un forum ou un message d'un ami. | Texte ≤ 5 millions de caractères, nombre ≤ 2²⁶, ≤ 2 millions de cellules (`core/rle.ts`). | `tests/rle.test.ts` |
| 2 | Moyenne | **Copie / écriture RLE en O(largeur × hauteur).** Copier deux cellules très éloignées parcourait des milliards de cases vides. | Écriture creuse : seules les cellules vivantes sont parcourues. | `tests/rle.test.ts` (50 millions de cases : instantané) |
| 3 | Faible | **Fichiers importés sans limite de taille** (texte ou image) : un fichier géant fige ou fait planter l'onglet. | 5 Mo maximum pour un texte, 10 Mo pour une image (`ui/actions.ts`), avec un message. | — |
| 4 | Défense en profondeur | **Aucune politique de sécurité de la page (CSP).** | CSP ajoutée à la page construite : seuls nos scripts, styles, images et polices sont chargés, aucune connexion externe (`vite.config.ts`). Vérifiée dans Chromium : 0 violation, 0 erreur (polices, import d'image, thème, config DA). | vérification manuelle |
| 5 | Faible | **Intégration Flask sans en-têtes de sécurité.** | `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: SAMEORIGIN` sur le module du jeu. | `tests/test_jeu_vie.py` (AlgoGo) |

## Vérifié, sans problème

- **Pas d'injection de HTML.** Aucun `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write` dans le code : tout texte affiché passe par `textContent` ou des nœuds texte.
- **Couleurs.** Les couleurs lues (DA, réglages du navigateur) sont validées par une expression stricte (`#hex`, `rgb()`, `hsl()` uniquement) : impossible d'y glisser une adresse (`url(...)`) ou du code.
- **`?da=nom`.** Le nom sert seulement à chercher parmi les DA connues du projet : aucun accès à un fichier arbitraire.
- **Stockage du navigateur.** Toutes les lectures sont dans un `try / catch` et vérifiées (`parseOverrides`, `parseSession`). Les clés commencent par `jeu-de-la-vie:` : pas de collision avec les autres modules d'AlgoGo (qui n'utilisent que `minimax.reasoningAuto`).
- **Dépendances.** `npm audit` : 0 vulnérabilité. Aucune dépendance n'est livrée dans le site (que des outils de fabrication). Les polices sont dans le projet (pas de CDN : aucun pistage par un tiers).
- **Réseau.** Le jeu ne fait aucune requête (`connect-src 'self'` le garantit).
- **Presse-papiers.** Le « diagnostic » ne copie rien sans clic, et ne contient ni nom ni contenu de grille.
- **Flask.** `send_from_directory` refuse de sortir du dossier ; le mode `debug` est coupé dans `run.py` ; la clé secrète vient de l'environnement.

## Reste à surveiller (non corrigé, risque faible)

- **Actions GitHub épinglées par version (`@v4`) et non par empreinte.** Un compte compromis chez l'éditeur de l'action pourrait publier une version piégée. Recommandation : épingler les empreintes (SHA) et activer Dependabot.
- **Images importées.** On limite la taille du fichier, pas ses dimensions : une image très compressée mais gigantesque en pixels peut encore consommer beaucoup de mémoire au décodage.
- **Le fichier unique** (`npm run build:single`) a son script dans la page : il ne reçoit pas la CSP. À éviter pour un site public.
- **Les autres modules d'AlgoGo**, non audités (K-means utilise une base SQLite : à relire pour les requêtes SQL).

## Performance

Mesures sur une machine de test, calcul seul (`World.step`), avant → après :

| Cas | Avant | Après |
|---|---|---|
| Remplisseur (96 000 cellules) | 37 ms / génération | **15 ms** |
| Soupe aléatoire 300 × 300 (11 000 cellules) | 19 ms | **7 ms** |
| Breeder (5 000 cellules) | 3,8 ms | **2,0 ms** |

Cause : la `Map` JavaScript créait près d'un million d'objets par génération (voir `docs/ALGORITHMES.md`, section 3). Le résultat est identique (vérifié contre un calcul naïf).

Dessin : profilé dans Chromium avec une grande grille qui tourne. Le code de dessin pèse moins de 1 % du temps ; ce qui reste est le travail du navigateur lui-même (peinture), que le matériel graphique d'un vrai ordinateur ou téléphone accélère. Pas de goulot côté code à corriger. La DA n'a pas été touchée.

Pistes pour aller plus loin : ranger aussi les âges dans une table typée (le calcul passerait à ~8 ms), déplacer `World` dans un Web Worker, HashLife pour les très grands mondes.

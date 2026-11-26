/**
 * Configuration de Vite (l'outil qui lance le site en local et fabrique la version en ligne).
 *
 * - `base: './'` : tous les chemins du site sont RELATIFS. Le site marche donc
 *   aussi bien à la racine d'un domaine que dans un sous-dossier
 *   (ex. ecole.fr/projets/jeu-de-la-vie/) ou dans une iframe.
 * - `npm run build`        → dossier dist/        (site classique : HTML + JS + CSS)
 * - `npm run build:single` → dossier dist-single/ (UN SEUL fichier index.html autonome,
 *   pratique à envoyer par mail ou à déposer sur un portail)
 */
import { defineConfig, type Plugin } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Politique de sécurité du contenu (CSP), ajoutée à la page DANS LE SITE CONSTRUIT (pas en développement).
 * Elle dit au navigateur ce que la page a le droit de charger ; tout le reste est refusé, ce qui limite
 * les dégâts si une faille laissait un jour s'exécuter du code venu d'ailleurs.
 *   - script-src 'self'  : seulement NOS scripts (pas de script écrit dans la page, pas d'eval) ;
 *   - style-src 'self'   : seulement NOTRE feuille de style (les couleurs posées par le code passent par
 *                          style.setProperty, que la CSP autorise) ;
 *   - img-src / font-src : nos fichiers, plus data: (petites images fabriquées par le jeu) et blob: (images importées) ;
 *   - connect-src 'self' : le jeu n'envoie rien à un autre site ;
 *   - object-src 'none', base-uri 'self', form-action 'none' : pas de greffons, pas de <base> piégé, pas de formulaire.
 * Le fichier unique (`build:single`) a son script DANS la page : il ne reçoit pas cette règle.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicy: Plugin = {
  name: 'politique-de-securite-du-contenu',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [contentSecurityPolicy],
  build: {
    // Le code final reste lisible par les Safari un peu anciens (Safari 14 et +) :
    // sans cette ligne, un Safari plus vieux que la valeur par défaut de Vite affiche une page blanche.
    target: ['es2020', 'safari14'],
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));

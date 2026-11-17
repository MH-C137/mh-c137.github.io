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
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
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

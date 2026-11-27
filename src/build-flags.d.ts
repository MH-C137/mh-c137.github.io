/**
 * Drapeaux posés au moment de la fabrication du site (voir `define` dans vite.config.ts).
 *
 * __CONFIG_DA__ : vrai si le panneau « Config DA » (personnalisation des couleurs) est inclus.
 *   - `npm run dev`, `npm run build`, `npm run build:single` : vrai (le site complet) ;
 *   - `npm run build:algogo` (version intégrée au projet Flask AlgoGo) : faux. Le code du panneau n'est
 *     alors pas livré : le navigateur a moins à télécharger et à lire.
 */
declare const __CONFIG_DA__: boolean;

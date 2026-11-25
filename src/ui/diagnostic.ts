/**
 * ============================================================================
 *  diagnostic.ts — « Copier le diagnostic » : comprendre un problème d'affichage
 * ============================================================================
 *
 * Quand quelque chose ne s'affiche pas chez quelqu'un (ex. la grille dans un navigateur
 * précis), on ne peut pas deviner. Ce petit rapport donne l'ESSENTIEL : navigateur, résolution
 * de l'écran, état de la grille et du fond, couleurs utilisées, réglages mémorisés, et les
 * erreurs rencontrées. Il ne contient aucune donnée personnelle (pas de nom, de fichier ni de
 * contenu de la grille).
 *
 * Les erreurs sont écoutées dès le démarrage du site (`listenForErrors`, appelée une seule fois),
 * pour ne rien rater de ce qui s'est passé avant qu'on clique sur le bouton.
 */

import type { App } from '../app';

/** Les erreurs rencontrées depuis le démarrage (les 20 premières). */
const errors: string[] = [];

/** Se met à l'écoute des erreurs du navigateur. À appeler une fois, au démarrage. */
export function listenForErrors(): void {
  window.addEventListener('error', (event) => {
    if (errors.length < 20) errors.push(`${event.message} (${event.filename?.split('/').pop() ?? '?'}:${event.lineno})`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (errors.length < 20) errors.push(`promesse refusée : ${String(event.reason)}`);
  });
}

/** Lit une valeur mémorisée sans jamais planter (le stockage peut être refusé). */
function stored(key: string): string {
  try {
    return localStorage.getItem(key) ?? '(vide)';
  } catch {
    return '(stockage refusé)';
  }
}

/** Le rapport, en texte à copier-coller. */
export async function collectDiagnostic(app: App): Promise<string> {
  const { renderer, camera, theme, design, viewSettings } = app;
  const canvas = document.getElementById('world') as HTMLCanvasElement | null;
  // Brave se signale lui-même : navigator.brave.isBrave().
  const brave = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
  let isBrave = false;
  try {
    isBrave = (await brave?.isBrave?.()) ?? false;
  } catch {
    // Pas de réponse : on suppose que ce n'est pas Brave.
  }
  const palette = renderer.palette;
  const report = {
    site: { da: design.design.id, theme: theme.name },
    navigateur: { agent: navigator.userAgent, brave: isBrave, langue: navigator.language },
    ecran: {
      resolution: window.devicePixelRatio,
      fenetre: `${window.innerWidth}x${window.innerHeight}`,
      canvas: canvas ? `${canvas.width}x${canvas.height} pour ${canvas.clientWidth}x${canvas.clientHeight}` : 'introuvable',
    },
    dessin: {
      zoom: Number(camera.zoom.toFixed(2)),
      grilleVisible: renderer.gridVisible,
      styleGrille: renderer.gridStyle,
      styleFond: design.backgroundStyleOf(theme.name),
      options: { grille: viewSettings.gridVisible, avancees: viewSettings.advancedVisible },
      couleurs: { fond: palette.background, grille: palette.grid, grillePrincipale: palette.gridMajor, vitre: palette.glass, etoiles: palette.stars },
      fonctionsCanvas: {
        getTransform: typeof CanvasRenderingContext2D.prototype.getTransform,
        Path2D: typeof Path2D,
        roundRect: typeof CanvasRenderingContext2D.prototype.roundRect,
      },
    },
    memorise: {
      grille: stored('jeu-de-la-vie:grille:v2'),
      theme: stored('jeu-de-la-vie:theme'),
      reglagesDA: stored(`jeu-de-la-vie:da:${design.design.id}`),
    },
    erreurs: errors,
  };
  return JSON.stringify(report, null, 2);
}

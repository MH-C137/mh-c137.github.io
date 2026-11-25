/**
 * ============================================================================
 *  main.ts — Point d'entrée : on crée tout, on branche tout, on lance la boucle
 * ============================================================================
 *
 * C'est la « racine de composition » : le SEUL endroit où les objets sont créés
 * et reliés entre eux. Les autres fichiers reçoivent ce dont ils ont besoin en
 * paramètre (voir app.ts). Pour comprendre le programme, commencer ici.
 *
 *   World (données) ──► Simulation (temps) ──► Renderer (dessin)
 *        ▲                                        ▲
 *        └── Editor + outils (modifications) ─────┘── Camera (vue)
 *                ▲
 *        Interface (boutons, panneaux, clavier)
 *
 * La boucle principale (requestAnimationFrame) tourne ~60 fois par seconde :
 *   1. la simulation avance si elle est en lecture (selon la vitesse choisie) ;
 *   2. on redessine la grille SEULEMENT si quelque chose a changé
 *      (« invalidation » : économise la batterie quand tout est immobile).
 */

import './styles.css';
import type { App } from './app';
import { World } from './core/world';
import { PatternLibrary } from './data/patterns';
import { InputController } from './input/controller';
import { Editor } from './input/editor';
import { Camera } from './render/camera';
import { ImageLibrary } from './render/images';
import { Renderer } from './render/renderer';
import { Simulation } from './simulation/simulation';
import { createNotifier, setupActionBars } from './ui/actionbars';
import { byId, measureUiInsets, releaseFocusAfterClick } from './ui/dom';
import { setupLibrary } from './ui/library';
import { setupShortcuts } from './ui/shortcuts';
import { ThemeManager } from './ui/theme';
import { setupDaConfig } from './ui/daconfig';
import { listenForErrors } from './ui/diagnostic';
import { setupOptions } from './ui/options';
import { setupMenu, setupToolbar, setupToolOptions } from './ui/toolbar';
import { setupTooltips } from './ui/tooltips';
import { setupTutorial } from './ui/tutorial';
import { ViewSettings } from './ui/viewsettings';
import { chooseDesign } from './da/registry';
import { DesignRuntime } from './da/runtime';
import { setupTransport, setupZoom } from './ui/transport';

listenForErrors(); // garde les erreurs du navigateur pour le « diagnostic » (Config DA)

// ── 1. Les objets du programme ─────────────────────────────────────────────
const canvas = byId<HTMLCanvasElement>('world');
const world = new World();
const simulation = new Simulation(world);
const camera = new Camera();
const images = new ImageLibrary();
const library = new PatternLibrary();
const renderer = new Renderer(canvas, camera, world, images);

/** Vrai quand la grille doit être redessinée à la prochaine image. */
let needsRender = true;
const invalidate = () => {
  needsRender = true;
};

const editor = new Editor({ world, simulation, camera, images, library, invalidate });
// La DA (direction artistique) : couleurs, polices, forme des cellules… (voir src/da/ et docs/DA.md)
const design = new DesignRuntime(chooseDesign(), renderer, invalidate);
design.applyStatic();
const theme = new ThemeManager(renderer, design);
const notify = createNotifier(byId('toast'), byId('dock'));
const viewSettings = new ViewSettings(renderer);
const app: App = { world, simulation, camera, images, library, editor, renderer, theme, design, viewSettings, invalidate, notify };

// ── 2. Les branchements ────────────────────────────────────────────────────
new InputController(canvas, editor);
setupToolbar(app);
setupToolOptions(app);
setupTransport(app);
setupZoom(app);
setupLibrary(app);
setupActionBars(app);
const menu = setupMenu(app);
const tutorial = setupTutorial(app, menu);
const daConfig = setupDaConfig(app);
setupOptions(app, tutorial, daConfig);
setupShortcuts(app, menu, tutorial);
setupTooltips();
releaseFocusAfterClick(document.body);

// Tout changement visible demande un nouveau dessin (patron Observateur).
simulation.on('change', invalidate);
camera.on('change', invalidate);
images.on('change', invalidate);
theme.on('change', invalidate);
viewSettings.on('change', invalidate);

renderer.resize();
window.addEventListener('resize', () => {
  renderer.resize();
  invalidate();
});

// ── 3. Le monde de départ : une grille VIDE, en pause ──────────────────────
// (on arrive sur une page vierge : c'est à toi de dessiner, puis de lancer la vie)
simulation.speed = 10;
editor.centerView(measureUiInsets());

// ── 4. La boucle principale ────────────────────────────────────────────────
let previousTime = performance.now();
function frame(now: number): void {
  // Si l'onglet était caché, on ne « rattrape » pas des minutes de simulation d'un coup.
  const elapsed = Math.min(now - previousTime, 250);
  previousTime = now;
  simulation.update(elapsed);
  if (needsRender) {
    needsRender = false;
    renderer.render(editor.overlay);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

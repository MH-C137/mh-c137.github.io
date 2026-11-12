/**
 * ============================================================================
 *  app.ts — Le « contexte » de l'application : qui est qui
 * ============================================================================
 *
 * main.ts crée chaque objet une seule fois puis les range dans cet objet `App`.
 * Les modules d'interface reçoivent `App` en paramètre au lieu d'aller chercher
 * des variables globales : on voit ainsi clairement de quoi chacun dépend
 * (c'est de l'« injection de dépendances », version simple).
 */

import type { World } from './core/world';
import type { PatternLibrary } from './data/patterns';
import type { Editor } from './input/editor';
import type { Camera } from './render/camera';
import type { ImageLibrary } from './render/images';
import type { Renderer } from './render/renderer';
import type { Simulation } from './simulation/simulation';
import type { ThemeManager } from './ui/theme';

export interface App {
  readonly world: World;
  readonly simulation: Simulation;
  readonly camera: Camera;
  readonly images: ImageLibrary;
  readonly library: PatternLibrary;
  readonly editor: Editor;
  readonly renderer: Renderer;
  readonly theme: ThemeManager;
  /** Demande un nouveau dessin de la grille à la prochaine image. */
  readonly invalidate: () => void;
  /** Affiche un court message en bas de l'écran (« Copié ! »…). */
  readonly notify: (message: string) => void;
}

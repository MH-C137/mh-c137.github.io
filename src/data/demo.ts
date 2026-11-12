/**
 * ============================================================================
 *  demo.ts — Le monde affiché à l'ouverture
 * ============================================================================
 *
 * On n'ouvre jamais sur une grille vide : un canon à planeurs en action montre
 * tout de suite ce qu'est le jeu de la vie. Les structures sont placées pour ne
 * pas se percuter : le canon tire ses planeurs vers le bas à droite, le pulsar
 * est en haut à droite, le pentadécathlon à gauche, et un vaisseau léger file
 * vers la gauche tout en haut.
 */

import type { World } from '../core/world';
import { builtinPattern } from './patterns';

export function seedDemoWorld(world: World): void {
  world.placePattern(builtinPattern('gosper-gun'), -45, -25);
  world.placePattern(builtinPattern('pulsar'), 10, -30);
  world.placePattern(builtinPattern('pentadecathlon'), -44, 2);
  world.placePattern(builtinPattern('lwss'), 30, -40);
}

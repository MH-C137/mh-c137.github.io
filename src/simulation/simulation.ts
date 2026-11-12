/**
 * ============================================================================
 *  simulation.ts — Le « lecteur » : lecture, pause, avance / recul, vitesse
 * ============================================================================
 *
 * Le monde (world.ts) sait calculer UNE génération. La simulation décide QUAND
 * le faire et dans quel sens, comme un lecteur vidéo :
 *
 *     <<  lecture arrière      <  une génération en arrière
 *     ||  pause
 *     >   une génération en avant      >>  lecture
 *
 * ─── Le temps : un « accumulateur » ──────────────────────────────────────────
 * L'écran se redessine environ 60 fois par seconde, mais l'utilisateur choisit
 * une vitesse en générations par seconde (ex. 8 gén/s). À chaque image, on
 * ajoute au réservoir le temps écoulé × la vitesse :
 *     réservoir += (millisecondes écoulées / 1000) × vitesse
 * Puis on calcule autant de générations que la partie entière du réservoir, et
 * on garde la partie décimale pour la fois suivante. Résultat : la vitesse
 * réelle est exacte, que l'écran tourne à 30, 60 ou 144 images par seconde.
 *
 * La simulation est un « sujet » observable (patron Observateur) : elle émet
 * `change` pour que l'interface et l'affichage se mettent à jour.
 */

import { Emitter } from '../core/events';
import { History } from '../core/history';
import type { World } from '../core/world';

export type PlayState = 'paused' | 'forward' | 'backward';

/** Ce que l'interface a besoin de savoir pour s'afficher. */
export interface SimulationInfo {
  readonly generation: number;
  readonly population: number;
  readonly playState: PlayState;
  readonly speed: number;
  /** Faux au tout début de l'historique (le bouton « reculer » est alors grisé). */
  readonly canGoBack: boolean;
}

export const MIN_SPEED = 1;
export const MAX_SPEED = 120;
/** Garde-fou : jamais plus de N générations par image (évite de figer l'écran). */
const MAX_STEPS_PER_FRAME = 8;

export class Simulation extends Emitter<{ change: SimulationInfo }> {
  private state: PlayState = 'paused';
  private _speed = 8;
  /** Réservoir de « générations à calculer » (voir l'explication en haut du fichier). */
  private accumulator = 0;

  constructor(
    readonly world: World,
    readonly history: History = new History(),
  ) {
    super();
  }

  get playState(): PlayState {
    return this.state;
  }

  /** Vitesse en générations par seconde. */
  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    this._speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
    this.notify();
  }

  /** Résumé de l'état courant (pour l'interface). */
  info(): SimulationInfo {
    return {
      generation: this.world.generation,
      population: this.world.population,
      playState: this.state,
      speed: this._speed,
      canGoBack: this.history.canGoBack,
    };
  }

  /**
   * Avance d'une génération.
   * Si on avait reculé, la génération suivante est déjà connue (pile « futur ») :
   * on la reprend. Sinon on la calcule. Dans les deux cas, le présent part dans le passé.
   */
  stepForward(): void {
    const known = this.history.popFuture();
    this.history.pushPast(this.world.snapshot());
    if (known) this.world.restore(known);
    else this.world.step();
  }

  /**
   * Recule d'une génération (en reprenant la photo mémorisée).
   * @returns faux si l'historique est vide (début atteint).
   */
  stepBackward(): boolean {
    const previous = this.history.popPast();
    if (!previous) return false;
    this.history.pushFuture(this.world.snapshot());
    this.world.restore(previous);
    return true;
  }

  /** Bouton « > » : met en pause puis avance d'une génération. */
  stepOnceForward(): void {
    this.state = 'paused';
    this.stepForward();
    this.notify();
  }

  /** Bouton « < » : met en pause puis recule d'une génération. */
  stepOnceBackward(): void {
    this.state = 'paused';
    this.stepBackward();
    this.notify();
  }

  /** Boutons « >> » et « << » : lance la lecture dans un sens. */
  play(direction: 'forward' | 'backward'): void {
    if (direction === 'backward' && !this.history.canGoBack) return;
    this.state = direction;
    this.accumulator = 0;
    this.notify();
  }

  /** Bouton « || ». */
  pause(): void {
    this.state = 'paused';
    this.notify();
  }

  /** Barre d'espace : pause si ça tourne, lecture avant sinon. */
  togglePlay(): void {
    if (this.state === 'paused') this.play('forward');
    else this.pause();
  }

  /**
   * Appelée à chaque image par la boucle principale (main.ts).
   * @param elapsedMs temps écoulé depuis l'image précédente, en millisecondes.
   * @returns vrai si le monde a changé (il faudra le redessiner).
   */
  update(elapsedMs: number): boolean {
    if (this.state === 'paused') return false;
    this.accumulator += (elapsedMs / 1000) * this._speed;
    let steps = Math.floor(this.accumulator);
    if (steps > MAX_STEPS_PER_FRAME) {
      // L'ordinateur n'arrive pas à suivre (ou l'onglet était en arrière-plan) :
      // on plafonne et on vide le réservoir pour ne pas accumuler de retard.
      steps = MAX_STEPS_PER_FRAME;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps;
    }
    if (steps === 0) return false;

    for (let i = 0; i < steps; i++) {
      if (this.state === 'forward') {
        this.stepForward();
      } else if (!this.stepBackward()) {
        this.state = 'paused'; // début de l'historique atteint
        break;
      }
    }
    this.notify();
    return true;
  }

  /**
   * À appeler après chaque modification faite par l'utilisateur (pinceau,
   * gomme, structure posée…). Modifier le présent invalide l'avenir mémorisé.
   */
  markEdited(): void {
    this.history.clearFuture();
    this.notify();
  }

  /** Bouton « Effacer » : monde vide, génération 0, historique oublié. */
  clear(): void {
    this.state = 'paused';
    this.world.clear();
    this.history.clear();
    this.notify();
  }

  private notify(): void {
    this.emit('change', this.info());
  }
}

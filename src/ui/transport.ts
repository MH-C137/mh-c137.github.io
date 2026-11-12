/**
 * ============================================================================
 *  transport.ts — Barre de lecture (<< < || > >>), vitesse, compteurs, zoom
 * ============================================================================
 */

import type { App } from '../app';
import { MAX_ZOOM, MIN_ZOOM, sliderToValue, valueToSlider } from '../render/camera';
import { MAX_SPEED, MIN_SPEED, type SimulationInfo } from '../simulation/simulation';
import { byId, measureUiInsets } from './dom';

/** Nombres à la française : 12 345 (avec une espace fine entre les milliers). */
const formatNumber = new Intl.NumberFormat('fr-FR').format;

export function setupTransport(app: App): void {
  const { simulation } = app;
  const playBackward = byId<HTMLButtonElement>('play-backward');
  const stepBackward = byId<HTMLButtonElement>('step-backward');
  const pause = byId<HTMLButtonElement>('pause');
  const stepForward = byId<HTMLButtonElement>('step-forward');
  const playForward = byId<HTMLButtonElement>('play-forward');
  const speedSlider = byId<HTMLInputElement>('speed-slider');
  const speedValue = byId('speed-value');
  const generation = byId('generation');
  const population = byId('population');

  playBackward.addEventListener('click', () => simulation.play('backward'));
  stepBackward.addEventListener('click', () => simulation.stepOnceBackward());
  pause.addEventListener('click', () => simulation.pause());
  stepForward.addEventListener('click', () => simulation.stepOnceForward());
  playForward.addEventListener('click', () => simulation.play('forward'));

  // Le curseur va de 0 à 100 ; la vitesse suit une échelle logarithmique (1 → 120 gén/s).
  speedSlider.addEventListener('input', () => {
    simulation.speed = sliderToValue(Number(speedSlider.value), MIN_SPEED, MAX_SPEED);
  });

  setupClearButton(app);

  const render = (info: SimulationInfo) => {
    generation.textContent = formatNumber(info.generation);
    population.textContent = formatNumber(info.population);
    playBackward.setAttribute('aria-pressed', String(info.playState === 'backward'));
    pause.setAttribute('aria-pressed', String(info.playState === 'paused'));
    playForward.setAttribute('aria-pressed', String(info.playState === 'forward'));
    // Au début de l'historique, on ne peut plus reculer : boutons grisés.
    playBackward.disabled = !info.canGoBack;
    stepBackward.disabled = !info.canGoBack;
    const speed = info.speed < 10 ? info.speed.toFixed(1).replace('.', ',') : String(Math.round(info.speed));
    speedValue.textContent = `${speed} gén/s`;
    if (document.activeElement !== speedSlider) {
      speedSlider.value = String(valueToSlider(info.speed, MIN_SPEED, MAX_SPEED));
    }
  };
  simulation.on('change', render);
  render(simulation.info());
}

/**
 * « Effacer » en deux clics : le premier arme le bouton (« Sûr ? »), le second
 * efface vraiment. Sans clic dans les 3 secondes, le bouton se désarme. Évite
 * de perdre son travail sur un clic malheureux, sans fenêtre de confirmation.
 */
function setupClearButton(app: App): void {
  const button = byId<HTMLButtonElement>('clear');
  const label = button.querySelector('span') as HTMLSpanElement;
  let timer = 0;
  const disarm = () => {
    button.dataset.armed = 'false';
    label.textContent = 'Effacer';
  };
  button.addEventListener('click', () => {
    if (button.dataset.armed === 'true') {
      window.clearTimeout(timer);
      disarm();
      app.editor.setSelection(null);
      app.simulation.clear();
      app.notify('Grille effacée');
      return;
    }
    button.dataset.armed = 'true';
    label.textContent = 'Sûr ?';
    timer = window.setTimeout(disarm, 3000);
  });
  disarm();
}

export function setupZoom(app: App): void {
  const { camera } = app;
  const slider = byId<HTMLInputElement>('zoom-slider');
  slider.addEventListener('input', () => {
    camera.setZoom(sliderToValue(Number(slider.value), MIN_ZOOM, MAX_ZOOM));
  });
  byId('zoom-in').addEventListener('click', () => camera.setZoom(camera.zoom * 1.5));
  byId('zoom-out').addEventListener('click', () => camera.setZoom(camera.zoom / 1.5));
  byId('zoom-center').addEventListener('click', () => app.editor.centerView(measureUiInsets()));

  // Le curseur suit le zoom fait à la molette ou aux doigts.
  const render = () => {
    if (document.activeElement !== slider) {
      slider.value = String(valueToSlider(camera.zoom, MIN_ZOOM, MAX_ZOOM));
    }
  };
  camera.on('change', render);
  render();
}

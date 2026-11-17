/**
 * ============================================================================
 *  toolbar.ts — Barre d'outils, bouton « menu » et bouton jour / nuit
 * ============================================================================
 *
 * Principe commun à toute l'interface : les boutons APPELLENT des méthodes
 * (setTool, toggle…), puis l'interface se met à jour en ÉCOUTANT les
 * événements (patron Observateur). On ne met jamais l'affichage à jour « à la
 * main » dans le clic : ainsi le bouton reste juste même si l'outil change
 * depuis le clavier.
 */

import type { App } from '../app';
import { strokeAllows, STROKES, type StrokeKind } from '../core/strokes';
import { MAX_BRUSH_SIZE, MAX_ERASER_SIZE, MIN_BRUSH_SIZE, MIN_ERASER_SIZE } from '../input/editor';
import type { ToolId } from '../input/tools';
import { byId, el } from './dom';

export function setupToolbar(app: App): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-tool]')];
  for (const button of buttons) {
    button.addEventListener('click', () => app.editor.setTool(button.dataset.tool as ToolId));
  }
  const render = (tool: ToolId) => {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    }
  };
  app.editor.on('tool', render);
  render(app.editor.tool.id);
}

/**
 * Les petits panneaux de réglage du crayon et de la gomme (ils apparaissent au
 * survol de l'icône, voir .tool-options dans styles.css) :
 *   - crayon : épaisseur (nombre de cellules posées d'un coup) ; avec les options
 *     avancées, en plus : le type de trait (plein, damier, points…) ;
 *   - gomme : taille.
 * Comme partout : un réglage APPELLE l'éditeur, et l'affichage se met à jour en
 * ÉCOUTANT ses événements (la valeur reste juste quelle que soit l'origine du changement).
 */
export function setupToolOptions(app: App): void {
  const { editor } = app;

  /** Branche un slider (valeur affichée à côté) sur un réglage de l'éditeur. */
  const bindSlider = (
    sliderId: string,
    valueId: string,
    range: { min: number; max: number },
    get: () => number,
    set: (value: number) => void,
    onChange: (listener: (value: number) => void) => void,
  ) => {
    const slider = byId<HTMLInputElement>(sliderId);
    const value = byId<HTMLOutputElement>(valueId);
    slider.min = String(range.min);
    slider.max = String(range.max);
    slider.addEventListener('input', () => set(Number(slider.value)));
    const render = (size: number) => {
      slider.value = String(size);
      value.textContent = String(size);
      slider.setAttribute('aria-valuetext', size === 1 ? '1 case' : `${size} cases`);
    };
    onChange(render);
    render(get());
  };
  bindSlider('eraser-size', 'eraser-size-value', { min: MIN_ERASER_SIZE, max: MAX_ERASER_SIZE },
    () => editor.eraserSize, (v) => editor.setEraserSize(v), (l) => editor.on('eraserSize', l));
  bindSlider('brush-size', 'brush-size-value', { min: MIN_BRUSH_SIZE, max: MAX_BRUSH_SIZE },
    () => editor.brushSize, (v) => editor.setBrushSize(v), (l) => editor.on('brushSize', l));

  // Type de trait : une rangée de petits boutons, chacun dessiné avec son propre motif.
  const picker = byId('stroke-picker');
  const strokeButtons = STROKES.map((stroke) => {
    const button = el('button', {
      class: 'icon-btn small',
      type: 'button',
      title: `Trait : ${stroke.label}`,
      'aria-label': `Trait ${stroke.label}`,
    }, [strokeIcon(stroke.id)]);
    button.addEventListener('click', () => editor.setStroke(stroke.id));
    picker.append(button);
    return { id: stroke.id, button };
  });
  const renderStroke = (kind: StrokeKind) => {
    for (const { id, button } of strokeButtons) button.setAttribute('aria-pressed', String(id === kind));
  };
  editor.on('stroke', renderStroke);
  renderStroke(editor.stroke);

  // Options avancées : montrent le type de trait et les boutons Annuler / Rétablir.
  const separator = byId('history-sep');
  const undo = byId<HTMLButtonElement>('tool-undo');
  const redo = byId<HTMLButtonElement>('tool-redo');
  const renderAdvanced = () => {
    const advanced = app.viewSettings.advancedVisible;
    picker.hidden = !advanced;
    separator.hidden = !advanced;
    undo.hidden = !advanced;
    redo.hidden = !advanced;
    // Options avancées coupées : on revient au trait plein (sinon le crayon ferait des trous « invisibles »).
    if (!advanced) editor.setStroke('solid');
  };
  app.viewSettings.on('change', renderAdvanced);
  renderAdvanced();

  undo.addEventListener('click', () => editor.undo());
  redo.addEventListener('click', () => editor.redo());
  // Grisés quand il n'y a rien à annuler / rétablir.
  const renderHistory = (state: { canUndo: boolean; canRedo: boolean }) => {
    undo.disabled = !state.canUndo;
    redo.disabled = !state.canRedo;
  };
  editor.on('history', renderHistory);
  renderHistory({ canUndo: editor.canUndo, canRedo: editor.canRedo });
}

/**
 * Petit dessin d'un type de trait : une grille de 6 × 6 cases où l'on colorie
 * celles que ce trait remplirait (même fonction que le crayon : strokeAllows).
 * Le bouton montre donc exactement ce qu'il va dessiner.
 */
function strokeIcon(kind: StrokeKind): SVGSVGElement {
  const SIZE = 6;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('aria-hidden', 'true');
  let d = '';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) if (strokeAllows(kind, x, y)) d += `M${x} ${y}h1v1h-1z`;
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/**
 * L'œil (en haut à droite) affiche ou masque toute l'interface ; le bouton
 * jour / nuit est juste à sa gauche. Le bouton Options (≡) est géré par options.ts.
 * Renvoie de quoi afficher / masquer l'interface depuis le clavier (touche M) ou le didacticiel.
 */
export function setupMenu(app: App): { toggleMenu: () => void; showMenu: () => void } {
  const ui = byId('ui');
  const eyeButton = byId<HTMLButtonElement>('eye-toggle');
  const themeButton = byId<HTMLButtonElement>('theme-toggle');

  const setMenuVisible = (visible: boolean) => {
    ui.classList.toggle('is-hidden', !visible);
    ui.inert = !visible; // les panneaux cachés ne reçoivent plus le clavier
    eyeButton.setAttribute('aria-pressed', String(visible)); // « enfoncé » = interface affichée
  };
  const toggleMenu = () => setMenuVisible(ui.classList.contains('is-hidden'));
  const showMenu = () => setMenuVisible(true);
  eyeButton.addEventListener('click', toggleMenu);

  themeButton.addEventListener('click', () => app.theme.toggle());
  const renderTheme = () => {
    const label = app.theme.name === 'night' ? 'Passer en mode jour (N)' : 'Passer en mode nuit (N)';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  };
  app.theme.on('change', renderTheme);
  renderTheme();

  setMenuVisible(true);
  return { toggleMenu, showMenu };
}

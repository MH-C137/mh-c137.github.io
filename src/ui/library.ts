/**
 * ============================================================================
 *  library.ts — Panneau de droite : structures (glisser-déposer) et images
 * ============================================================================
 *
 * Glisser-déposer « fait maison » avec les Pointer Events (plutôt que l'API
 * HTML5 drag & drop) : on peut ainsi afficher un aperçu aligné sur la grille
 * pendant le glissement, et ça marche aussi au doigt sur tablette.
 *
 *   appui sur une carte ──► le pointeur bouge de plus de 6 px ? ──► c'est un glisser :
 *        │                                                         l'aperçu suit le pointeur,
 *        │                                                         lâcher sur la grille = poser.
 *        └──► relâché sans bouger : c'est un clic → mode Tampon (cliquer sur la grille pour poser).
 */

import type { App } from '../app';
import { CATEGORY_ORDER, type PatternEntry } from '../data/patterns';
import { drawPatternThumbnail } from '../render/thumbnail';
import { importFiles } from './actions';
import { byId, el } from './dom';

/** Distance (px) à partir de laquelle un appui devient un glisser. */
const DRAG_THRESHOLD = 6;

export function setupLibrary(app: App): void {
  const panel = byId('library');
  const toggle = byId<HTMLButtonElement>('library-toggle');
  const list = byId('pattern-list');
  const canvas = byId<HTMLCanvasElement>('world');
  const thumbnails: Array<{ canvas: HTMLCanvasElement; entry: PatternEntry }> = [];

  // Replier / déplier le panneau (replié par défaut sur petit écran).
  const setCollapsed = (collapsed: boolean) => {
    panel.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? 'Déplier le panneau' : 'Replier le panneau';
  };
  toggle.addEventListener('click', () => setCollapsed(!panel.classList.contains('is-collapsed')));
  setCollapsed(window.matchMedia('(max-width: 800px)').matches);

  /** Le pointeur est-il au-dessus de la grille (et pas d'un panneau) ? */
  const isOverGrid = (event: PointerEvent) => document.elementFromPoint(event.clientX, event.clientY) === canvas;
  const toCanvas = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  /** Crée une carte cliquable / glissable pour une structure. */
  const createCard = (entry: PatternEntry): HTMLButtonElement => {
    const thumbnail = el('canvas', { class: 'pattern-thumb', 'aria-hidden': 'true' });
    const card = el('button', { class: 'pattern-card', type: 'button', title: entry.description }, [
      thumbnail,
      el('span', { class: 'pattern-name' }, [entry.name]),
    ]);
    thumbnails.push({ canvas: thumbnail, entry });

    card.addEventListener('pointerdown', (down) => {
      if (down.button !== 0) return;
      down.preventDefault();
      card.setPointerCapture(down.pointerId);
      let dragging = false;

      const onMove = (move: PointerEvent) => {
        if (!dragging && Math.hypot(move.clientX - down.clientX, move.clientY - down.clientY) > DRAG_THRESHOLD) {
          dragging = true;
          app.editor.beginDrag(entry.pattern);
          document.body.classList.add('is-dragging');
        }
        if (dragging) {
          const point = toCanvas(move);
          app.editor.dragTo(point.x, point.y, isOverGrid(move));
        }
      };
      const finish = (up: PointerEvent, cancelled: boolean) => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerup', onUp);
        card.removeEventListener('pointercancel', onCancel);
        document.body.classList.remove('is-dragging');
        if (dragging) {
          const point = toCanvas(up);
          app.editor.endDrag(point.x, point.y, !cancelled && isOverGrid(up));
        } else if (!cancelled) {
          app.editor.startStamp(entry.pattern);
        }
      };
      const onUp = (up: PointerEvent) => finish(up, false);
      const onCancel = (cancel: PointerEvent) => finish(cancel, true);
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerup', onUp);
      card.addEventListener('pointercancel', onCancel);
    });
    return card;
  };

  const redrawThumbnails = () => {
    for (const { canvas: thumbnail, entry } of thumbnails) {
      drawPatternThumbnail(thumbnail, entry.pattern, app.theme.palette);
    }
  };

  /** (Re)construit la liste, regroupée par catégorie. */
  const renderPatterns = () => {
    thumbnails.length = 0;
    list.replaceChildren();
    const entries = app.library.entries();
    for (const category of CATEGORY_ORDER) {
      const inCategory = entries.filter((entry) => entry.category === category);
      if (inCategory.length === 0) continue;
      list.append(
        el('h3', {}, [category]),
        el('div', { class: 'pattern-grid' }, inCategory.map(createCard)),
      );
    }
    redrawThumbnails();
  };

  app.library.on('change', renderPatterns);
  app.theme.on('change', redrawThumbnails);
  toggle.addEventListener('click', () => requestAnimationFrame(redrawThumbnails));
  renderPatterns();
  setupImages(app);
}

/** Section « Images » : importer, choisir l'image du pinceau. */
function setupImages(app: App): void {
  const container = byId('image-list');
  const input = byId<HTMLInputElement>('image-input');
  byId('image-add').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files) void importFiles(app, [...input.files]);
    input.value = ''; // permet de réimporter le même fichier
  });

  const chip = (id: number, label: string, content: Node) => {
    const button = el('button', {
      class: 'image-chip',
      type: 'button',
      title: label,
      'aria-label': label,
      'aria-pressed': String(app.images.current === id),
    }, [content]);
    button.addEventListener('click', () => {
      app.images.current = id;
    });
    return button;
  };

  const render = () => {
    container.replaceChildren(
      chip(0, 'Sans image (néon)', el('span', { class: 'neon-swatch' })),
      ...app.images.list().map((image) =>
        chip(image.id, image.name, el('img', { src: image.thumbnailUrl, alt: '' })),
      ),
    );
  };
  app.images.on('change', render);
  render();
}

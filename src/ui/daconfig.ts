/**
 * ============================================================================
 *  daconfig.ts — Le panneau « Config DA » : personnaliser l'apparence dans le site
 * ============================================================================
 *
 * Pour essayer des couleurs et des styles DIRECTEMENT dans le site (options avancées →
 * « Config DA »), séparément pour le mode nuit et le mode jour :
 *   - quadrillage : lignes ou croix, et leurs couleurs ;
 *   - fond : aucun, constellation (ciel d'étoiles fixe) ou image de la DA (recolorée), couleur
 *     des étoiles, couleur et transparence de la « vitre » ;
 *   - cellules : née, vivante, clignote, vient de mourir (+ sélection et gomme) ;
 *   - interface : fond, panneaux, boutons, légende, textes, bordures, détails…
 *
 * Les réglages se posent PAR-DESSUS la DA (ils ne modifient pas da.json), sont retenus dans
 * le navigateur, et « Copier la config » les donne au format de da.json : on garde ainsi ce qui
 * plaît en le recopiant dans le fichier de la DA.
 *
 * Comme partout : un contrôle APPELLE `design.setXxx(...)`, et l'affichage se met à jour en
 * ÉCOUTANT les événements (changement de thème, changement de réglage).
 */

import type { App } from '../app';
import { alphaOf, colorWithAlpha, hexOf, recolor } from '../da/overrides';
import type { BackgroundStyle, CellColorKey, GridStyle, UiColorKey } from '../da/schema';
import type { ThemeName } from '../render/theme';
import { byId, el } from './dom';

export interface DaConfig {
  /** Ouvre ou ferme le panneau. */
  toggle(): void;
}

/** Une couleur réglable : où elle vit dans la DA, son nom affiché, et si on garde sa transparence. */
interface ColorSpec {
  readonly block: 'cells' | 'interface';
  readonly key: CellColorKey | UiColorKey;
  readonly label: string;
  /** Vrai : la couleur a une transparence (lignes de la grille, vitre) ; le sélecteur ne change que la teinte. */
  readonly keepAlpha?: boolean;
}

/** Les sections du panneau, dans l'ordre d'affichage. */
const SECTIONS: ReadonlyArray<{ title: string; colors: readonly ColorSpec[] }> = [
  {
    title: 'Cellules',
    colors: [
      { block: 'cells', key: 'newborn', label: 'Vient de naître' },
      { block: 'cells', key: 'alive', label: 'Vivante' },
      { block: 'cells', key: 'pulse', label: 'Clignote' },
      { block: 'cells', key: 'trace', label: 'Vient de mourir' },
      { block: 'cells', key: 'selection', label: 'Sélection' },
      { block: 'cells', key: 'erase', label: 'Contour de la gomme' },
    ],
  },
  {
    title: 'Panneaux et boutons',
    colors: [
      { block: 'interface', key: 'surface', label: 'Panneaux (structures…)' },
      { block: 'interface', key: 'surface2', label: 'Boutons' },
      { block: 'interface', key: 'hover', label: 'Boutons survolés' },
      { block: 'interface', key: 'line', label: 'Bords des panneaux' },
      { block: 'interface', key: 'lineSoft', label: 'Bords des boutons' },
      { block: 'interface', key: 'accentFill', label: 'Bouton actif' },
      { block: 'interface', key: 'onAccent', label: 'Texte du bouton actif' },
      { block: 'interface', key: 'accentSoft', label: 'Image choisie (fond)' },
    ],
  },
  {
    title: 'Textes',
    colors: [
      { block: 'interface', key: 'fg', label: 'Écriture' },
      { block: 'interface', key: 'muted', label: 'Écriture discrète' },
      { block: 'interface', key: 'accent', label: 'Titres et détails' },
      { block: 'interface', key: 'danger', label: 'Alerte (Effacer)' },
    ],
  },
  {
    title: 'Légende et titre',
    colors: [
      { block: 'interface', key: 'titleBg', label: 'Fond de la légende' },
      { block: 'interface', key: 'titleFg', label: 'Écriture de la légende' },
      { block: 'interface', key: 'titleLine', label: 'Bord de la légende' },
    ],
  },
  {
    title: 'Page',
    colors: [{ block: 'interface', key: 'bg', label: 'Fond de la page' }],
  },
];

const GRID_CHOICES: ReadonlyArray<readonly [GridStyle, string]> = [
  ['lines', 'Lignes'],
  ['crosses', 'Croix'],
];
const BACKGROUND_CHOICES: ReadonlyArray<readonly [BackgroundStyle, string]> = [
  ['none', 'Aucun'],
  ['constellation', 'Constellation'],
  ['image', 'Image'],
];

export function setupDaConfig(app: App): DaConfig {
  const { design, theme } = app;
  const panel = byId('da-config');
  const body = byId('da-body');
  const tabNight = byId<HTMLButtonElement>('da-tab-night');
  const tabDay = byId<HTMLButtonElement>('da-tab-day');
  const copyButton = byId<HTMLButtonElement>('da-copy');
  const resetButton = byId<HTMLButtonElement>('da-reset');

  /** Fonctions qui remettent chaque contrôle à jour (changement de thème, de réglage…). */
  const refreshers: Array<() => void> = [];

  // Les couleurs de la palette de la DA : proposées par les sélecteurs de couleur (là où le navigateur le permet).
  const datalist = el('datalist', { id: 'da-palette' }, design.design.pack.palette.map((color) => el('option', { value: color })));

  /** Une ligne « nom + sélecteur de couleur ». */
  const colorRow = (spec: ColorSpec): HTMLElement => {
    const input = el('input', { type: 'color', list: 'da-palette', 'aria-label': spec.label });
    const read = () => design.effective(theme.name)[spec.block][spec.key as never] as string;
    input.addEventListener('input', () => {
      const value = spec.keepAlpha ? recolor(read(), input.value) : input.value;
      if (spec.block === 'cells') design.setCellColor(theme.name, spec.key as CellColorKey, value);
      else design.setInterfaceColor(theme.name, spec.key as UiColorKey, value);
    });
    // On ne touche pas au sélecteur pendant qu'on le manipule (sinon il « saute » sous la souris).
    refreshers.push(() => {
      if (document.activeElement !== input) input.value = hexOf(read());
    });
    return el('label', { class: 'da-row' }, [el('span', {}, [spec.label]), input]);
  };

  /** Une rangée de boutons « un seul choix » (quadrillage, fond). */
  const choiceRow = <T extends string>(
    label: string,
    choices: ReadonlyArray<readonly [T, string]>,
    current: () => T,
    choose: (value: T) => void,
    enabled: (value: T) => boolean = () => true,
  ): HTMLElement => {
    const buttons = choices.map(([value, text]) => {
      const button = el('button', { class: 'text-btn', type: 'button' }, [text]);
      button.addEventListener('click', () => choose(value));
      return { value, button };
    });
    refreshers.push(() => {
      for (const { value, button } of buttons) {
        button.setAttribute('aria-pressed', String(value === current()));
        button.disabled = !enabled(value);
      }
    });
    return el('div', { class: 'da-choice' }, [el('span', {}, [label]), el('div', { class: 'da-choice-buttons' }, buttons.map((b) => b.button))]);
  };

  /** Réglage de la transparence de la vitre (la teinte se règle avec le sélecteur de couleur). */
  const glassOpacity = (): HTMLElement => {
    const slider = el('input', { type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Opacité de la vitre' });
    const value = el('output', {});
    slider.addEventListener('input', () => {
      const glass = design.effective(theme.name).cells.glass;
      design.setCellColor(theme.name, 'glass', colorWithAlpha(hexOf(glass), Number(slider.value) / 100));
    });
    refreshers.push(() => {
      const percent = Math.round(alphaOf(design.effective(theme.name).cells.glass) * 100);
      if (document.activeElement !== slider) slider.value = String(percent);
      value.textContent = `${slider.value} %`;
    });
    slider.addEventListener('input', () => (value.textContent = `${slider.value} %`));
    return el('label', { class: 'da-row' }, [el('span', {}, ['Opacité de la vitre']), el('span', { class: 'da-slider' }, [slider, value])]);
  };

  /** Une section repliable. */
  const section = (title: string, rows: HTMLElement[], open = false): HTMLElement =>
    el('details', open ? { class: 'da-section', open: '' } : { class: 'da-section' }, [el('summary', {}, [title]), ...rows]);

  body.append(
    datalist,
    section(
      'Quadrillage',
      [
        choiceRow('Style', GRID_CHOICES, () => design.gridStyleOf(theme.name), (style) => design.setGridStyle(theme.name, style)),
        colorRow({ block: 'cells', key: 'grid', label: 'Lignes fines', keepAlpha: true }),
        colorRow({ block: 'cells', key: 'gridMajor', label: 'Lignes principales et croix', keepAlpha: true }),
      ],
      true,
    ),
    section(
      'Fond',
      [
        choiceRow(
          'Style',
          BACKGROUND_CHOICES,
          () => design.backgroundStyleOf(theme.name),
          (style) => design.setBackgroundStyle(theme.name, style),
          (style) => style !== 'image' || design.hasBackgroundImage(theme.name),
        ),
        colorRow({ block: 'cells', key: 'background', label: 'Couleur du fond' }),
        colorRow({ block: 'cells', key: 'stars', label: 'Couleur des étoiles' }),
        colorRow({ block: 'cells', key: 'glass', label: 'Teinte de la vitre', keepAlpha: true }),
        glassOpacity(),
      ],
      true,
    ),
    ...SECTIONS.map((s) => section(s.title, s.colors.map(colorRow), s.title === 'Cellules')),
  );

  // ── Onglets nuit / jour : ils changent aussi le thème affiché, pour voir tout de suite l'effet. ──
  const tab = (button: HTMLButtonElement, name: ThemeName) => button.addEventListener('click', () => theme.set(name));
  tab(tabNight, 'night');
  tab(tabDay, 'day');

  const refresh = () => {
    tabNight.setAttribute('aria-pressed', String(theme.name === 'night'));
    tabDay.setAttribute('aria-pressed', String(theme.name === 'day'));
    resetButton.textContent = theme.name === 'night' ? 'Remettre le mode nuit' : 'Remettre le mode jour';
    resetButton.disabled = !design.hasOverrides(theme.name);
    for (const refresher of refreshers) refresher();
  };
  theme.on('change', refresh);
  design.on('change', refresh);
  refresh();

  resetButton.addEventListener('click', () => design.resetTheme(theme.name));

  // « Copier la config » : le texte au format de da.json (à recopier dans le fichier de la DA pour garder les réglages).
  copyButton.addEventListener('click', () => {
    const json = design.exportJson();
    const done = () => app.notify('Config copiée : colle-la dans un message pour la garder');
    const fallback = () => {
      // Vieux navigateur ou iframe sans accès au presse-papiers : copie via un champ texte caché.
      const area = el('textarea', { 'aria-hidden': 'true' });
      area.value = json;
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) done();
      else {
        console.log(json);
        app.notify('Copie impossible : la config est dans la console (F12)');
      }
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(done, fallback);
    else fallback();
  });

  // ── Ouvrir / fermer ──
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    if (open) refresh();
  };
  byId('da-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden && !(event.target as Element).closest?.('#da-config input')) setOpen(false);
  });
  // Options avancées coupées : le panneau se ferme (les réglages déjà faits restent appliqués).
  app.viewSettings.on('change', () => {
    if (!app.viewSettings.advancedVisible) setOpen(false);
  });

  return { toggle: () => setOpen(panel.hidden === true) };
}

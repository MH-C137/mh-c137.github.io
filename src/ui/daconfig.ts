/**
 * ============================================================================
 *  daconfig.ts — Le panneau « Config DA » : personnaliser l'apparence dans le site
 * ============================================================================
 *
 * Pour essayer des styles DIRECTEMENT dans le site (options avancées → « Config DA »),
 * séparément pour le mode nuit et le mode jour. Le panneau est volontairement SIMPLE :
 *   - on choisit des RÔLES (page, panneaux, légende, écriture, détails, bords, cellules,
 *     étoiles, fond des pastilles) parmi les couleurs de la PALETTE de la DA : ce sont les
 *     seules proposées, elles correspondent à de vraies couleurs de la charte ;
 *   - le site DÉDUIT les nuances qui en dépendent (boutons un peu plus clairs, texte lisible
 *     sur le bouton actif, titres éclaircis…), voir src/da/derive.ts ;
 *   - on choisit aussi le style du quadrillage, le fond et l'opacité de la « vitre » ;
 *   - tout en bas, « Réglages détaillés » garde un sélecteur de couleur par élément, pour les
 *     cas particuliers.
 *
 * Les réglages se posent PAR-DESSUS la DA (ils ne modifient pas da.json), sont retenus dans le
 * navigateur, et « Copier la config » les donne au format de da.json (les couleurs déduites
 * comprises) : on garde ainsi ce qui plaît en le recopiant dans le fichier de la DA.
 *
 * Comme partout : un contrôle APPELLE `design.setXxx(...)`, et l'affichage se met à jour en
 * ÉCOUTANT les événements (changement de thème, changement de réglage).
 */

import type { App } from '../app';
import { bestOn } from '../da/derive';
import { alphaOf, colorWithAlpha, hexOf, recolor } from '../da/overrides';
import type { BackgroundStyle, CellColorKey, GridStyle, RoleKey, UiColorKey } from '../da/schema';
import type { ThemeName } from '../render/theme';
import { collectDiagnostic } from './diagnostic';
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
      { block: 'cells', key: 'tile', label: 'Fond des pastilles' },
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
      { block: 'interface', key: 'titleInk', label: 'Couleur du titre' },
    ],
  },
  {
    title: 'Page',
    colors: [{ block: 'interface', key: 'bg', label: 'Fond de la page' }],
  },
];

/** Les rôles proposés, dans l'ordre d'affichage (nom, explication courte). */
const ROLE_ROWS: ReadonlyArray<{ title: string; roles: ReadonlyArray<readonly [RoleKey, string]> }> = [
  {
    title: 'Interface',
    roles: [
      ['page', 'Fond de la page'],
      ['panels', 'Panneaux et boutons'],
      ['legend', 'Fond de la légende'],
      ['title', 'Titre (« Nova »)'],
      ['text', 'Écriture'],
      ['details', 'Détails (titres, bouton actif)'],
      ['borders', 'Bords'],
    ],
  },
  {
    title: 'Cellules et fond',
    roles: [
      ['newborn', 'Cellule qui vient de naître'],
      ['alive', 'Cellule vivante'],
      ['stars', 'Étoiles du fond'],
      ['tile', 'Carré derrière légende et miniatures'],
    ],
  },
];

/** « Aucune couleur » (transparente) : la pastille « Aucun » du carré derrière les pastilles. */
const NO_COLOR = 'rgba(0, 0, 0, 0)';

/** Les choix du quadrillage : deux styles, ou « Masqué » (le même réglage que « Grille » dans Options). */
const GRID_CHOICES: ReadonlyArray<readonly [GridStyle | 'hidden', string]> = [
  ['lines', 'Lignes'],
  ['crosses', 'Croix'],
  ['hidden', 'Masqué'],
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
  const resetAllButton = byId<HTMLButtonElement>('da-reset-all');

  /** Fonctions qui remettent chaque contrôle à jour (changement de thème, de réglage…). */
  const refreshers: Array<() => void> = [];

  const palette = design.design.pack.palette;

  /**
   * Une ligne « rôle » : son nom, puis une pastille par couleur de la palette de la DA. La pastille
   * choisie est entourée ; un clic choisit cette couleur pour le rôle (le site déduit le reste).
   */
  const roleRow = (role: RoleKey, label: string): HTMLElement => {
    // Le carré derrière la légende et les miniatures est FACULTATIF : une première pastille « Aucun » (transparente).
    const options = role === 'tile' ? [{ name: 'Aucun', color: NO_COLOR }, ...palette] : palette;
    const chips = options.map(({ name, color }) => {
      const chip = el('button', { class: color === NO_COLOR ? 'da-chip da-chip-none' : 'da-chip', type: 'button', title: name, 'aria-label': `${label} : ${name}` });
      if (color !== NO_COLOR) chip.style.background = color;
      chip.addEventListener('click', () => design.setRole(theme.name, role, color));
      return { color, chip };
    });
    // Première pastille : « Défaut » = la couleur de la DA. Elle permet de revenir en arrière après un choix.
    const defaultColor = design.defaultRoleColor(theme.name, role);
    const defaultNone = alphaOf(defaultColor) === 0;
    const defaultChip = el('button', {
      class: defaultNone ? 'da-chip da-chip-default da-chip-none' : 'da-chip da-chip-default',
      type: 'button',
      title: 'Revenir à la couleur de la DA',
      'aria-label': `${label} : couleur par défaut`,
    }, ['Défaut']);
    if (!defaultNone) {
      defaultChip.style.background = defaultColor;
      defaultChip.style.color = bestOn(defaultColor, ['#ffffff', '#000000']); // écriture lisible sur cette couleur
    }
    defaultChip.addEventListener('click', () => design.clearRole(theme.name, role));
    refreshers.push(() => {
      // Une seule pastille est entourée : « Défaut » tant que rien n'est choisi, sinon la couleur choisie.
      const isSet = design.roleIsSet(theme.name, role);
      defaultChip.setAttribute('aria-pressed', String(!isSet));
      const current = design.roleColor(theme.name, role).toLowerCase();
      const none = alphaOf(current) === 0; // une couleur sans opacité = « Aucun »
      for (const { color, chip } of chips) {
        chip.setAttribute('aria-pressed', String(isSet && (color === NO_COLOR ? none : !none && color.toLowerCase() === current)));
      }
    });
    return el('div', { class: 'da-role' }, [el('span', {}, [label]), el('div', { class: 'da-chips' }, [defaultChip, ...chips.map((c) => c.chip)])]);
  };

  /** Une ligne « nom + sélecteur de couleur ». */
  const colorRow = (spec: ColorSpec): HTMLElement => {
    const input = el('input', { type: 'color', 'aria-label': spec.label });
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

  /**
   * Un curseur d'opacité (en %). `read` donne la valeur actuelle (0 à 1), `write` l'applique.
   * Le curseur se remet à jour tout seul quand les réglages changent (sauf pendant qu'on le glisse).
   */
  const opacitySlider = (label: string, min: number, read: () => number, write: (opacity: number) => void): HTMLElement => {
    const slider = el('input', { type: 'range', min: String(min), max: '100', step: '1', 'aria-label': label });
    const value = el('output', {});
    slider.addEventListener('input', () => {
      value.textContent = `${slider.value} %`;
      write(Number(slider.value) / 100);
    });
    refreshers.push(() => {
      if (document.activeElement !== slider) slider.value = String(Math.max(min, Math.round(read() * 100)));
      value.textContent = `${slider.value} %`;
    });
    return el('label', { class: 'da-row' }, [el('span', {}, [label]), el('span', { class: 'da-slider' }, [slider, value])]);
  };

  /** Transparence de la vitre (sa teinte se règle avec le sélecteur de couleur). */
  const glassOpacity = (): HTMLElement =>
    opacitySlider(
      'Opacité de la vitre',
      0,
      () => alphaOf(design.effective(theme.name).cells.glass),
      (opacity) => design.setCellColor(theme.name, 'glass', colorWithAlpha(hexOf(design.effective(theme.name).cells.glass), opacity)),
    );

  /**
   * Opacité du quadrillage : celle des lignes principales (toutes les 10 cases) et des croix. Les lignes fines
   * gardent, par rapport à elles, la proportion de la DA (ex. 0,2 contre 0,46), pour que l'allure ne change pas.
   * Minimum 5 % : pour cacher la grille, il y a « Masqué ».
   */
  const gridOpacity = (): HTMLElement =>
    opacitySlider(
      'Opacité du quadrillage',
      5,
      () => alphaOf(design.effective(theme.name).cells.gridMajor),
      (opacity) => {
        const base = design.design.pack.themes[theme.name].cells;
        const ratio = alphaOf(base.gridMajor) > 0 ? alphaOf(base.grid) / alphaOf(base.gridMajor) : 0.45;
        const current = design.effective(theme.name).cells;
        design.setCellColor(theme.name, 'gridMajor', colorWithAlpha(hexOf(current.gridMajor), opacity));
        design.setCellColor(theme.name, 'grid', colorWithAlpha(hexOf(current.grid), Math.min(1, opacity * ratio)));
      },
    );

  /** Une section repliable. */
  const section = (title: string, rows: HTMLElement[], open = false): HTMLElement =>
    el('details', open ? { class: 'da-section', open: '' } : { class: 'da-section' }, [el('summary', {}, [title]), ...rows]);

  body.append(
    ...ROLE_ROWS.map((group) =>
      section(group.title, group.roles.map(([role, label]) => roleRow(role, label)), true),
    ),
    section(
      'Quadrillage et fond',
      [
        choiceRow(
          'Quadrillage',
          GRID_CHOICES,
          () => (app.viewSettings.gridVisible ? design.gridStyleOf(theme.name) : 'hidden'),
          (choice) => {
            // « Masqué » = l'interrupteur « Grille » des Options ; un style choisi réaffiche la grille.
            if (choice === 'hidden' ? app.viewSettings.gridVisible : !app.viewSettings.gridVisible) app.viewSettings.toggleGrid();
            if (choice !== 'hidden') design.setGridStyle(theme.name, choice);
          },
        ),
        choiceRow(
          'Fond',
          BACKGROUND_CHOICES,
          () => design.backgroundStyleOf(theme.name),
          (style) => design.setBackgroundStyle(theme.name, style),
          (style) => style !== 'image' || design.hasBackgroundImage(theme.name),
        ),
        gridOpacity(),
        glassOpacity(),
      ],
      true,
    ),
    // Réglages détaillés : un sélecteur de couleur libre par élément (cas particuliers).
    el('details', { class: 'da-section da-expert' }, [
      el('summary', {}, ['Réglages détaillés (couleurs libres)']),
      ...[
        {
          title: 'Quadrillage et fond',
          colors: [
            { block: 'cells', key: 'grid', label: 'Lignes fines', keepAlpha: true },
            { block: 'cells', key: 'gridMajor', label: 'Lignes principales et croix', keepAlpha: true },
            { block: 'cells', key: 'background', label: 'Couleur du fond de la grille' },
            { block: 'cells', key: 'stars', label: 'Couleur des étoiles' },
            { block: 'cells', key: 'glass', label: 'Teinte de la vitre', keepAlpha: true },
          ] as const satisfies readonly ColorSpec[],
        },
        ...SECTIONS,
      ].flatMap((group) => [el('h3', {}, [group.title]), ...group.colors.map(colorRow)]),
    ]),
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
    resetAllButton.disabled = !design.hasOverrides('night') && !design.hasOverrides('day');
    for (const refresher of refreshers) refresher();
  };
  theme.on('change', refresh);
  design.on('change', refresh);
  refresh();

  resetButton.addEventListener('click', () => design.resetTheme(theme.name));
  resetAllButton.addEventListener('click', () => design.resetAll());

  /** Copie un texte dans le presse-papiers (avec un repli pour les navigateurs qui le refusent) puis affiche un message. */
  const copyText = (text: string, doneMessage: string) => {
    const done = () => app.notify(doneMessage);
    const fallback = () => {
      // Vieux navigateur ou iframe sans accès au presse-papiers : copie via un champ texte caché.
      const area = el('textarea', { 'aria-hidden': 'true' });
      area.value = text;
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) done();
      else {
        console.log(text);
        app.notify('Copie impossible : le texte est dans la console (F12)');
      }
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  };

  // « Copier la config » : le texte au format de da.json (à recopier dans le fichier de la DA pour garder les réglages).
  copyButton.addEventListener('click', () => copyText(design.exportJson(), 'Config copiée : colle-la dans un message pour la garder'));

  // « Copier le diagnostic » : l'état du site et du navigateur, pour comprendre un problème d'affichage.
  byId('da-diag').addEventListener('click', () => {
    void collectDiagnostic(app).then((text) => copyText(text, 'Diagnostic copié : colle-le dans un message'));
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
    refresh(); // « Grille » a pu être changée depuis les Options
  });

  return { toggle: () => setOpen(panel.hidden === true) };
}

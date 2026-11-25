/**
 * ============================================================================
 *  runtime.ts — Appliquer une DA à la page
 * ============================================================================
 *
 * Reçoit la DA choisie (voir registry.ts) et la « branche » :
 *   - une fois au démarrage (`applyStatic`) : polices, tailles de texte, style des cadres,
 *     titre, forme des cellules (icône), style du quadrillage ;
 *   - à chaque changement de thème jour / nuit (`applyTheme`) : couleurs de l'interface,
 *     image du titre, image de fond.
 *
 * Les couleurs de l'interface passent par des VARIABLES CSS posées sur <body> (--surface,
 * --accent…) : toute la feuille de style styles.css les utilise déjà, rien d'autre à
 * toucher. Les attributs `data-frame`, `data-title`, `data-cell-shape` sur <body> permettent
 * à styles.css de s'adapter (cadres plats ou en escalier, titre en image ou en texte…).
 */

import { Emitter } from '../core/events';
import { Constellation } from '../render/constellation';
import type { Renderer } from '../render/renderer';
import type { Palette, ThemeName } from '../render/theme';
import type { LoadedDesign } from './registry';
import {
  applyOverrides,
  effectiveBackground,
  effectiveGrid,
  isEmptyOverrides,
  overridesToJson,
  parseOverrides,
  type DesignOverrides,
  type ThemeOverrides,
} from './overrides';
import { paletteOf, UI_COLOR_KEYS, type BackgroundStyle, type CellColorKey, type DesignTheme, type GridStyle, type UiColorKey } from './schema';

/** Délai (ms) avant d'appliquer un réglage : un sélecteur de couleur envoie des dizaines de valeurs par seconde, on attend la dernière. */
const APPLY_DELAY_MS = 70;

/** `surface2` → `--surface-2`, `onAccent` → `--on-accent` (les noms des variables CSS). */
function cssVariable(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').replace(/(\d)/, '-$1').toLowerCase()}`;
}

export class DesignRuntime extends Emitter<{ change: void }> {
  private readonly images = new Map<string, Promise<HTMLImageElement | null>>();
  /** Le fond d'étoiles (DA « constellation »), créé quand l'icône des cellules est chargée. */
  private constellation: Constellation | null = null;
  private iconReady = false;
  private currentTheme: ThemeName | null = null;
  /** Les réglages de l'outil « Config DA » (par-dessus la DA), séparés pour la nuit et le jour. */
  private overrides: DesignOverrides = { night: {}, day: {} };
  private timer = 0;

  constructor(
    readonly design: LoadedDesign,
    private readonly renderer: Renderer,
    private readonly invalidate: () => void,
  ) {
    super();
    this.overrides = this.load();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Réglages de l'outil « Config DA »
  // ──────────────────────────────────────────────────────────────────────────

  private get storageKey(): string {
    return `jeu-de-la-vie:da:${this.design.id}`;
  }

  /** Relit les réglages retenus par le navigateur (avec vérification : le stockage peut contenir n'importe quoi). */
  private load(): DesignOverrides {
    try {
      return parseOverrides(JSON.parse(localStorage.getItem(this.storageKey) ?? 'null'));
    } catch {
      return { night: {}, day: {} };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.overrides));
    } catch {
      // Stockage indisponible (navigation privée, iframe…) : les réglages ne seront juste pas retenus.
    }
  }

  /** Le thème tel qu'il est utilisé : la DA, avec les réglages de la personne par-dessus. */
  effective(theme: ThemeName): DesignTheme {
    return applyOverrides(this.design.pack.themes[theme], this.overrides[theme]);
  }

  /** Les réglages faits pour ce thème (vide = rien de changé). */
  overridesFor(theme: ThemeName): ThemeOverrides {
    return this.overrides[theme];
  }

  hasOverrides(theme: ThemeName): boolean {
    return !isEmptyOverrides(this.overrides[theme]);
  }

  /** Style de quadrillage / de fond réellement utilisés pour un thème. */
  gridStyleOf(theme: ThemeName): GridStyle {
    return effectiveGrid(this.design.pack, this.effective(theme));
  }

  backgroundStyleOf(theme: ThemeName): BackgroundStyle {
    return effectiveBackground(this.design.pack, this.effective(theme));
  }

  /** Vrai si la DA fournit une image de fond pour ce thème (sinon le choix « image » est impossible). */
  hasBackgroundImage(theme: ThemeName): boolean {
    return this.design.pack.themes[theme].backgroundImage !== null;
  }

  setCellColor(theme: ThemeName, key: CellColorKey, value: string): void {
    this.overrides[theme] = { ...this.overrides[theme], cells: { ...this.overrides[theme].cells, [key]: value } };
    this.changed();
  }

  setInterfaceColor(theme: ThemeName, key: UiColorKey, value: string): void {
    this.overrides[theme] = { ...this.overrides[theme], interface: { ...this.overrides[theme].interface, [key]: value } };
    this.changed();
  }

  setGridStyle(theme: ThemeName, style: GridStyle): void {
    this.overrides[theme] = { ...this.overrides[theme], gridStyle: style };
    this.changed();
  }

  setBackgroundStyle(theme: ThemeName, style: BackgroundStyle): void {
    this.overrides[theme] = { ...this.overrides[theme], backgroundStyle: style };
    this.changed();
  }

  /** Efface tous les réglages d'un thème : retour aux valeurs de la DA. */
  resetTheme(theme: ThemeName): void {
    this.overrides[theme] = {};
    this.changed();
  }

  /** Les réglages au format d'un morceau de `da.json`, pour les recopier dans le fichier de la DA. */
  exportJson(): string {
    return overridesToJson(this.overrides);
  }

  /** Retient les réglages, puis prévient (avec un petit délai : on applique la dernière valeur d'un glissement). */
  private changed(): void {
    this.save();
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.emit('change', undefined), APPLY_DELAY_MS);
  }

  /** Palette des cellules et de la grille pour un thème (celle du da.json, avec les réglages par-dessus). */
  palette(theme: ThemeName): Palette {
    return paletteOf(this.effective(theme));
  }

  /** Charge une image du dossier de la DA (null si elle est introuvable : le site continue sans). */
  private loadImage(relativePath: string): Promise<HTMLImageElement | null> {
    const url = this.design.url(relativePath);
    if (!url) {
      console.warn(`DA « ${this.design.id} » : fichier introuvable : ${relativePath}`);
      return Promise.resolve(null);
    }
    let promise = this.images.get(url);
    if (!promise) {
      promise = new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
      });
      this.images.set(url, promise);
    }
    return promise;
  }

  /** Ce qui ne change pas avec le thème : à appeler une fois, avant le premier dessin. */
  applyStatic(): void {
    const { pack, id, warnings } = this.design;
    for (const warning of warnings) console.warn(`DA « ${id} » : ${warning}`);

    const body = document.body;
    body.dataset.da = id;
    body.dataset.frame = pack.ui.frame;
    body.dataset.cellShape = pack.cells.icon ? 'icon' : 'square';
    body.style.setProperty('--font', pack.ui.fontFamily);
    body.style.setProperty('--text-scale', String(pack.ui.textScale));
    body.style.setProperty('--da-px', `${pack.ui.borderWidth}px`);
    body.style.setProperty('--title-height', `${pack.title.imageHeight}px`);
    // Place prise en haut de l'écran par la barre de titre (les panneaux dessous s'en écartent).
    const hasTitleImage = Object.values(pack.themes).some((theme) => theme.titleImage);
    body.style.setProperty('--bar-h', `${hasTitleImage ? pack.title.imageHeight + 16 : 46}px`);

    // Polices : chargées par le navigateur (FontFace) ; « swap » = le texte s'affiche tout de suite, puis change.
    for (const font of pack.fonts) {
      const url = this.design.url(font.file);
      if (!url) continue;
      const face = new FontFace(font.family, `url("${url}")`, { weight: font.weight, display: 'swap' });
      document.fonts.add(face);
      void face.load().catch(() => console.warn(`DA « ${id} » : police illisible : ${font.file}`));
    }

    // Titre (texte lu par les lecteurs d'écran, ou affiché s'il n'y a pas d'image) et nom de l'onglet.
    const titleText = document.getElementById('title-text');
    if (titleText) titleText.textContent = pack.title.text;
    document.title = pack.title.text;

    // Quadrillage et forme des cellules.
    this.renderer.backgroundOpacity = pack.background.opacity;
    if (pack.cells.icon) {
      const iconPath = pack.cells.icon;
      const url = this.design.url(iconPath);
      if (url) body.style.setProperty('--cell-icon', `url("${url}")`);
      void this.loadImage(iconPath).then((image) => {
        this.renderer.setCellIcon(image, pack.cells.scale, pack.cells.iconMinZoom, {
          traceStyle: pack.cells.traceStyle,
          outlineWidth: pack.cells.outlineWidth,
          pulseHalo: pack.cells.pulseHalo,
        });
        this.icon = image;
        this.iconReady = true;
        this.publishSwatches();
        this.refreshConstellation();
        this.invalidate();
      });
    } else {
      this.renderer.setCellIcon(null, 1, 0);
      this.iconReady = true;
      this.refreshConstellation();
    }
  }

  private icon: HTMLImageElement | null = null;

  /**
   * Met à jour les pastilles de la légende et du didacticiel (variables CSS `--sprite-…`) avec les
   * vraies images des cellules, aux couleurs actuelles : la légende est donc toujours fidèle au rendu.
   */
  private publishSwatches(): void {
    const body = document.body;
    const urls = this.renderer.swatchUrls();
    for (const kind of ['newborn', 'alive', 'trace'] as const) {
      if (urls) body.style.setProperty(`--sprite-${kind}`, `url("${urls[kind]}")`);
      else body.style.removeProperty(`--sprite-${kind}`);
    }
  }

  /**
   * (Re)dessine le fond d'étoiles dans la couleur du thème actuel. Les étoiles ont la forme de
   * l'icône des cellules (donc il faut attendre qu'elle soit chargée).
   */
  private refreshConstellation(): void {
    const { pack } = this.design;
    if (this.currentTheme === null || this.backgroundStyleOf(this.currentTheme) !== 'constellation' || !this.iconReady) {
      this.renderer.constellation = null;
      return;
    }
    this.constellation ??= new Constellation(this.icon, pack.background.density);
    this.constellation.rebuild(this.effective(this.currentTheme).cells.stars);
    this.renderer.constellation = this.constellation;
    this.invalidate();
  }

  /** Ce qui change entre le mode nuit et le mode jour (et à chaque réglage de l'outil « Config DA »). */
  applyTheme(theme: ThemeName): void {
    const current = this.effective(theme);
    const body = document.body;
    this.currentTheme = theme;

    for (const key of UI_COLOR_KEYS) body.style.setProperty(cssVariable(key), current.interface[key]);

    // Titre en image, si la DA en fournit une pour ce thème.
    const image = document.getElementById('title-image') as HTMLImageElement | null;
    const titleUrl = current.titleImage ? this.design.url(current.titleImage) : undefined;
    if (image) {
      image.hidden = !titleUrl;
      if (titleUrl) image.src = titleUrl;
    }
    body.dataset.title = titleUrl ? 'image' : 'text';

    // Quadrillage (lignes ou croix).
    this.renderer.gridStyle = this.gridStyleOf(theme);

    // Les images des cellules viennent d'être refaites avec la nouvelle palette : on met la légende à jour.
    this.publishSwatches();

    // Fond : aucun, ciel d'étoiles généré, ou image de la DA recolorée.
    const style = this.backgroundStyleOf(theme);
    this.refreshConstellation();
    if (style === 'image' && current.backgroundImage) {
      void this.loadImage(current.backgroundImage).then((loaded) => {
        // La personne a peut-être changé de thème ou de fond entre-temps : on ne pose que le fond actuel.
        if (this.currentTheme === theme && this.backgroundStyleOf(theme) === 'image') {
          this.renderer.backgroundImage = loaded ? tint(loaded, this.effective(theme).cells.stars) : null;
          this.invalidate();
        }
      });
    } else {
      this.renderer.backgroundImage = null;
      this.invalidate();
    }
  }
}

/**
 * Recolore une image : seule sa silhouette (les pixels non transparents) compte, la couleur vient
 * de `color`. C'est ainsi qu'UNE image de fond blanche donne un fond de n'importe quelle couleur
 * (`source-in` ne colore que ce qui est déjà dessiné).
 */
function tint(image: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

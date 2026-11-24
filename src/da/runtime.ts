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

import { Constellation } from '../render/constellation';
import type { Renderer } from '../render/renderer';
import type { Palette, ThemeName } from '../render/theme';
import type { LoadedDesign } from './registry';
import { paletteOf, UI_COLOR_KEYS } from './schema';

/** `surface2` → `--surface-2`, `onAccent` → `--on-accent` (les noms des variables CSS). */
function cssVariable(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').replace(/(\d)/, '-$1').toLowerCase()}`;
}

export class DesignRuntime {
  private readonly images = new Map<string, Promise<HTMLImageElement | null>>();
  /** Le fond d'étoiles (DA « constellation »), créé quand l'icône des cellules est chargée. */
  private constellation: Constellation | null = null;
  private iconReady = false;
  private currentTheme: ThemeName | null = null;

  constructor(
    readonly design: LoadedDesign,
    private readonly renderer: Renderer,
    private readonly invalidate: () => void,
  ) {}

  /** Palette des cellules et de la grille pour un thème (celle du da.json). */
  palette(theme: ThemeName): Palette {
    return paletteOf(this.design.pack.themes[theme]);
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
    this.renderer.gridStyle = pack.grid.style;
    this.renderer.backgroundOpacity = pack.background.opacity;
    this.renderer.backgroundParallax = pack.background.parallax;
    this.renderer.fadeTrail = pack.cells.fadeTrail;
    body.dataset.fade = pack.cells.fadeTrail ? 'on' : 'off';
    if (pack.cells.icon) {
      const iconPath = pack.cells.icon;
      const url = this.design.url(iconPath);
      if (url) body.style.setProperty('--cell-icon', `url("${url}")`);
      void this.loadImage(iconPath).then((image) => {
        this.renderer.setCellIcon(image, pack.cells.scale, pack.cells.iconMinZoom, {
          outlineWidth: pack.cells.outlineWidth,
          pulseHalo: pack.cells.pulseHalo,
        });
        this.icon = image;
        this.iconReady = true;
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
   * (Re)dessine le fond d'étoiles dans la couleur du thème actuel. Les étoiles ont la forme de
   * l'icône des cellules (donc il faut attendre qu'elle soit chargée).
   */
  private refreshConstellation(): void {
    const { pack } = this.design;
    if (pack.background.style !== 'constellation' || !this.iconReady || this.currentTheme === null) {
      this.renderer.constellation = null;
      return;
    }
    this.constellation ??= new Constellation(this.icon, pack.background.density);
    this.constellation.rebuild(pack.themes[this.currentTheme].cells.stars);
    this.renderer.constellation = this.constellation;
    this.invalidate();
  }

  /** Ce qui change entre le mode nuit et le mode jour. */
  applyTheme(theme: ThemeName): void {
    const { pack } = this.design;
    const current = pack.themes[theme];
    const body = document.body;

    for (const key of UI_COLOR_KEYS) body.style.setProperty(cssVariable(key), current.interface[key]);

    // Titre en image, si la DA en fournit une pour ce thème.
    const image = document.getElementById('title-image') as HTMLImageElement | null;
    const titleUrl = current.titleImage ? this.design.url(current.titleImage) : undefined;
    if (image) {
      image.hidden = !titleUrl;
      if (titleUrl) image.src = titleUrl;
    }
    body.dataset.title = titleUrl ? 'image' : 'text';

    // Fond d'étoiles dessiné par le site (si la DA le demande).
    this.currentTheme = theme;
    this.refreshConstellation();

    // Image de fond de la grille.
    if (pack.background.style === 'constellation') {
      this.renderer.backgroundImage = null;
    } else if (current.backgroundImage) {
      void this.loadImage(current.backgroundImage).then((loaded) => {
        // La personne a peut-être changé de thème entre-temps : on ne pose que l'image du thème actuel.
        if (body.dataset.theme === theme || body.dataset.theme === undefined) {
          this.renderer.backgroundImage = loaded;
          this.invalidate();
        }
      });
    } else {
      this.renderer.backgroundImage = null;
      this.invalidate();
    }
  }
}

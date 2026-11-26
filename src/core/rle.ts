/**
 * ============================================================================
 *  rle.ts — Lire et écrire le format RLE, le standard des structures du jeu de la vie
 * ============================================================================
 *
 * RLE = « Run Length Encoding » (codage par plages). C'est le format utilisé par
 * le logiciel Golly et par le wiki LifeWiki : n'importe quelle structure copiée
 * depuis LifeWiki peut être collée dans l'application.
 *
 * Exemple : le planeur
 *
 *     x = 3, y = 3, rule = B3/S23      ← en-tête : largeur, hauteur, règle
 *     bo$2bo$3o!                       ← le dessin
 *
 *   - `b` = case morte, `o` = case vivante ;
 *   - un nombre devant une lettre la répète : `3o` = trois vivantes d'affilée ;
 *   - `$` = fin de ligne (`2$` = fin de ligne + une ligne vide) ;
 *   - `!` = fin du dessin.
 *   Ligne 1 : `bo`  → .O.     Ligne 2 : `2bo` → ..O     Ligne 3 : `3o` → OOO
 *
 * L'idée de la compression : au lieu d'écrire « vivante, vivante, vivante », on
 * écrit « 3 vivantes ». Les longues plages vides coûtent presque rien.
 */

import { createPattern, type Pattern } from './pattern';

/**
 * Limites de lecture (sécurité) : un texte RLE vient souvent d'ailleurs (copié sur un forum, reçu par un ami).
 * Sans limites, `99999999999o` ferait créer des milliards de cellules et figerait l'onglet.
 *   - MAX_RLE_LENGTH : taille maximale du texte (5 millions de caractères) ;
 *   - MAX_RLE_RUN    : valeur maximale d'un nombre devant une lettre (la largeur du monde : 2^26) ;
 *   - MAX_RLE_CELLS  : nombre maximal de cellules vivantes dans une structure (2 millions).
 */
export const MAX_RLE_LENGTH = 5_000_000;
export const MAX_RLE_RUN = 2 ** 26;
export const MAX_RLE_CELLS = 2_000_000;

export interface ParsedRle {
  readonly pattern: Pattern;
  /** Règle indiquée dans l'en-tête (ex. "B3/S23"), si présente. */
  readonly rule?: string;
  /** Nom indiqué dans un commentaire `#N`, si présent. */
  readonly name?: string;
}

/**
 * Lit un texte RLE et renvoie la structure correspondante.
 *
 * Algorithme (un « automate de lecture » caractère par caractère) :
 *   1. Les lignes qui commencent par `#` sont des commentaires (`#N` = nom).
 *   2. La ligne qui commence par `x =` est l'en-tête : on y lit la règle.
 *   3. Pour le reste, on garde une position courante (x, y) et un compteur `run` :
 *        - un chiffre  → on l'ajoute au compteur (gère les nombres à plusieurs chiffres) ;
 *        - `b` ou `.`  → on avance x de `run` cases mortes ;
 *        - une autre lettre → on ajoute `run` cellules vivantes et on avance x ;
 *        - `$`         → on descend de `run` lignes et on revient à x = 0 ;
 *        - `!`         → fin.
 *      Après chaque symbole, le compteur revient à « 1 » (valeur par défaut).
 *
 * Sécurité : le texte, chaque nombre et le total de cellules sont bornés (voir MAX_RLE_*) ; un texte
 * démesuré est refusé tout de suite au lieu de figer l'onglet.
 *
 * @throws Error si le texte ne contient aucune cellule vivante, ou s'il est démesuré.
 */
export function parseRle(text: string): ParsedRle {
  if (text.length > MAX_RLE_LENGTH) throw new Error('Ce texte RLE est beaucoup trop long.');
  let rule: string | undefined;
  let name: string | undefined;
  const body: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (line.startsWith('#')) {
      if (/^#N\s/i.test(line)) name = line.slice(2).trim();
      continue;
    }
    if (/^x\s*=/i.test(line)) {
      const ruleMatch = /rule\s*=\s*([^,\s]+)/i.exec(line);
      if (ruleMatch) rule = ruleMatch[1];
      continue;
    }
    body.push(line);
  }

  const cells: Array<[number, number, number]> = [];
  let x = 0;
  let y = 0;
  let digits = '';
  parsing: for (const char of body.join('')) {
    if (char >= '0' && char <= '9') {
      digits += char;
      continue;
    }
    const run = digits === '' ? 1 : Number(digits);
    digits = '';
    if (!(run <= MAX_RLE_RUN)) throw new Error('Ce texte RLE contient un nombre démesuré.'); // attrape aussi Infinity et NaN
    switch (char) {
      case 'b':
      case '.':
        x += run;
        break;
      case '$':
        y += run;
        x = 0;
        break;
      case '!':
        break parsing;
      default:
        if (/[a-zA-Z]/.test(char)) {
          // Toute autre lettre (o, A, B…) = cellule vivante (certains fichiers
          // multi-états utilisent plusieurs lettres : on les traite comme « vivante »).
          if (cells.length + run > MAX_RLE_CELLS) throw new Error('Ce texte RLE contient trop de cellules.');
          for (let i = 0; i < run; i++) cells.push([x + i, y, 0]);
          x += run;
        }
      // Les espaces et caractères inconnus sont ignorés.
    }
  }

  if (cells.length === 0) {
    throw new Error('Ce texte RLE ne contient aucune cellule vivante.');
  }
  return { pattern: createPattern(cells), rule, name };
}

/** Vrai si un texte « ressemble » à du RLE (utile pour le copier-coller). */
export function looksLikeRle(text: string): boolean {
  const trimmed = text.trim();
  return /^x\s*=/im.test(trimmed) || /^[0-9bo$!.\s]+!\s*$/i.test(trimmed);
}

/**
 * Écrit une structure au format RLE (l'opération inverse de `parseRle`).
 *
 * Algorithme :
 *   1. Pour chaque ligne, on parcourt les cases de gauche à droite et on regroupe
 *      les cases identiques consécutives en « plages » (ex. 3 vivantes → `3o`).
 *      Les cases mortes en fin de ligne sont inutiles : on les supprime.
 *   2. Les lignes sont séparées par `$` ; plusieurs lignes vides consécutives
 *      se regroupent aussi (`3$` = fin de ligne + 2 lignes vides).
 *   3. On termine par `!`, et on coupe le texte en lignes de 70 caractères max
 *      (convention du format), sans jamais couper un symbole en deux.
 */
export function toRle(pattern: Pattern, rule = 'B3/S23'): string {
  const { width, height } = pattern;
  // On ne parcourt que les cellules vivantes (triées ligne par ligne, puis de gauche à droite) :
  // le travail ne dépend plus de la taille du rectangle. (Avant, une structure très étalée — deux
  // cellules à un million de cases l'une de l'autre — parcourait des milliards de cases vides.)
  const sorted = [...pattern.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const tokens: string[] = [];
  const pushRun = (count: number, symbol: string) => {
    tokens.push(count > 1 ? `${count}${symbol}` : symbol);
  };

  let row = 0; // ligne dont on a écrit la fin (les lignes vides avant la première comptent aussi)
  let column = 0; // première colonne pas encore écrite dans la ligne courante
  let lastX = -1;
  let lastY = -1;
  let i = 0;
  while (i < sorted.length) {
    const [startX, y] = sorted[i] as readonly [number, number, number];
    if (startX === lastX && y === lastY) {
      i++; // une même case ne compte qu'une fois
      continue;
    }
    // Plage de cellules vivantes consécutives sur la même ligne.
    let end = startX;
    let next = i + 1;
    while (next < sorted.length) {
      const [nx, ny] = sorted[next] as readonly [number, number, number];
      if (ny === y && nx === end) next++; // doublon
      else if (ny === y && nx === end + 1) {
        end = nx;
        next++;
      } else break;
    }
    if (y !== row || tokens.length === 0) {
      if (y > row) pushRun(y - row, '$'); // fin de ligne (+ lignes vides)
      row = y;
      column = 0;
    }
    if (startX > column) pushRun(startX - column, 'b'); // cases mortes avant la plage
    pushRun(end - startX + 1, 'o');
    column = end + 1;
    lastX = end;
    lastY = y;
    i = next;
  }
  tokens.push('!');

  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    if (line.length + token.length > 70) {
      lines.push(line);
      line = '';
    }
    line += token;
  }
  lines.push(line);
  return `x = ${width}, y = ${height}, rule = ${rule}\n${lines.join('\n')}\n`;
}

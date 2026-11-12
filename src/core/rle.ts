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
 * @throws Error si le texte ne contient aucune cellule vivante.
 */
export function parseRle(text: string): ParsedRle {
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
  const alive = new Set<number>();
  for (const [x, y] of pattern.cells) alive.add(y * width + x);

  const tokens: string[] = [];
  const pushRun = (count: number, symbol: string) => {
    tokens.push(count > 1 ? `${count}${symbol}` : symbol);
  };

  let pendingNewLines = 0;
  for (let y = 0; y < height; y++) {
    if (y > 0) pendingNewLines++;
    // Plages de la ligne y
    const rowTokens: Array<[number, string]> = [];
    let current = '';
    let count = 0;
    for (let x = 0; x < width; x++) {
      const symbol = alive.has(y * width + x) ? 'o' : 'b';
      if (symbol === current) {
        count++;
      } else {
        if (count > 0) rowTokens.push([count, current]);
        current = symbol;
        count = 1;
      }
    }
    if (count > 0 && current === 'o') rowTokens.push([count, current]); // les 'b' finaux sont omis
    if (rowTokens.length === 0) continue; // ligne vide : on la compte dans pendingNewLines
    if (pendingNewLines > 0) pushRun(pendingNewLines, '$');
    pendingNewLines = 0;
    for (const [n, symbol] of rowTokens) pushRun(n, symbol);
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

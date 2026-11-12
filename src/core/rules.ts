/**
 * ============================================================================
 *  rules.ts — Les règles d'évolution, en notation « B/S »
 * ============================================================================
 *
 * Le jeu de la vie de Conway s'écrit « B3/S23 » :
 *   - B (Birth, naissance)   : une cellule MORTE avec exactement 3 voisines vivantes naît ;
 *   - S (Survival, survie)   : une cellule VIVANTE avec 2 ou 3 voisines vivantes survit ;
 *   - dans tous les autres cas, la cellule est (ou reste) morte.
 *
 * Changer ces chiffres donne d'autres « univers » (HighLife, Seeds, Day & Night…).
 * C'est le patron de conception STRATÉGIE : le moteur (world.ts) ne connaît pas
 * la règle en dur, il consulte un objet `Rule` interchangeable.
 *
 * Représentation : deux tableaux de 9 booléens (indices 0 à 8 = nombre de voisines).
 *   birth[3] === true     → « une morte avec 3 voisines naît »
 *   survival[2] === true  → « une vivante avec 2 voisines survit »
 * Appliquer la règle revient donc à lire une case de tableau : coût constant, O(1).
 */

export interface Rule {
  /** Écriture lisible de la règle, ex. "B3/S23". */
  readonly notation: string;
  /** birth[n] : une cellule morte avec n voisines vivantes naît-elle ? */
  readonly birth: readonly boolean[];
  /** survival[n] : une cellule vivante avec n voisines vivantes survit-elle ? */
  readonly survival: readonly boolean[];
}

/**
 * Lit une règle écrite en notation B/S (ex. "B3/S23", "b36/s23", "B2/S").
 *
 * Algorithme : on cherche les deux parties (B… et S…) avec une expression
 * régulière, puis chaque chiffre trouvé met à `true` la case correspondante.
 *
 * @throws Error si le texte n'est pas une règle valide.
 */
export function parseRule(text: string): Rule {
  const match = /^\s*B([0-8]*)\s*\/\s*S([0-8]*)\s*$/i.exec(text);
  if (!match) {
    throw new Error(`Règle invalide : « ${text} » (exemple attendu : B3/S23)`);
  }
  const birth = new Array<boolean>(9).fill(false);
  const survival = new Array<boolean>(9).fill(false);
  for (const digit of match[1] ?? '') birth[Number(digit)] = true;
  for (const digit of match[2] ?? '') survival[Number(digit)] = true;

  // B0 voudrait dire « une case morte sans aucune voisine naît » : TOUTES les cases
  // vides de l'univers infini naîtraient en même temps. Impossible à simuler ici.
  if (birth[0]) {
    throw new Error('Les règles avec B0 ne sont pas gérées (elles rempliraient le monde infini).');
  }

  const digits = (table: boolean[]) =>
    table.map((on, n) => (on ? String(n) : '')).join('');
  return { notation: `B${digits(birth)}/S${digits(survival)}`, birth, survival };
}

/** La règle de Conway, celle du « vrai » jeu de la vie. */
export const CONWAY: Rule = parseRule('B3/S23');

/**
 * Quelques variantes célèbres, prêtes pour une future option « changer de règle ».
 * (Pas encore exposées dans l'interface : c'est préparé pour la suite.)
 */
export const RULE_PRESETS: ReadonlyArray<{ name: string; rule: Rule }> = [
  { name: 'Jeu de la vie (Conway)', rule: CONWAY },
  { name: 'HighLife', rule: parseRule('B36/S23') },
  { name: 'Seeds', rule: parseRule('B2/S') },
  { name: 'Day & Night', rule: parseRule('B3678/S34678') },
];

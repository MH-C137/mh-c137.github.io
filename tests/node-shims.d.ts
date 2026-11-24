/**
 * Types minimaux pour les quelques fonctions de Node utilisées par les tests (on n'ajoute
 * pas la dépendance @types/node juste pour ça).
 */
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ name: string; isDirectory(): boolean }>;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare const __dirname: string;

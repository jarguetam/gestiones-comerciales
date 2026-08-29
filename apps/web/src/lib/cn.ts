/** Concatena clases Tailwind, ignorando falsy. Sin dependencia extra (clsx). */
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ')
}

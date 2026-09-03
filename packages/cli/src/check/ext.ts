/** Extensions the detector suite considers CSS-shaped. Deliberately excludes
 * .tsx/.jsx/.vue/.svelte and friends: those need real parsing to safely
 * separate style text from application code (styled-components template
 * literals sit inside arbitrary JS braces, inline style objects use
 * camelCase), and a regex/brace scanner over them would either miss most
 * real CSS or false-positive on unrelated code. Scoping to plain
 * stylesheets keeps every detector's false-positive rate near zero at the
 * cost of not seeing CSS-in-JS — see the check report for the tradeoff. */
export const CSS_EXTENSIONS = ['.css', '.scss', '.less'];

export function hasExtension(file: string, exts: readonly string[]): boolean {
  const lower = file.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

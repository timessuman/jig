/**
 * A file "participates in the token layer" when it references at least one
 * known Jig token via `var(--token-name)`, or `@import`s a vendored Jig
 * token file directly.
 *
 * `hardcoded-value` (H-47) — "values hard-coded PAST the token layer" —
 * only means something for a file that is actually on that layer. A file
 * that hasn't adopted tokens at all isn't bypassing them, it just hasn't
 * gotten there yet; flagging every `px` in it produces noise that teaches
 * users to ignore the detector rather than use it. This is a principled
 * scope, not a noise threshold — it is what "past the token layer" means.
 */
const IMPORT_RE = /@import\s+(?:url\()?["']?[^"')]*\.jig\/tokens\/[^"')]+\.css["']?\)?/i;
const VAR_RE = /var\(\s*--([\w-]+)/g;
/**
 * Tailwind v4 declares tokens inside `@theme { --name: value }` and consumes
 * them as utility classes, never as `var(--name)`. A v4 project that has fully
 * adopted the token layer would otherwise look like one that never had — and
 * H-47, which only means anything for a file on the layer, would never run on
 * the whole framework's user base.
 */
const THEME_DECL_RE = /@theme\b[^{]*\{([\s\S]*?)\}/gi;
const CUSTOM_PROP_RE = /--([\w-]+)\s*:/g;

export function participatesInTokenLayer(source: string, tokens: Record<string, string>): boolean {
  if (IMPORT_RE.test(source)) return true;

  VAR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAR_RE.exec(source))) {
    if (Object.prototype.hasOwnProperty.call(tokens, m[1])) return true;
  }

  THEME_DECL_RE.lastIndex = 0;
  let theme: RegExpExecArray | null;
  while ((theme = THEME_DECL_RE.exec(source))) {
    if (IMPORT_RE.test(theme[1])) return true;
    CUSTOM_PROP_RE.lastIndex = 0;
    let prop: RegExpExecArray | null;
    while ((prop = CUSTOM_PROP_RE.exec(theme[1]))) {
      if (Object.prototype.hasOwnProperty.call(tokens, prop[1])) return true;
    }
  }

  return false;
}

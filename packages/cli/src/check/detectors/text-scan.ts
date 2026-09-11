/**
 * The file as prose, with every comment blanked.
 *
 * `A-05` and `A-10` are the only detectors that read `ctx.raw` — emoji and
 * placeholder text live in markup, not in a style region — so the masking that
 * `run.ts` does for `source` has to happen here instead.
 *
 * **Not `maskComments`.** That one is string-aware, which is correct for CSS and
 * wrong for raw markup: the apostrophe in `Don't` opens a "string" it then
 * consumes to the next quote, so every comment after it goes unmasked. That is
 * how five findings in CSS comments survived the first version of this.
 *
 * Deliberately naive instead. A `/*` inside a string literal will mask more than
 * it should, and that is the safe direction to be wrong in: the failure mode is
 * a missed warning rather than a false one, and a detector people trust is worth
 * more than a detector that catches everything.
 *
 * Character positions are preserved, so line numbers still point at real lines.
 */
const blank = (m: string) => m.replace(/[^\n]/g, ' ');

export function maskProseComments(raw: string): string {
  return raw
    // CSS and JS block comments, and HTML comments.
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    // Line comments, but never a URL's `//`. A component carrying
    // `// ❌ never do this` beside real code is ordinary; masking
    // `https://example.com` would make A-10 useless on the one pattern it most
    // needs to catch.
    .replace(/(^|[^:@\w])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)));
}

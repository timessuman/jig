import { describe, it, expect } from 'vitest';
import { emDash } from '../src/check/detectors/em-dash.js';
import type { DetectorContext } from '../src/check/types.js';

const run = (raw: string, file = 'page.html') =>
  emDash.run('', file, { ruleId: 'I-118', bucket: 'mechanical', severity: 'warning', tokens: {}, projectParticipates: true, raw } as DetectorContext);

describe('em-dash (I-118)', () => {
  it('reports one in element text, on its line', () => {
    const f = run('<body>\n  <p>Free — forever</p>\n</body>');
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
    expect(f[0].message).toMatch(/em dash in interface text/);
  });

  it('reports one in an attribute a reader hears or sees', () => {
    expect(run('<button aria-label="Delete — permanent">x</button>')).toHaveLength(1);
    expect(run('<img alt="The team — at work">')).toHaveLength(1);
    expect(run('<input placeholder="Search — by name">')).toHaveLength(1);
  });

  it('leaves the en dash alone: a range is not a pause', () => {
    expect(run('<p>2–10 seats, Mon–Fri</p>')).toHaveLength(0);
  });

  // Not interface text: nobody reads a comment, a class name or a script.
  it('ignores scripts, styles, comments and markup that is not prose', () => {
    expect(run('<script>const note = "a — b";</script>')).toHaveLength(0);
    expect(run('<style>/* a — b */ .x { color: red }</style>')).toHaveLength(0);
    expect(run('<!-- a — b -->\n<p>fine</p>')).toHaveLength(0);
    expect(run('<div class="a—b" data-note="x — y"></div>')).toHaveLength(0);
  });

  it('reports each line once, however many dashes it holds', () => {
    expect(run('<p>a — b — c</p>')).toHaveLength(1);
  });

  it('does not read documentation or stylesheets', () => {
    expect(emDash.appliesTo('README.md')).toBe(false);
    expect(emDash.appliesTo('app.css')).toBe(false);
    expect(emDash.appliesTo('page.tsx')).toBe(true);
  });

  it('reads a JSX string as interface text', () => {
    expect(run('export const Banner = () => <p>Free — forever</p>;', 'Banner.tsx')).toHaveLength(1);
  });
});

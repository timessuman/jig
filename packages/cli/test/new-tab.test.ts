import { describe, it, expect } from 'vitest';
import { newTabLink } from '../src/check/detectors/new-tab.js';
import type { DetectorContext } from '../src/check/types.js';

/**
 * E-165. The reader can open any link in a new tab; forcing one takes the
 * choice away and breaks Back. Whether a new tab is justified is judged on the
 * page. What a file settles is a new tab nobody is told about.
 */
const run = (raw: string, file = 'a.html') =>
  newTabLink.run(raw, file, { ruleId: 'E-165', bucket: 'hybrid', severity: 'warning', tokens: {}, projectParticipates: false, raw } as DetectorContext);

describe('new-tab-link (E-165)', () => {
  it('warns on a link that opens a new tab and does not say so', () => {
    const f = run('<p>\n<a href="https://github.com/x" target="_blank" rel="noopener">GitHub</a>\n</p>');
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(2);
    expect(f[0].message).toMatch(/"GitHub" opens a new tab and does not say so/);
    expect(run('<a href="/terms.pdf" target={"_blank"} rel="noopener"><svg aria-hidden="true"></svg>Terms</a>', 'a.tsx')).toHaveLength(1);
  });

  it('accepts a link that says so, in its text, a hidden span, an aria-label or a title', () => {
    expect(run('<a href="/terms" target="_blank" rel="noopener">Terms (opens in a new tab)</a>')).toEqual([]);
    expect(run('<a href="/terms" target="_blank" rel="noopener">Terms<span class="sr-only"> (opens in a new tab)</span></a>')).toEqual([]);
    expect(run('<a href="/terms" target="_blank" rel="noopener" aria-label="Terms, opens in a new window">Terms</a>')).toEqual([]);
  });

  it('leaves a same-tab link alone, and a link whose words are an expression', () => {
    expect(run('<a href="https://github.com/x">GitHub</a>')).toEqual([]);
    expect(run('<a href={url} target="_blank" rel="noopener">{label}</a>', 'a.tsx')).toEqual([]);
    expect(run('<a {...props} target="_blank">Docs</a>', 'a.tsx')).toEqual([]);
  });
});

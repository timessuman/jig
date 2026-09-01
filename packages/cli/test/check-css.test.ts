import { describe, it, expect } from 'vitest';
import { buildLineIndex, leafBlocks, lineForOffset, maskMediaQueries, splitRuleBlocks } from '../src/check/css.js';

describe('splitRuleBlocks / leafBlocks', () => {
  it('extracts a simple leaf block with its body and start line', () => {
    const source = '.a {\n  color: red;\n}\n';
    const blocks = leafBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].selector).toBe('.a');
    expect(blocks[0].body).toContain('color: red;');
    expect(blocks[0].bodyStartLine).toBe(1);
  });

  it('excludes a wrapper block (e.g. @media) but includes its nested leaf blocks', () => {
    const source = '@media (min-width: 600px) {\n  .a {\n    color: red;\n  }\n}\n';
    const all = splitRuleBlocks(source);
    expect(all.some((b) => b.selector.startsWith('@media'))).toBe(true);
    const leaves = leafBlocks(source);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].selector).toBe('.a');
  });
});

describe('maskMediaQueries', () => {
  it('blanks the interior of an @media block while preserving line count', () => {
    const source = '.a { padding: 4px; }\n@media (min-width: 600px) {\n  .b { padding: 999px; }\n}\n.c { padding: 8px; }\n';
    const masked = maskMediaQueries(source);
    expect(masked).not.toContain('999px');
    expect(masked).toContain('4px');
    expect(masked).toContain('8px');
    expect(masked.split('\n')).toHaveLength(source.split('\n').length);
  });
});

describe('lineForOffset', () => {
  it('maps an offset back to its 1-indexed line', () => {
    const source = 'a\nb\nc\n';
    const starts = buildLineIndex(source);
    expect(lineForOffset(starts, 0)).toBe(1);
    expect(lineForOffset(starts, 2)).toBe(2);
    expect(lineForOffset(starts, 4)).toBe(3);
  });
});

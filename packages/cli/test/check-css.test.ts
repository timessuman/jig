import { describe, it, expect } from 'vitest';
import { buildLineIndex, leafBlocks, lineForOffset, lineOfOffset, splitRuleBlocks } from '../src/check/css.js';

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

describe('lineForOffset', () => {
  it('maps an offset back to its 1-indexed line', () => {
    const source = 'a\nb\nc\n';
    const starts = buildLineIndex(source);
    expect(lineForOffset(starts, 0)).toBe(1);
    expect(lineForOffset(starts, 2)).toBe(2);
    expect(lineForOffset(starts, 4)).toBe(3);
  });
});

describe('CSS nesting', () => {
  // A block containing braces used to be discarded whole, so a nested rule's
  // PARENT declarations belonged to no block and were invisible to every
  // detector. Native nesting is baseline and `.scss`/`.less` are scanned, so
  // on a Sass codebase most declarations were never read.
  it("keeps a nested rule's parent declarations", () => {
    const source = '.card {\n  color: red;\n  .h { color: blue; }\n}\n';
    const leaves = leafBlocks(source);
    const card = leaves.find((b) => b.selector === '.card');
    expect(card).toBeDefined();
    expect(card!.body).toContain('color: red');
  });

  it('gives the nested child a clean selector, not the parent declarations', () => {
    const source = '.card {\n  color: red;\n  .h { color: blue; }\n}\n';
    const child = leafBlocks(source).find((b) => b.body.includes('blue'));
    expect(child!.selector).toBe('.h');
  });

  it("does not scan a child's declarations twice via its parent", () => {
    const source = '.card {\n  color: red;\n  .h { color: blue; }\n}\n';
    const withBlue = leafBlocks(source).filter((b) => b.body.includes('blue'));
    expect(withBlue).toHaveLength(1);
  });

  it('preserves line numbers across a blanked nested block', () => {
    const source = '.card {\n  color: red;\n  .h {\n    color: blue;\n  }\n  margin: 4px;\n}\n';
    const card = leafBlocks(source).find((b) => b.selector === '.card')!;
    const offset = card.body.indexOf('margin');
    expect(lineOfOffset(card, offset)).toBe(6);
  });

  it('still drops a pure wrapper that carries no declarations of its own', () => {
    const source = '@media (min-width: 600px) {\n  .a { color: red; }\n}\n';
    expect(leafBlocks(source).map((b) => b.selector)).toEqual(['.a']);
  });
});

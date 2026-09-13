import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLayers, placedIds, layerOf } from '../src/rules/layers.js';
import { explain } from '../src/commands/explain.js';
import { loadSpecs } from '../src/rules/specs.js';
import { repoRoot } from './helpers/registered-commands.js';

const layers = () => loadLayers(repoRoot);
const specs = () => loadSpecs(join(repoRoot, 'rules'));

/**
 * The map is a second file describing the corpus, which is exactly the shape
 * this repo keeps finding defects in. It is only safe while something forces the
 * two to agree — the same bargain `rules.index.json` makes with the markdown,
 * where `loadRules` throws on either kind of drift.
 */
describe('the layer map and the corpus agree', () => {
  it('places every addressable spec exactly once', () => {
    const placed = placedIds(layers());
    const actual = specs().map((s) => s.id).sort();
    expect([...placed].sort()).toEqual(actual);
  });

  it('places no id twice', () => {
    const placed = placedIds(layers());
    expect(placed.length).toBe(new Set(placed).size);
  });

  it('places no id that does not exist', () => {
    const real = new Set(specs().map((s) => s.id));
    for (const id of placedIds(layers())) {
      expect(real.has(id), `${id} is placed in a layer but is not in the corpus`).toBe(true);
    }
  });

  it('leaves the rules to rules.index.json rather than listing them twice', () => {
    // 105 ids restated here would be a second place to maintain one fact, and
    // the two would disagree within a release.
    expect(layers().layers['anti-patterns'].ids).toEqual([]);
    const index = JSON.parse(readFileSync(join(repoRoot, 'rules.index.json'), 'utf8'));
    expect(index.length).toBeGreaterThan(100);
  });
});

describe('the six layers answer the questions they exist for', () => {
  it('has exactly six', () => {
    expect(Object.keys(layers().layers)).toHaveLength(6);
  });

  it('gives each one a question, not just a name', () => {
    // A layer whose purpose cannot be stated as a question an agent would
    // actually ask is a folder, not a layer.
    for (const [name, l] of Object.entries(layers().layers)) {
      expect(l.question, `${name} has no question`).toMatch(/\?$/);
    }
  });
});

describe('components and patterns are split, without renumbering anything', () => {
  it('puts the things you render in components', () => {
    const l = layers();
    for (const id of ['P-02', 'P-03', 'P-06', 'P-07']) {
      expect(layerOf(l, id), id).toBe('components');
    }
  });

  it('puts the solutions you apply in patterns', () => {
    const l = layers();
    // P-04 Form composes P-03 fields; P-12 is a decision procedure.
    for (const id of ['P-01', 'P-04', 'P-12']) {
      expect(layerOf(l, id), id).toBe('patterns');
    }
  });

  it('keeps both prefixes intact', () => {
    // The whole point: `P-` was minted when "pattern" covered a Button and a
    // Form alike. Splitting the layer must not change a single address.
    const ids = specs().map((s) => s.id);
    expect(ids).toContain('P-02');
    expect(ids).toContain('P-04');
  });
});

describe('what is deliberately not one of the six', () => {
  it('keeps modes and process out rather than force-fitting them', () => {
    const l = layers();
    expect(layerOf(l, 'M-01')).toBe('modes');
    expect(layerOf(l, 'L-04')).toBe('process');
    // L-01 IS layout; L-04 is a checklist that happens to share a prefix.
    expect(layerOf(l, 'L-01')).toBe('layout');
  });
});


const version = '0.0.0-test';

describe('explain --layer makes the view reachable', () => {
  it('names the six and what each answers', () => {
    const out = explain({ ruleId: '', version, layer: true });
    for (const name of Object.keys(layers().layers)) expect(out).toContain(name);
    expect(out).toMatch(/What am I allowed to use\?/);
  });

  it('counts the anti-patterns layer from the rule index, not from a list', () => {
    // It carries no ids in layers.json on purpose. If the count came from there
    // it would read 0, and the largest layer would look empty.
    const out = explain({ ruleId: '', version, layer: true });
    expect(out).toMatch(/anti-patterns\s+1\d\d/);
  });

  it('lists one layer with its question and its entries', () => {
    const out = explain({ ruleId: 'layout', version, layer: true });
    expect(out).toContain('L-01');
    expect(out).toContain('L-02');
    expect(out).toMatch(/How do I arrange them\?/);
  });

  it('separates components from patterns in the listing', () => {
    const c = explain({ ruleId: 'components', version, layer: true });
    expect(c).toContain('P-02');
    expect(c).not.toContain('P-04');
    const p = explain({ ruleId: 'patterns', version, layer: true });
    expect(p).toContain('P-04');
    expect(p).not.toContain('P-02');
  });

  it('names the real layers when given one that does not exist', () => {
    // A dead end here is worse than elsewhere: the user is asking BECAUSE they
    // do not know the vocabulary yet.
    expect(() => explain({ ruleId: 'nope', version, layer: true })).toThrow(/principles/);
  });
});

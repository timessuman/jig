import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateIndex, loadRules } from '../src/rules/load.js';

const MD = `### A-01 First rule
❌ bad
✅ good

### A-02 Second rule
❌ bad
✅ good
`;

function scratch(indexJson: string) {
  const dir = mkdtempSync(join(tmpdir(), 'jig-'));
  const rulesDir = join(dir, 'rules');
  mkdirSync(rulesDir);
  writeFileSync(join(rulesDir, '00-anti-patterns.md'), MD);
  const indexPath = join(dir, 'rules.index.json');
  writeFileSync(indexPath, indexJson);
  return { dir, rulesDir, indexPath };
}

describe('validateIndex', () => {
  it('rejects an unknown bucket', () => {
    expect(() => validateIndex([{ id: 'A-01', bucket: 'wat', severity: 'error', since: '0.1.0' }]))
      .toThrow(/bucket/);
  });

  it('rejects a missing id', () => {
    expect(() => validateIndex([{ bucket: 'judgment', severity: 'note', since: '0.1.0' }]))
      .toThrow(/id/);
  });

  it('accepts a well-formed entry', () => {
    const out = validateIndex([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]);
    expect(out[0].id).toBe('A-01');
  });
});

describe('loadRules', () => {
  it('joins parsed rules with their index entries', () => {
    const { rulesDir, indexPath, dir } = scratch(JSON.stringify([
      { id: 'A-01', bucket: 'mechanical', severity: 'error', detector: 'd', since: '0.1.0' },
      { id: 'A-02', bucket: 'judgment', severity: 'note', since: '0.1.0' },
    ]));
    const loaded = loadRules(rulesDir, indexPath);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].title).toBe('First rule');
    expect(loaded[0].detector).toBe('d');
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when a rule has no index entry', () => {
    const { rulesDir, indexPath, dir } = scratch(JSON.stringify([
      { id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' },
    ]));
    expect(() => loadRules(rulesDir, indexPath)).toThrow(/A-02/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when an index entry has no rule', () => {
    const { rulesDir, indexPath, dir } = scratch(JSON.stringify([
      { id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' },
      { id: 'A-02', bucket: 'judgment', severity: 'note', since: '0.1.0' },
      { id: 'Z-99', bucket: 'judgment', severity: 'note', since: '0.1.0' },
    ]));
    expect(() => loadRules(rulesDir, indexPath)).toThrow(/Z-99/);
    rmSync(dir, { recursive: true, force: true });
  });
});

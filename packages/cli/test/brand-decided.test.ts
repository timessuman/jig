import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brandDecidedGaps } from '../src/check/brand-decided.js';
import { repoRoot } from './helpers/registered-commands.js';

/**
 * Of six runs whose owner named a colour and a typeface in `/jig decide`, four
 * recorded both in DECISIONS.md and left the brand file at Jig's unbranded
 * default, so every page shipped near-black in the system face.
 */
const DEFAULT_BRAND = readFileSync(join(repoRoot, 'tokens', 'brand.default.css'), 'utf8');
const TEAL_BRAND = DEFAULT_BRAND.replace('--brand-h: 264;', '--brand-h: 175;')
  .replace('--brand-s: 0%;', '--brand-s: 77%;')
  .replace('--brand-l: 15%;', '--brand-l: 26%;')
  .replace(/--font-text:\s*/, '--font-text:    "Manrope", ');

function project(decisions: string, brand: string): string {
  const root = mkdtempSync(join(tmpdir(), 'jig-brand-decided-'));
  mkdirSync(join(root, 'jig'));
  writeFileSync(join(root, 'jig', 'DECISIONS.md'), decisions);
  writeFileSync(join(root, 'jig', 'brand.project.css'), brand);
  return root;
}

const DECIDED = [
  '# Decisions',
  '',
  '## The Teal Rule',
  '',
  '`--color-brand` (`#0F766E`) is the one accent, and it appears only on things you can press.',
  '',
  '**Why:** "Brand colour: a deep teal, #0F766E."',
  '',
  '## One typeface, everywhere',
  '',
  'Manrope is both the display and the text face, loaded from Google Fonts. No second typeface.',
  'Headings use the same face. Weights stay at two.',
  '',
  '**Why:** "Type: Manrope for everything, loaded from Google Fonts."',
].join('\n');

describe('a colour or typeface the decisions record and the brand file lacks', () => {
  it('reports both when the brand file is still the unbranded default', () => {
    const gaps = brandDecidedGaps(project(DECIDED, DEFAULT_BRAND));
    expect(gaps.map((g) => g.message).join('\n')).toMatch(/brand colour #0F766E.*still sets hsl\(264 0% 15%\)/);
    expect(gaps.map((g) => g.message).join('\n')).toMatch(/typeface Manrope.*does not name it/);
    expect(gaps.map((g) => g.line)).toEqual([5, 11]);
  });

  it('is silent once the brand file carries them', () => {
    expect(brandDecidedGaps(project(DECIDED, TEAL_BRAND))).toEqual([]);
  });

  it('is silent for an unbranded project, and for words that only open a sentence', () => {
    const unbranded = '# Decisions\n\n## Type\n\nOne plain sans-serif. Headings use it too. Weights stay at two.\n\n## Colour\n\nNo brand colour yet: leave it unbranded.\n';
    expect(brandDecidedGaps(project(unbranded, DEFAULT_BRAND))).toEqual([]);
  });

  it('reads a colour the decisions forbid as no decision', () => {
    const forbidden = '# Decisions\n\n## Colour\n\nNever the violet #7c3aed an agent reaches for.\n';
    expect(brandDecidedGaps(project(forbidden, DEFAULT_BRAND))).toEqual([]);
  });
});

describe('/jig decide puts the answers into the brand file', () => {
  it('says so in its finish step', () => {
    const decide = readFileSync(join(repoRoot, 'templates', 'COMMAND.md.tmpl'), 'utf8').split('\n## decide')[1]!;
    expect(decide).toMatch(/Then put the answers into the brand file\./);
    expect(decide).toMatch(/--font-text/);
  });
});

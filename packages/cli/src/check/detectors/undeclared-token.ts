import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isTailwindDefault } from '../declared-properties.js';
import { isStyleBearing } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// H-117: a token name nothing declares.
// ❌ font-family: var(--font-body) — in a project whose token layer has no --font-body
// ✅ a name the token layer declares (02-tokens.md), or no token at all
//
// The browser does not warn. A declaration whose var() cannot resolve is
// invalid at computed-value time, so the property falls back to its initial
// value: the font becomes Times New Roman, padding becomes 0, the border
// disappears. The page still renders, which is why nothing else noticed.
//
// A reference with a fallback — var(--x, 1rem) — is skipped: it resolves. So is
// every reference when `declaredProperties` was never computed, or when the
// project imports a package whose declarations could not be read.

const VAR_RE = /var\(\s*(--[\w-]+)\s*([,)])/g;
// Tailwind v4 reads a custom property straight from a class: p-(--space-lg),
// bg-[var(--color-x)].
const CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g;
const CLASS_REF_RE = /(?:-\(\s*|var\(\s*)(--[\w-]+)\s*\)/g;

export const undeclaredToken: Detector = {
  name: 'undeclared-token',
  appliesTo: (file) => isStyleBearing(file),
  run(source, file, ctx) {
    const declared = ctx.declaredProperties;
    if (!declared || !declared.complete) return [];
    const known = (name: string) =>
      declared.names.has(name) || (declared.tailwind && isTailwindDefault(name)) || name.startsWith('--tw-');

    const hits = new Map<string, { name: string; offset: number; text: string }>();
    const note = (name: string, offset: number, text: string) => {
      if (known(name)) return;
      const key = `${name}@${offset}`;
      if (!hits.has(key)) hits.set(key, { name, offset, text });
    };
    for (const m of source.matchAll(VAR_RE)) {
      if (m[2] === ',') continue;
      note(m[1]!, m.index!, source);
    }
    for (const attr of ctx.raw.matchAll(CLASS_ATTR_RE)) {
      for (const m of attr[0].matchAll(CLASS_REF_RE)) note(m[1]!, attr.index! + m.index!, ctx.raw);
    }

    const lines = buildLineIndex(ctx.raw);
    const findings: Finding[] = [];
    for (const { name, offset } of hits.values()) {
      const line = lineForOffset(lines, offset);
      findings.push(
        mkFinding(ctx, 'undeclared-token', file, line,
          `${name} is not declared anywhere in the project, so every property using it is dropped`,
          sourceLine(ctx.raw, line)),
      );
    }
    return findings.sort((a, b) => a.line - b.line);
  },
};

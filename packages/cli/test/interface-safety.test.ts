import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interfaceSafety } from '../src/check/detectors/interface-safety.js';
import { repoRoot } from './helpers/registered-commands.js';
import type { DetectorContext } from '../src/check/types.js';

const run = (raw: string, ruleId: string, file = 'page.html') =>
  interfaceSafety.run('', file, { ruleId, bucket: 'mechanical', severity: 'error', tokens: {}, projectParticipates: true, raw } as DetectorContext);

describe('interface-safety', () => {
  it('reports a new-tab link with no rel, and accepts one that has it', () => {
    expect(run('<a href="https://x.test" target="_blank">x</a>', 'K-128')).toHaveLength(1);
    expect(run('<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a>', 'K-128')).toHaveLength(0);
    expect(run('<a href="/about">about</a>', 'K-128')).toHaveLength(0);
  });

  it('reports user content written as markup, in each framework spelling', () => {
    for (const source of [
      '<div dangerouslySetInnerHTML={{ __html: comment.body }} />',
      '<div v-html="post.body"></div>',
      'el.innerHTML = user.bio;',
      '{@html post.content}',
    ]) expect(run(source, 'K-129', 'page.tsx'), source).toHaveLength(1);
  });

  // A literal is a decision someone made once; a value is the case being warned about.
  it('leaves a literal alone', () => {
    expect(run('<div dangerouslySetInnerHTML={{ __html: "<b>Bold</b>" }} />', 'K-129', 'page.tsx')).toHaveLength(0);
  });

  it('reports a password field that blocks the manager', () => {
    expect(run('<input type="password" autocomplete="off">', 'K-130')).toHaveLength(1);
    expect(run('<input type="password" autocomplete="current-password">', 'K-130')).toHaveLength(0);
  });

  it('reports an unsandboxed third-party frame, and not a same-document one', () => {
    expect(run('<iframe src="https://maps.example/x"></iframe>', 'K-131')).toHaveLength(1);
    expect(run('<iframe src="https://maps.example/x" sandbox="allow-scripts"></iframe>', 'K-131')).toHaveLength(0);
    expect(run('<iframe src="/preview.html"></iframe>', 'K-131')).toHaveLength(0);
  });
});

describe('the section says what it is not', () => {
  const rules = readFileSync(join(repoRoot, 'rules/00-anti-patterns.md'), 'utf8');

  it('states plainly that a clean run is not a security review', () => {
    expect(rules).toMatch(/This is not a security review, and nothing here should be read as one/);
    expect(rules).toMatch(/It knows nothing about your sessions, your rate limits, your\s+CORS origins, your secrets or your dependencies/);
  });
});

/**
 * Six findings on a real site, all the same shape: `dangerouslySetInnerHTML`
 * inside a `<script>`, emitting JSON-LD and a nonce'd theme bootstrap. Both are
 * the idiom, and a script's contents are executed or parsed as data, never
 * rendered as markup.
 */
describe('interface-safety leaves the script idiom alone', () => {
  it('says nothing about JSON-LD or a bootstrap script', () => {
    expect(run('<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />', 'K-129', 'page.tsx')).toHaveLength(0);
    expect(run('<script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />', 'K-129', 'layout.tsx')).toHaveLength(0);
  });

  it('still reports a value written into the page itself', () => {
    expect(run('<article dangerouslySetInnerHTML={{ __html: post.body }} />', 'K-129', 'page.tsx')).toHaveLength(1);
  });
});

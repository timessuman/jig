import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check } from '../src/commands/check.js';

/**
 * H-47 means "values hard-coded PAST the token layer", so it is gated on the
 * file participating in that layer — otherwise every `px` in a codebase that
 * has not adopted tokens fires, which teaches people to ignore the detector.
 *
 * Per-file participation is right for a stylesheet, which imports the tokens
 * itself. It is wrong for a component: a `.vue` scoped block or a
 * styled-components template never imports anything, so it could never
 * participate, and H-47 could never fire on any of them. But a component in a
 * project whose stylesheet imports the tokens is exactly what "past the token
 * layer" describes.
 */
let project: string;

function write(rel: string, content: string) {
  const abs = join(project, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-host-'));
  mkdirSync(join(project, '.jig', 'tokens'), { recursive: true });
  // A real token file, so `loadTokenMap` finds names to match against.
  writeFileSync(
    join(project, '.jig', 'tokens', 'mode.product.css'),
    ':root { --spacing-card: 24px; --color-text-strong: hsl(0 0% 10%); }\n',
  );
  write('package.json', '{"name":"host-app"}');
  // The project IS on the token layer: its stylesheet imports the tokens.
  write('src/app.css', '@import "../.jig/tokens/mode.product.css";\n.a { color: var(--color-text-strong); }\n');
});

afterEach(() => rmSync(project, { recursive: true, force: true }));

const run = () =>
  check({ projectRoot: project, homeDir: project, version: '0.4.0', all: true, ci: false });

describe('H-47 inside host languages', () => {
  it('fires on a hard-coded value in a .vue scoped style block', () => {
    write('src/Card.vue', '<template><b/></template>\n<style scoped>\n.c { padding: 13px; }\n</style>\n');
    const ids = run().findings.filter((f) => f.file.endsWith('.vue'));
    expect(ids.map((f) => f.ruleId)).toContain('H-47');
    expect(ids[0].line, 'the line must point into the host file').toBe(3);
  });

  it('fires inside a styled-components template', () => {
    write('src/B.tsx', "import styled from 'styled-components';\nconst B = styled.button`\n  padding: 13px;\n`;\n");
    expect(run().findings.filter((f) => f.file.endsWith('.tsx')).map((f) => f.ruleId)).toContain('H-47');
  });

  it('does not fire in a project that has no token layer at all', () => {
    rmSync(join(project, 'src', 'app.css'));
    write('src/app.css', '.a { color: red; }\n');
    write('src/Card.vue', '<style>\n.c { padding: 13px; }\n</style>\n');
    expect(run().findings.filter((f) => f.ruleId === 'H-47')).toEqual([]);
  });

  it('never fires on application code outside a style region', () => {
    write('src/data.ts', 'export const theme = { brand: "#6D28D9", gap: 13 };\n');
    expect(run().findings.filter((f) => f.file.endsWith('data.ts'))).toEqual([]);
  });
});

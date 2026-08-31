# Jig Foundation & Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working multi-agent installer for Jig — parse the rule
markdown into a validated index, vendor it into a consuming repo with
attribution, render agent-specific skill files, and update safely without
clobbering user edits.

**Architecture:** A single npm package `jig-ui` exposing a `jig` binary. The rule
markdown in `rules/` is the source of truth; a parser turns `### A-01 Title`
headings into records, joined against a hand-annotated `rules.index.json`. A
build-time drift check fails if the two disagree. Install copies rules into
`.jig/`, writes a checksummed `manifest.json`, and renders one `SKILL.md.tmpl`
through a per-agent adapter. Update replaces untouched files and skips edited
ones.

**Tech Stack:** TypeScript (ESM), Node ≥20, `commander` as the only runtime
dependency, `vitest` for tests, `tsup` for bundling.

**Spec:** `docs/superpowers/specs/2026-08-31-jig-packaging-design.md`

## Prerequisites

Git identity must be configured before Task 1, or every commit step fails:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

## Global Constraints

- Package name `jig-ui`; binary `jig`; GitHub repo `jig`.
- Licence Apache-2.0. `LICENSE` and `NOTICE` at repo root.
- Vendored directory in a consuming repo is `.jig/`. Project config is
  `jig.config.json`.
- Node ≥20. ESM only (`"type": "module"`). No CommonJS.
- Exactly one runtime dependency: `commander`. Anything else needs justification —
  `npx` startup time is a product feature.
- Rule IDs are stable identifiers. Never renumber, never reuse. A rule present in
  the markdown but absent from `rules.index.json` is a build failure.
- All file writes into a consuming repo are relative to a resolved project root,
  never `process.cwd()` directly.
- Attribution files (`.jig/LICENSE`, `.jig/NOTICE`, per-file headers) are
  generated: `update` always replaces them regardless of checksum.

## File Structure

```
jig/
├─ rules/                          moved from repo root in Task 1
│  ├─ 00-anti-patterns.md … 05-copy.md
├─ tokens/                         unchanged
├─ rules.index.json                created Task 3
├─ templates/
│  ├─ SKILL.md.tmpl                created Task 6
│  └─ command-metadata.json        created Task 6
├─ LICENSE  NOTICE                 created Task 10
└─ packages/cli/
   ├─ package.json  tsconfig.json  tsup.config.ts   Task 1
   ├─ src/
   │  ├─ index.ts                  bin entry, commander wiring
   │  ├─ paths.ts                  project root + package root resolution
   │  ├─ rules/
   │  │  ├─ parse.ts               markdown → Rule[]              Task 2
   │  │  ├─ schema.ts              IndexEntry type + validation   Task 3
   │  │  └─ load.ts                join parsed rules with index   Task 3
   │  ├─ install/
   │  │  ├─ manifest.ts            read/write/checksum            Task 4
   │  │  └─ vendor.ts              copy + attribution headers     Task 8
   │  ├─ adapters/
   │  │  ├─ types.ts  registry.ts                                 Task 5
   │  │  ├─ claude.ts                                             Task 5
   │  │  └─ codex.ts cursor.ts opencode.ts generic.ts             Task 7
   │  ├─ template/render.ts        variable substitution          Task 6
   │  └─ commands/
   │     ├─ install.ts                                            Task 8
   │     └─ update.ts                                             Task 9
   └─ test/
      ├─ fixtures/
      └─ *.test.ts
```

---

### Task 1: Repo restructure and CLI scaffold

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`,
  `packages/cli/tsup.config.ts`, `packages/cli/src/index.ts`,
  `packages/cli/src/paths.ts`, `package.json` (workspace root), `.gitignore`
- Modify: move `00-anti-patterns.md` … `05-copy.md` into `rules/`
- Test: `packages/cli/test/paths.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `findProjectRoot(startDir: string): string` — walks up from
  `startDir` looking for `package.json`, `.git`, or `jig.config.json`; returns
  `startDir` if none found. `getPackageRoot(): string` — absolute path to the
  installed `jig-ui` package, used to locate bundled `rules/` and `templates/`.

- [ ] **Step 1: Commit the existing content before restructuring**

```bash
cd /home/soket/projects/squint
printf 'node_modules/\ndist/\n*.tsbuildinfo\n' > .gitignore
git add -A
git commit -m "chore: initial commit of rule content"
```

- [ ] **Step 2: Move rule markdown into `rules/`**

```bash
mkdir -p rules
git mv 00-anti-patterns.md 01-modes.md 02-tokens.md 03-patterns.md 04-principles.md 05-copy.md rules/
```

- [ ] **Step 3: Create the workspace root `package.json`**

```json
{
  "name": "jig-workspace",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

- [ ] **Step 4: Create `packages/cli/package.json`**

```json
{
  "name": "jig-ui",
  "version": "0.1.0",
  "description": "A design system for coding agents. Rules, tokens, and a linter.",
  "license": "Apache-2.0",
  "type": "module",
  "bin": { "jig": "./dist/index.js" },
  "files": ["dist", "rules", "tokens", "templates", "rules.index.json", "LICENSE", "NOTICE"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "commander": "^12.1.0" },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 5: Create `packages/cli/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 6: Create `packages/cli/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes without error, creates `node_modules/` and `package-lock.json`

- [ ] **Step 8: Write the failing test for path resolution**

Create `packages/cli/test/paths.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findProjectRoot } from '../src/paths.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'jig-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('findProjectRoot', () => {
  it('finds the directory containing package.json', () => {
    writeFileSync(join(dir, 'package.json'), '{}');
    const nested = join(dir, 'src', 'components');
    mkdirSync(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(dir);
  });

  it('finds a directory containing jig.config.json', () => {
    writeFileSync(join(dir, 'jig.config.json'), '{}');
    expect(findProjectRoot(dir)).toBe(dir);
  });

  it('returns the start directory when no marker is found', () => {
    const nested = join(dir, 'empty');
    mkdirSync(nested);
    expect(findProjectRoot(nested)).toBe(nested);
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/paths.test.ts`
Expected: FAIL — cannot resolve `../src/paths.js`

- [ ] **Step 10: Implement `src/paths.ts`**

```ts
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKERS = ['package.json', '.git', 'jig.config.json'];

export function findProjectRoot(startDir: string): string {
  let current = startDir;
  const { root } = parse(startDir);
  while (true) {
    if (MARKERS.some((m) => existsSync(join(current, m)))) return current;
    if (current === root) return startDir;
    current = dirname(current);
  }
}

export function getPackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..');
}
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/paths.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 12: Create the CLI entry point**

Create `packages/cli/src/index.ts`:

```ts
import { Command } from 'commander';

const program = new Command();
program
  .name('jig')
  .description('A design system for coding agents.')
  .version('0.1.0');

program.parse();
```

- [ ] **Step 13: Build and smoke-test the binary**

Run: `cd packages/cli && npm run build && node dist/index.js --version`
Expected: prints `0.1.0`

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: scaffold jig-ui CLI package and restructure rules/"
```

---

### Task 2: Rule markdown parser

**Files:**
- Create: `packages/cli/src/rules/parse.ts`
- Test: `packages/cli/test/rules-parse.test.ts`, `packages/cli/test/fixtures/sample-rules.md`

**Interfaces:**
- Consumes: nothing
- Produces:
```ts
export interface Rule {
  id: string;          // "A-01"
  section: string;     // "A"
  number: number;      // 1
  title: string;       // "Purple and violet as the unspecified default"
  wrong: string;       // text after ❌, may be empty
  correction: string;  // text after ✅, may be empty
  source: string;      // "00-anti-patterns.md#a-01"
}
export function parseRules(markdown: string, sourceFile: string): Rule[];
```

- [ ] **Step 1: Create the test fixture**

Create `packages/cli/test/fixtures/sample-rules.md`:

```markdown
# 00 · Anti-Patterns

Some preamble that must be ignored.

## A. Generic-AI aesthetic

### A-01 Purple and violet as the unspecified default
❌ A violet or indigo fill chosen because no colour was specified
✅ Use `--color-brand` from the brand file.

### A-02 Gradient text on headings
❌ `background-clip: text` with a gradient fill
✅ Solid `--color-text-strong`.
Extra explanatory line that is not part of the correction.

## E. Interaction

### E-29 Focus removed without replacement
❌ `outline: none` with no replacement indicator
✅ Provide a visible `:focus-visible` ring.
```

- [ ] **Step 2: Write the failing test**

Create `packages/cli/test/rules-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRules } from '../src/rules/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, 'fixtures', 'sample-rules.md'), 'utf8');

describe('parseRules', () => {
  const rules = parseRules(md, '00-anti-patterns.md');

  it('finds every rule heading and ignores prose', () => {
    expect(rules.map((r) => r.id)).toEqual(['A-01', 'A-02', 'E-29']);
  });

  it('splits the id into section and number', () => {
    expect(rules[2].section).toBe('E');
    expect(rules[2].number).toBe(29);
  });

  it('captures the title without the id', () => {
    expect(rules[0].title).toBe('Purple and violet as the unspecified default');
  });

  it('captures the wrong and correction lines', () => {
    expect(rules[0].wrong).toContain('violet or indigo fill');
    expect(rules[0].correction).toContain('--color-brand');
  });

  it('stops the correction at the first line after it', () => {
    expect(rules[1].correction).toBe('Solid `--color-text-strong`.');
  });

  it('builds a source anchor', () => {
    expect(rules[2].source).toBe('00-anti-patterns.md#e-29');
  });

  it('returns an empty array for markdown with no rules', () => {
    expect(parseRules('# Title\n\nJust prose.', 'x.md')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/rules-parse.test.ts`
Expected: FAIL — cannot resolve `../src/rules/parse.js`

- [ ] **Step 4: Implement the parser**

Create `packages/cli/src/rules/parse.ts`:

```ts
export interface Rule {
  id: string;
  section: string;
  number: number;
  title: string;
  wrong: string;
  correction: string;
  source: string;
}

const HEADING = /^###\s+([A-Z])-(\d+)\s+(.+?)\s*$/;

export function parseRules(markdown: string, sourceFile: string): Rule[] {
  const lines = markdown.split('\n');
  const rules: Rule[] = [];
  let current: Rule | null = null;

  const push = () => { if (current) rules.push(current); };

  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) {
      push();
      const [, section, num, title] = heading;
      const id = `${section}-${num}`;
      current = {
        id,
        section,
        number: Number(num),
        title,
        wrong: '',
        correction: '',
        source: `${sourceFile}#${id.toLowerCase()}`,
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('❌') && !current.wrong) {
      current.wrong = line.slice(1).trim();
    } else if (line.startsWith('✅') && !current.correction) {
      current.correction = line.slice(1).trim();
    }
  }
  push();
  return rules;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/rules-parse.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 6: Verify against the real rule file**

Create `packages/cli/test/rules-real.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from '../src/rules/parse.js';

describe('real rule file', () => {
  it('parses all 87 rules from 00-anti-patterns.md', () => {
    const md = readFileSync(join(process.cwd(), '../../rules/00-anti-patterns.md'), 'utf8');
    const rules = parseRules(md, '00-anti-patterns.md');
    expect(rules.length).toBeGreaterThanOrEqual(87);
    expect(rules.find((r) => r.id === 'A-01')).toBeDefined();
    expect(rules.find((r) => r.id === 'H-48')).toBeDefined();
    expect(rules.every((r) => r.title.length > 0)).toBe(true);
  });
});
```

Run: `cd packages/cli && npx vitest run test/rules-real.test.ts`
Expected: PASS. If the count is below 87, the heading regex missed a format
variant — inspect the failing headings before changing the assertion.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: parse rule markdown into structured records"
```

---

### Task 3: Rules index with drift validation

**Files:**
- Create: `rules.index.json`, `packages/cli/src/rules/schema.ts`,
  `packages/cli/src/rules/load.ts`
- Test: `packages/cli/test/rules-load.test.ts`

**Interfaces:**
- Consumes: `Rule`, `parseRules` from Task 2
- Produces:
```ts
export type Bucket = 'mechanical' | 'judgment' | 'hybrid';
export type Severity = 'error' | 'warning' | 'note';
export interface IndexEntry {
  id: string;
  bucket: Bucket;
  severity: Severity;
  detector?: string;
  fix?: string;
  since: string;
}
export interface LoadedRule extends Rule, Omit<IndexEntry, 'id'> {}
export function validateIndex(entries: unknown): IndexEntry[];
export function loadRules(rulesDir: string, indexPath: string): LoadedRule[];
```
`loadRules` throws on drift: any parsed rule with no index entry, or any index
entry with no parsed rule.

- [ ] **Step 1: Create the initial index with the highest-confidence rules**

Create `rules.index.json`. Start with the mechanical rules that have unambiguous
detectors; the remaining rules are added in Plan B as their detectors are built.
Every rule in the markdown must appear here, so unclassified rules get
`"bucket": "judgment"` with no detector — that is the correct default, because a
rule with no detector is enforced by the agent.

```json
[
  { "id": "A-01", "bucket": "hybrid",     "severity": "warning", "detector": "violet-band-hue", "since": "0.1.0" },
  { "id": "A-02", "bucket": "mechanical", "severity": "error",   "detector": "gradient-text",   "fix": "solid-text-color", "since": "0.1.0" },
  { "id": "A-04", "bucket": "mechanical", "severity": "error",   "detector": "backdrop-blur",   "since": "0.1.0" },
  { "id": "C-18", "bucket": "mechanical", "severity": "warning", "detector": "pure-black-white", "fix": "token-background", "since": "0.1.0" },
  { "id": "C-19", "bucket": "mechanical", "severity": "error",   "detector": "contrast-floor",  "since": "0.1.0" },
  { "id": "E-29", "bucket": "mechanical", "severity": "error",   "detector": "focus-removed",   "fix": "add-focus-visible", "since": "0.1.0" },
  { "id": "H-47", "bucket": "mechanical", "severity": "error",   "detector": "hardcoded-value", "fix": "token-substitute",  "since": "0.1.0" }
]
```

Then append one `{ "id": "<id>", "bucket": "judgment", "severity": "note", "since": "0.1.0" }`
entry for every remaining rule id in `rules/00-anti-patterns.md`. Generate the
list with:

```bash
grep -ho '^### [A-Z]-[0-9]*' rules/00-anti-patterns.md | sed 's/^### //'
```

- [ ] **Step 2: Write the failing test**

Create `packages/cli/test/rules-load.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/rules-load.test.ts`
Expected: FAIL — cannot resolve `../src/rules/load.js`

- [ ] **Step 4: Implement the index types and validator**

Create `packages/cli/src/rules/schema.ts`:

```ts
export type Bucket = 'mechanical' | 'judgment' | 'hybrid';
export type Severity = 'error' | 'warning' | 'note';

export interface IndexEntry {
  id: string;
  bucket: Bucket;
  severity: Severity;
  detector?: string;
  fix?: string;
  since: string;
}

const BUCKETS: Bucket[] = ['mechanical', 'judgment', 'hybrid'];
const SEVERITIES: Severity[] = ['error', 'warning', 'note'];

export function validateIndex(entries: unknown): IndexEntry[] {
  if (!Array.isArray(entries)) throw new Error('rules.index.json must be an array');
  return entries.map((raw, i) => {
    const e = raw as Record<string, unknown>;
    const at = `rules.index.json[${i}]`;
    if (typeof e.id !== 'string' || !/^[A-Z]-\d+$/.test(e.id)) {
      throw new Error(`${at}: missing or malformed id`);
    }
    if (!BUCKETS.includes(e.bucket as Bucket)) {
      throw new Error(`${at} (${e.id}): bucket must be one of ${BUCKETS.join(', ')}`);
    }
    if (!SEVERITIES.includes(e.severity as Severity)) {
      throw new Error(`${at} (${e.id}): severity must be one of ${SEVERITIES.join(', ')}`);
    }
    if (typeof e.since !== 'string') {
      throw new Error(`${at} (${e.id}): since is required`);
    }
    return {
      id: e.id,
      bucket: e.bucket as Bucket,
      severity: e.severity as Severity,
      detector: typeof e.detector === 'string' ? e.detector : undefined,
      fix: typeof e.fix === 'string' ? e.fix : undefined,
      since: e.since,
    };
  });
}
```

- [ ] **Step 5: Implement the loader with drift detection**

Create `packages/cli/src/rules/load.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules, type Rule } from './parse.js';
import { validateIndex, type IndexEntry } from './schema.js';

export { validateIndex };
export type { IndexEntry };

export interface LoadedRule extends Rule, Omit<IndexEntry, 'id'> {}

export function loadRules(rulesDir: string, indexPath: string): LoadedRule[] {
  const files = readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort();
  const parsed: Rule[] = [];
  for (const file of files) {
    parsed.push(...parseRules(readFileSync(join(rulesDir, file), 'utf8'), file));
  }

  const entries = validateIndex(JSON.parse(readFileSync(indexPath, 'utf8')));
  const byId = new Map(entries.map((e) => [e.id, e]));

  const missing = parsed.filter((r) => !byId.has(r.id)).map((r) => r.id);
  if (missing.length) {
    throw new Error(
      `Rules present in markdown but missing from rules.index.json: ${missing.join(', ')}`,
    );
  }

  const parsedIds = new Set(parsed.map((r) => r.id));
  const orphans = entries.filter((e) => !parsedIds.has(e.id)).map((e) => e.id);
  if (orphans.length) {
    throw new Error(
      `Entries in rules.index.json with no matching rule: ${orphans.join(', ')}`,
    );
  }

  return parsed.map((r) => {
    const { id: _id, ...meta } = byId.get(r.id)!;
    return { ...r, ...meta };
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/rules-load.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 7: Add a drift test against the real index**

Append to `packages/cli/test/rules-real.test.ts`:

```ts
import { loadRules } from '../src/rules/load.js';

describe('real index', () => {
  it('has an entry for every rule and no orphans', () => {
    expect(() =>
      loadRules(join(process.cwd(), '../../rules'), join(process.cwd(), '../../rules.index.json')),
    ).not.toThrow();
  });
});
```

Run: `cd packages/cli && npx vitest run test/rules-real.test.ts`
Expected: PASS. A failure here names the exact rule ids that are out of sync —
fix `rules.index.json`, not the test.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add rules index with build-time drift validation"
```

---

### Task 4: Install manifest with checksums

**Files:**
- Create: `packages/cli/src/install/manifest.ts`
- Test: `packages/cli/test/manifest.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
```ts
export type Scope = 'project' | 'global';
export interface Manifest {
  version: string;
  agent: string;
  scope: Scope;
  installedAt: string;
  files: Record<string, string>;   // relative path → "sha256:<hex>"
}
export function checksum(content: string): string;
export function readManifest(projectRoot: string): Manifest | null;
export function writeManifest(projectRoot: string, m: Manifest): void;
export function isModified(projectRoot: string, relPath: string, m: Manifest): boolean;
```
`isModified` returns `true` when the file's current checksum differs from the
manifest record, and `false` when the file is absent from the manifest or from
disk — an absent file is "not modified by the user", it is simply missing.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/manifest.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checksum, readManifest, writeManifest, isModified, type Manifest } from '../src/install/manifest.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'jig-')); mkdirSync(join(dir, '.jig'), { recursive: true }); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const base: Manifest = {
  version: '0.1.0', agent: 'claude', scope: 'project',
  installedAt: '2026-08-31T00:00:00.000Z', files: {},
};

describe('checksum', () => {
  it('is stable for identical content', () => {
    expect(checksum('hello')).toBe(checksum('hello'));
  });
  it('differs for different content', () => {
    expect(checksum('hello')).not.toBe(checksum('world'));
  });
  it('is prefixed with the algorithm', () => {
    expect(checksum('hello')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('readManifest / writeManifest', () => {
  it('returns null when no manifest exists', () => {
    expect(readManifest(dir)).toBeNull();
  });
  it('round-trips a manifest', () => {
    writeManifest(dir, base);
    expect(existsSync(join(dir, '.jig', 'manifest.json'))).toBe(true);
    expect(readManifest(dir)?.agent).toBe('claude');
  });
});

describe('isModified', () => {
  it('is false when the file matches its checksum', () => {
    writeFileSync(join(dir, '.jig', 'a.md'), 'original');
    const m = { ...base, files: { '.jig/a.md': checksum('original') } };
    expect(isModified(dir, '.jig/a.md', m)).toBe(false);
  });
  it('is true when the file has been edited', () => {
    writeFileSync(join(dir, '.jig', 'a.md'), 'edited by the user');
    const m = { ...base, files: { '.jig/a.md': checksum('original') } };
    expect(isModified(dir, '.jig/a.md', m)).toBe(true);
  });
  it('is false when the file is not in the manifest', () => {
    writeFileSync(join(dir, '.jig', 'b.md'), 'new');
    expect(isModified(dir, '.jig/b.md', base)).toBe(false);
  });
  it('is false when the file is missing from disk', () => {
    const m = { ...base, files: { '.jig/gone.md': checksum('x') } };
    expect(isModified(dir, '.jig/gone.md', m)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/manifest.test.ts`
Expected: FAIL — cannot resolve `../src/install/manifest.js`

- [ ] **Step 3: Implement the manifest module**

Create `packages/cli/src/install/manifest.ts`:

```ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Scope = 'project' | 'global';

export interface Manifest {
  version: string;
  agent: string;
  scope: Scope;
  installedAt: string;
  files: Record<string, string>;
}

const MANIFEST_REL = join('.jig', 'manifest.json');

export function checksum(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function readManifest(projectRoot: string): Manifest | null {
  const path = join(projectRoot, MANIFEST_REL);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

export function writeManifest(projectRoot: string, m: Manifest): void {
  const path = join(projectRoot, MANIFEST_REL);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
}

export function isModified(projectRoot: string, relPath: string, m: Manifest): boolean {
  const recorded = m.files[relPath];
  if (!recorded) return false;
  const abs = join(projectRoot, relPath);
  if (!existsSync(abs)) return false;
  return checksum(readFileSync(abs, 'utf8')) !== recorded;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/manifest.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add checksummed install manifest"
```

---

### Task 5: Adapter interface and the Claude adapter

**Files:**
- Create: `packages/cli/src/adapters/types.ts`, `packages/cli/src/adapters/claude.ts`,
  `packages/cli/src/adapters/registry.ts`
- Test: `packages/cli/test/adapters.test.ts`

**Interfaces:**
- Consumes: `Scope` from Task 4
- Produces:
```ts
export interface RenderedFile { relPath: string; content: string; }
export interface Adapter {
  name: string;                                  // "claude"
  displayName: string;                           // "Claude Code"
  supportsScope(scope: Scope): boolean;
  skillFiles(ctx: AdapterContext): RenderedFile[];
}
export interface AdapterContext {
  version: string;
  scope: Scope;
  skillBody: string;        // already rendered from SKILL.md.tmpl
  commandPrefix: string;    // adapter decides; passed back into rendering
}
export function getAdapter(name: string): Adapter;   // throws on unknown
export function adapterNames(): string[];
```

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/adapters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getAdapter, adapterNames } from '../src/adapters/registry.js';

const ctx = { version: '0.1.0', scope: 'project' as const, skillBody: 'BODY', commandPrefix: '/jig ' };

describe('registry', () => {
  it('lists the claude adapter', () => {
    expect(adapterNames()).toContain('claude');
  });
  it('throws a helpful error for an unknown agent', () => {
    expect(() => getAdapter('nope')).toThrow(/Unknown agent 'nope'/);
  });
});

describe('claude adapter', () => {
  const a = getAdapter('claude');

  it('supports both scopes', () => {
    expect(a.supportsScope('project')).toBe(true);
    expect(a.supportsScope('global')).toBe(true);
  });

  it('writes SKILL.md under .claude/skills/jig at project scope', () => {
    const files = a.skillFiles(ctx);
    expect(files.map((f) => f.relPath)).toEqual(['.claude/skills/jig/SKILL.md']);
  });

  it('includes YAML frontmatter with name and description', () => {
    const [file] = a.skillFiles(ctx);
    expect(file.content.startsWith('---\n')).toBe(true);
    expect(file.content).toMatch(/^name: jig$/m);
    expect(file.content).toMatch(/^description: /m);
  });

  it('embeds the rendered skill body', () => {
    expect(a.skillFiles(ctx)[0].content).toContain('BODY');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/adapters.test.ts`
Expected: FAIL — cannot resolve `../src/adapters/registry.js`

- [ ] **Step 3: Implement the adapter types**

Create `packages/cli/src/adapters/types.ts`:

```ts
import type { Scope } from '../install/manifest.js';

export interface RenderedFile {
  relPath: string;
  content: string;
}

export interface AdapterContext {
  version: string;
  scope: Scope;
  skillBody: string;
  commandPrefix: string;
}

export interface Adapter {
  name: string;
  displayName: string;
  supportsScope(scope: Scope): boolean;
  skillFiles(ctx: AdapterContext): RenderedFile[];
}

export const SKILL_DESCRIPTION =
  'Design system rules for generating and reviewing UI. Load before building any interface.';
```

- [ ] **Step 4: Implement the Claude adapter**

Create `packages/cli/src/adapters/claude.ts`:

```ts
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION } from './types.js';

export const claude: Adapter = {
  name: 'claude',
  displayName: 'Claude Code',
  supportsScope: () => true,
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    const content = [
      '---',
      'name: jig',
      `description: ${SKILL_DESCRIPTION}`,
      'user-invocable: true',
      '---',
      '',
      ctx.skillBody,
      '',
    ].join('\n');
    return [{ relPath: '.claude/skills/jig/SKILL.md', content }];
  },
};
```

- [ ] **Step 5: Implement the registry**

Create `packages/cli/src/adapters/registry.ts`:

```ts
import type { Adapter } from './types.js';
import { claude } from './claude.js';

const ADAPTERS: Adapter[] = [claude];

export function adapterNames(): string[] {
  return ADAPTERS.map((a) => a.name);
}

export function getAdapter(name: string): Adapter {
  const found = ADAPTERS.find((a) => a.name === name);
  if (!found) {
    throw new Error(`Unknown agent '${name}'. Available: ${adapterNames().join(', ')}`);
  }
  return found;
}

export { ADAPTERS };
export type { Adapter, AdapterContext, RenderedFile } from './types.js';
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/adapters.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add adapter interface and Claude Code adapter"
```

---

### Task 6: Skill template and renderer

**Files:**
- Create: `templates/SKILL.md.tmpl`, `templates/command-metadata.json`,
  `packages/cli/src/template/render.ts`
- Test: `packages/cli/test/render.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
```ts
export interface TemplateVars {
  command_prefix: string;
  scripts_path: string;
  ask_instruction: string;
  available_commands: string;
  config_file: string;
}
export function render(template: string, vars: TemplateVars): string;
export function renderCommandTable(metadata: CommandMetadata): string;
export interface CommandMetadata {
  [command: string]: { description: string; argumentHint: string };
}
```
`render` throws when the template contains a `{{var}}` with no matching key —
a silent empty substitution in an agent instruction file is worse than a crash.

- [ ] **Step 1: Create `templates/command-metadata.json`**

```json
{
  "init": {
    "description": "Set up Jig in this project: detect the CSS system, derive or interview for brand values, validate them against the token contract, and write tokens plus jig.config.json.",
    "argumentHint": ""
  },
  "check": {
    "description": "Check changed files or a named target against the rule set. Reports violations by rule id.",
    "argumentHint": "[target]"
  },
  "explain": {
    "description": "Print a rule's full text, its correction, and the version it was introduced in.",
    "argumentHint": "<rule-id>"
  },
  "update": {
    "description": "Update the vendored rules to a newer version, showing a diff and skipping files you have edited.",
    "argumentHint": ""
  }
}
```

- [ ] **Step 2: Create `templates/SKILL.md.tmpl`**

```markdown
Jig is a design system consumed by coding agents. Rules are numbered and stable;
cite the number when you follow or deliberately break one.

## Before generating or reviewing any UI

1. Load `.jig/00-anti-patterns.md` and `.jig/01-modes.md`.
2. Determine the mode from `{{config_file}}`, or infer it using the procedure in
   `.jig/01-modes.md` and state the inference in one line before building.
3. Load the relevant section of `.jig/03-patterns.md` for the component you are building.
4. Load `.jig/05-copy.md` whenever you write a label, button, heading, error or empty state.
5. Consume tokens by semantic name only. Never write a raw colour or pixel value
   at a call site.
6. Run `{{command_prefix}}check` before finishing.
7. Cite any rule you deliberately break, with the reason, in one line.

Load `.jig/04-principles.md` only when two rules conflict.

## Commands

{{available_commands}}

Run them via the CLI at `{{scripts_path}}`.

## Reading command output

Consume the full output of any Jig command. Never pipe it through `head`, `tail`,
`grep`, or `jq` — findings are ordered by severity, not by position, and
truncating drops the ones that matter.

If a command's output is already in this session's history and no files have
changed since, do not re-run it.

## Asking the user

{{ask_instruction}}

## Attestation

Before you finish a task that generated or modified UI, emit this line:

```text
JIG_CHECK: version=<version> mode=<mode> mechanical=<pass|fail>:<n>/<total> judgment=<ran|skipped>
```

A skipped check must say `skipped` and give the reason. Do not report `ran` for a
check you did not perform.
```

- [ ] **Step 3: Write the failing test**

Create `packages/cli/test/render.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, renderCommandTable } from '../src/template/render.js';

const vars = {
  command_prefix: '/jig ',
  scripts_path: '/usr/local/bin/jig',
  ask_instruction: 'Ask directly in chat.',
  available_commands: 'TABLE',
  config_file: 'jig.config.json',
};

describe('render', () => {
  it('substitutes every known variable', () => {
    expect(render('run {{command_prefix}}check', vars)).toBe('run /jig check');
  });

  it('substitutes a variable used more than once', () => {
    expect(render('{{config_file}} and {{config_file}}', vars))
      .toBe('jig.config.json and jig.config.json');
  });

  it('throws on an unknown variable rather than substituting empty', () => {
    expect(() => render('hello {{nope}}', vars)).toThrow(/nope/);
  });

  it('leaves text with no variables untouched', () => {
    expect(render('plain text', vars)).toBe('plain text');
  });
});

describe('renderCommandTable', () => {
  const md = renderCommandTable({
    check: { description: 'Check things.', argumentHint: '[target]' },
    init: { description: 'Set up.', argumentHint: '' },
  });

  it('renders a markdown table header', () => {
    expect(md.split('\n')[0]).toBe('| Command | Description |');
  });

  it('includes the argument hint in the command cell', () => {
    expect(md).toContain('`check [target]`');
  });

  it('omits an empty argument hint', () => {
    expect(md).toContain('`init`');
    expect(md).not.toContain('`init `');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/render.test.ts`
Expected: FAIL — cannot resolve `../src/template/render.js`

- [ ] **Step 5: Implement the renderer**

Create `packages/cli/src/template/render.ts`:

```ts
export interface TemplateVars {
  command_prefix: string;
  scripts_path: string;
  ask_instruction: string;
  available_commands: string;
  config_file: string;
}

export interface CommandMetadata {
  [command: string]: { description: string; argumentHint: string };
}

const VAR = /\{\{([a-z_]+)\}\}/g;

export function render(template: string, vars: TemplateVars): string {
  return template.replace(VAR, (_match, name: string) => {
    const value = (vars as Record<string, string>)[name];
    if (value === undefined) {
      throw new Error(
        `Template variable '{{${name}}}' has no value. Known variables: ${Object.keys(vars).join(', ')}`,
      );
    }
    return value;
  });
}

export function renderCommandTable(metadata: CommandMetadata): string {
  const rows = Object.entries(metadata).map(([name, meta]) => {
    const signature = meta.argumentHint ? `${name} ${meta.argumentHint}` : name;
    return `| \`${signature}\` | ${meta.description} |`;
  });
  return ['| Command | Description |', '| --- | --- |', ...rows].join('\n');
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/render.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add skill template and variable renderer"
```

---

### Task 7: Remaining agent adapters

**Files:**
- Create: `packages/cli/src/adapters/codex.ts`, `packages/cli/src/adapters/cursor.ts`,
  `packages/cli/src/adapters/opencode.ts`, `packages/cli/src/adapters/generic.ts`
- Modify: `packages/cli/src/adapters/registry.ts`
- Test: `packages/cli/test/adapters-all.test.ts`

**Interfaces:**
- Consumes: `Adapter`, `AdapterContext`, `RenderedFile`, `SKILL_DESCRIPTION` from Task 5
- Produces: four more `Adapter` values, all registered. `AGENTS.md`-writing
  adapters (`codex`, `generic`) produce content wrapped in the markers
  `<!-- jig:start -->` and `<!-- jig:end -->` so an existing `AGENTS.md` can be
  edited in place by Task 8 rather than overwritten.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/adapters-all.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ADAPTERS, getAdapter } from '../src/adapters/registry.js';

const ctx = { version: '0.1.0', scope: 'project' as const, skillBody: 'BODY', commandPrefix: '/jig ' };

describe('every adapter', () => {
  it('registers all five targets', () => {
    expect(ADAPTERS.map((a) => a.name).sort())
      .toEqual(['claude', 'codex', 'cursor', 'generic', 'opencode']);
  });

  for (const a of ADAPTERS) {
    it(`${a.name} produces at least one file containing the skill body`, () => {
      const files = a.skillFiles(ctx);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.content.includes('BODY'))).toBe(true);
    });

    it(`${a.name} produces only relative paths`, () => {
      for (const f of a.skillFiles(ctx)) {
        expect(f.relPath.startsWith('/')).toBe(false);
        expect(f.relPath).not.toContain('..');
      }
    });
  }
});

describe('AGENTS.md adapters', () => {
  for (const name of ['codex', 'generic']) {
    it(`${name} wraps content in jig markers`, () => {
      const [file] = getAdapter(name).skillFiles(ctx);
      expect(file.relPath).toBe('AGENTS.md');
      expect(file.content).toContain('<!-- jig:start -->');
      expect(file.content).toContain('<!-- jig:end -->');
    });
  }
});

describe('cursor adapter', () => {
  it('writes an .mdc rule file with frontmatter', () => {
    const [file] = getAdapter('cursor').skillFiles(ctx);
    expect(file.relPath).toBe('.cursor/rules/jig.mdc');
    expect(file.content).toMatch(/^---\n/);
    expect(file.content).toMatch(/^alwaysApply: /m);
  });

  it('does not support global scope', () => {
    expect(getAdapter('cursor').supportsScope('global')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/adapters-all.test.ts`
Expected: FAIL — only `claude` is registered

- [ ] **Step 3: Add the shared AGENTS.md block builder to `types.ts`**

Append to `packages/cli/src/adapters/types.ts`:

```ts
export const BLOCK_START = '<!-- jig:start -->';
export const BLOCK_END = '<!-- jig:end -->';

export function agentsBlock(skillBody: string): string {
  return [BLOCK_START, '', '# Jig — UI rules', '', skillBody, '', BLOCK_END, ''].join('\n');
}
```

- [ ] **Step 4: Implement the codex adapter**

Create `packages/cli/src/adapters/codex.ts`:

```ts
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsBlock } from './types.js';

export const codex: Adapter = {
  name: 'codex',
  displayName: 'Codex',
  supportsScope: () => true,
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    return [{ relPath: 'AGENTS.md', content: agentsBlock(ctx.skillBody) }];
  },
};
```

- [ ] **Step 5: Implement the generic adapter**

Create `packages/cli/src/adapters/generic.ts`:

```ts
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { agentsBlock } from './types.js';

export const generic: Adapter = {
  name: 'generic',
  displayName: 'Generic (AGENTS.md)',
  supportsScope: (scope) => scope === 'project',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    return [{ relPath: 'AGENTS.md', content: agentsBlock(ctx.skillBody) }];
  },
};
```

- [ ] **Step 6: Implement the cursor adapter**

Create `packages/cli/src/adapters/cursor.ts`:

```ts
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION } from './types.js';

export const cursor: Adapter = {
  name: 'cursor',
  displayName: 'Cursor',
  supportsScope: (scope) => scope === 'project',
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    const content = [
      '---',
      `description: ${SKILL_DESCRIPTION}`,
      'alwaysApply: false',
      '---',
      '',
      ctx.skillBody,
      '',
    ].join('\n');
    return [{ relPath: '.cursor/rules/jig.mdc', content }];
  },
};
```

- [ ] **Step 7: Implement the opencode adapter**

Create `packages/cli/src/adapters/opencode.ts`:

```ts
import type { Adapter, AdapterContext, RenderedFile } from './types.js';
import { SKILL_DESCRIPTION } from './types.js';

export const opencode: Adapter = {
  name: 'opencode',
  displayName: 'opencode',
  supportsScope: () => true,
  skillFiles(ctx: AdapterContext): RenderedFile[] {
    const content = [
      '---',
      'name: jig',
      `description: ${SKILL_DESCRIPTION}`,
      '---',
      '',
      ctx.skillBody,
      '',
    ].join('\n');
    return [{ relPath: '.opencode/skills/jig/SKILL.md', content }];
  },
};
```

- [ ] **Step 8: Register all adapters**

Modify `packages/cli/src/adapters/registry.ts` — replace the import and array:

```ts
import type { Adapter } from './types.js';
import { claude } from './claude.js';
import { codex } from './codex.js';
import { cursor } from './cursor.js';
import { opencode } from './opencode.js';
import { generic } from './generic.js';

const ADAPTERS: Adapter[] = [claude, codex, cursor, opencode, generic];
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd packages/cli && npx vitest run test/adapters-all.test.ts test/adapters.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add codex, cursor, opencode and generic adapters"
```

---

### Task 8: The `install` command

**Files:**
- Create: `packages/cli/src/install/vendor.ts`, `packages/cli/src/commands/install.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/install.test.ts`

**Interfaces:**
- Consumes: `getAdapter`/`ADAPTERS` (Task 5, 7), `render`/`renderCommandTable`
  (Task 6), `checksum`/`writeManifest`/`Manifest` (Task 4), `getPackageRoot`/
  `findProjectRoot` (Task 1)
- Produces:
```ts
export interface InstallOptions {
  agent: string;
  scope: Scope;
  projectRoot: string;
  packageRoot: string;
  version: string;
}
export interface InstallResult { written: string[]; skipped: string[]; }
export function install(opts: InstallOptions): InstallResult;
export function vendorHeader(file: string, version: string): string;
export function upsertBlock(existing: string, block: string): string;
```
`upsertBlock` replaces the content between `<!-- jig:start -->` and
`<!-- jig:end -->` when both markers are present, and otherwise appends the block
to the end of the file. This is what makes `install` safe to run against an
`AGENTS.md` that already has user content.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/install.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, upsertBlock, vendorHeader } from '../src/commands/install.js';
import { readManifest } from '../src/install/manifest.js';

let project: string;
let pkg: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), '### A-01 Rule\n❌ bad\n✅ good\n');
  writeFileSync(join(pkg, 'rules.index.json'),
    JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
    'Use {{command_prefix}}check. Config {{config_file}}.\n{{available_commands}}\n{{ask_instruction}}\n{{scripts_path}}');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'),
    JSON.stringify({ check: { description: 'Check.', argumentHint: '[target]' } }));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig\nCopyright ...');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(pkg, { recursive: true, force: true });
});

const opts = () => ({ agent: 'claude', scope: 'project' as const, projectRoot: project, packageRoot: pkg, version: '0.1.0' });

describe('upsertBlock', () => {
  const block = '<!-- jig:start -->\nNEW\n<!-- jig:end -->\n';

  it('appends when no markers exist', () => {
    expect(upsertBlock('# My agents file\n', block)).toContain('# My agents file');
    expect(upsertBlock('# My agents file\n', block)).toContain('NEW');
  });

  it('replaces between markers, preserving surrounding content', () => {
    const existing = '# Mine\n\n<!-- jig:start -->\nOLD\n<!-- jig:end -->\n\n# After\n';
    const out = upsertBlock(existing, block);
    expect(out).toContain('# Mine');
    expect(out).toContain('# After');
    expect(out).toContain('NEW');
    expect(out).not.toContain('OLD');
  });

  it('does not duplicate the block on repeat application', () => {
    const once = upsertBlock('', block);
    const twice = upsertBlock(once, block);
    expect(twice.match(/jig:start/g)).toHaveLength(1);
  });
});

describe('vendorHeader', () => {
  it('names the project, version and licence', () => {
    const h = vendorHeader('00-anti-patterns.md', '0.1.0');
    expect(h).toContain('Jig');
    expect(h).toContain('0.1.0');
    expect(h).toContain('Apache-2.0');
  });
});

describe('install', () => {
  it('vendors rules into .jig/', () => {
    install(opts());
    expect(existsSync(join(project, '.jig', '00-anti-patterns.md'))).toBe(true);
    expect(existsSync(join(project, '.jig', 'rules.index.json'))).toBe(true);
  });

  it('prefixes each vendored rule file with an attribution header', () => {
    install(opts());
    const body = readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Apache-2.0');
    expect(body).toContain('### A-01 Rule');
  });

  it('writes LICENSE and NOTICE into .jig/', () => {
    install(opts());
    expect(existsSync(join(project, '.jig', 'LICENSE'))).toBe(true);
    expect(existsSync(join(project, '.jig', 'NOTICE'))).toBe(true);
  });

  it('writes the agent skill file', () => {
    install(opts());
    const skill = join(project, '.claude', 'skills', 'jig', 'SKILL.md');
    expect(existsSync(skill)).toBe(true);
    expect(readFileSync(skill, 'utf8')).toContain('/jig check');
  });

  it('records every written file in the manifest with a checksum', () => {
    const result = install(opts());
    const m = readManifest(project)!;
    expect(m.agent).toBe('claude');
    expect(m.version).toBe('0.1.0');
    for (const rel of result.written) {
      if (rel.endsWith('manifest.json')) continue;
      expect(m.files[rel]).toMatch(/^sha256:/);
    }
  });

  it('is idempotent', () => {
    install(opts());
    const first = readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8');
    install(opts());
    expect(readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8')).toBe(first);
  });

  it('rejects an unsupported scope for the adapter', () => {
    expect(() => install({ ...opts(), agent: 'cursor', scope: 'global' }))
      .toThrow(/does not support global/);
  });

  it('preserves existing AGENTS.md content', () => {
    writeFileSync(join(project, 'AGENTS.md'), '# House rules\n\nDo the thing.\n');
    install({ ...opts(), agent: 'codex' });
    const out = readFileSync(join(project, 'AGENTS.md'), 'utf8');
    expect(out).toContain('# House rules');
    expect(out).toContain('jig:start');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/install.test.ts`
Expected: FAIL — cannot resolve `../src/commands/install.js`

- [ ] **Step 3: Implement the vendoring helpers**

Create `packages/cli/src/install/vendor.ts`:

```ts
import { BLOCK_START, BLOCK_END } from '../adapters/types.js';

export function vendorHeader(file: string, version: string): string {
  return [
    `<!-- ${file} — vendored from Jig v${version}.`,
    '     Licensed Apache-2.0. See .jig/LICENSE and .jig/NOTICE.',
    '     Edit freely: `jig update` will not overwrite a file you have changed. -->',
    '',
    '',
  ].join('\n');
}

export function upsertBlock(existing: string, block: string): string {
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + BLOCK_END.length).replace(/^\n/, '');
    return `${before}${block}${after}`;
  }
  const separator = existing.length && !existing.endsWith('\n') ? '\n\n' : existing.length ? '\n' : '';
  return `${existing}${separator}${block}`;
}
```

- [ ] **Step 4: Implement the install command**

Create `packages/cli/src/commands/install.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAdapter } from '../adapters/registry.js';
import { checksum, writeManifest, type Manifest, type Scope } from '../install/manifest.js';
import { render, renderCommandTable, type CommandMetadata } from '../template/render.js';
import { upsertBlock, vendorHeader } from '../install/vendor.js';

export { upsertBlock, vendorHeader };

export interface InstallOptions {
  agent: string;
  scope: Scope;
  projectRoot: string;
  packageRoot: string;
  version: string;
}

export interface InstallResult {
  written: string[];
  skipped: string[];
}

const ASK_INSTRUCTION =
  'Ask the user directly in chat, one question at a time, and wait for an answer before continuing.';

function writeFile(root: string, rel: string, content: string, files: Record<string, string>) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  files[rel] = checksum(content);
}

export function buildSkillBody(packageRoot: string): string {
  const template = readFileSync(join(packageRoot, 'templates', 'SKILL.md.tmpl'), 'utf8');
  const metadata = JSON.parse(
    readFileSync(join(packageRoot, 'templates', 'command-metadata.json'), 'utf8'),
  ) as CommandMetadata;
  return render(template, {
    command_prefix: '/jig ',
    scripts_path: 'npx jig-ui',
    ask_instruction: ASK_INSTRUCTION,
    available_commands: renderCommandTable(metadata),
    config_file: 'jig.config.json',
  });
}

export function install(opts: InstallOptions): InstallResult {
  const adapter = getAdapter(opts.agent);
  if (!adapter.supportsScope(opts.scope)) {
    throw new Error(`Adapter '${adapter.name}' does not support ${opts.scope} scope.`);
  }

  const files: Record<string, string> = {};
  const written: string[] = [];

  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const body = readFileSync(join(rulesDir, file), 'utf8');
    const rel = join('.jig', file);
    writeFile(opts.projectRoot, rel, vendorHeader(file, opts.version) + body, files);
    written.push(rel);
  }

  for (const [src, rel] of [
    ['rules.index.json', join('.jig', 'rules.index.json')],
    ['LICENSE', join('.jig', 'LICENSE')],
    ['NOTICE', join('.jig', 'NOTICE')],
  ] as const) {
    writeFile(opts.projectRoot, rel, readFileSync(join(opts.packageRoot, src), 'utf8'), files);
    written.push(rel);
  }

  const skillBody = buildSkillBody(opts.packageRoot);
  for (const file of adapter.skillFiles({
    version: opts.version,
    scope: opts.scope,
    skillBody,
    commandPrefix: '/jig ',
  })) {
    const abs = join(opts.projectRoot, file.relPath);
    const isBlockFile = file.content.includes('<!-- jig:start -->');
    const content = isBlockFile && existsSync(abs)
      ? upsertBlock(readFileSync(abs, 'utf8'), file.content)
      : file.content;
    writeFile(opts.projectRoot, file.relPath, content, files);
    written.push(file.relPath);
  }

  const manifest: Manifest = {
    version: opts.version,
    agent: opts.agent,
    scope: opts.scope,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(opts.projectRoot, manifest);
  written.push(join('.jig', 'manifest.json'));

  return { written, skipped: [] };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/install.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 6: Wire the command into the CLI**

Replace `packages/cli/src/index.ts`:

```ts
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, getPackageRoot } from './paths.js';
import { install } from './commands/install.js';
import { adapterNames } from './adapters/registry.js';

const packageRoot = getPackageRoot();
const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string };

const program = new Command();
program.name('jig').description('A design system for coding agents.').version(version);

program
  .command('install')
  .description('Install Jig rules and the agent skill file into a repository.')
  .requiredOption('--agent <name>', `target agent (${adapterNames().join(', ')})`)
  .option('--scope <scope>', 'project or global', 'project')
  .action((opts: { agent: string; scope: string }) => {
    if (opts.scope !== 'project' && opts.scope !== 'global') {
      console.error(`Invalid scope '${opts.scope}'. Use 'project' or 'global'.`);
      process.exit(1);
    }
    const projectRoot = findProjectRoot(process.cwd());
    try {
      const result = install({
        agent: opts.agent,
        scope: opts.scope,
        projectRoot,
        packageRoot,
        version,
      });
      console.log(`Installed Jig v${version} for ${opts.agent} (${opts.scope} scope)`);
      for (const f of result.written) console.log(`  + ${f}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
```

- [ ] **Step 7: Smoke-test against a scratch repo**

```bash
cd packages/cli && npm run build
mkdir -p /tmp/jig-smoke && cd /tmp/jig-smoke && npm init -y >/dev/null
node /home/soket/projects/squint/packages/cli/dist/index.js install --agent claude
ls -R .jig .claude
```
Expected: `.jig/` holds the six rule files, `rules.index.json`, `LICENSE`,
`NOTICE`, `manifest.json`; `.claude/skills/jig/SKILL.md` exists and mentions
`/jig check`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add install command with vendoring and attribution"
```

---

### Task 9: The `update` command

**Files:**
- Create: `packages/cli/src/commands/update.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/update.test.ts`

**Interfaces:**
- Consumes: `install` (Task 8), `readManifest`/`isModified`/`checksum` (Task 4)
- Produces:
```ts
export interface UpdateResult {
  updated: string[];
  skipped: string[];   // user-edited, left alone
  fromVersion: string;
  toVersion: string;
}
export function update(opts: InstallOptions): UpdateResult;
```
Attribution files (`.jig/LICENSE`, `.jig/NOTICE`, and any file whose content
starts with the vendor header) are always replaced. Rule files the user has
edited are reported in `skipped` and left untouched.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/update.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install } from '../src/commands/install.js';
import { update } from '../src/commands/update.js';

let project: string;
let pkg: string;

function seedPackage(ruleBody: string) {
  writeFileSync(join(pkg, 'rules', '00-anti-patterns.md'), ruleBody);
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'jig-proj-'));
  pkg = mkdtempSync(join(tmpdir(), 'jig-pkg-'));
  mkdirSync(join(pkg, 'rules'), { recursive: true });
  mkdirSync(join(pkg, 'templates'), { recursive: true });
  seedPackage('### A-01 Rule\n❌ bad\n✅ good\n');
  writeFileSync(join(pkg, 'rules.index.json'),
    JSON.stringify([{ id: 'A-01', bucket: 'judgment', severity: 'note', since: '0.1.0' }]));
  writeFileSync(join(pkg, 'templates', 'SKILL.md.tmpl'),
    '{{command_prefix}}{{config_file}}{{available_commands}}{{ask_instruction}}{{scripts_path}}');
  writeFileSync(join(pkg, 'templates', 'command-metadata.json'), JSON.stringify({}));
  writeFileSync(join(pkg, 'LICENSE'), 'Apache License 2.0 text');
  writeFileSync(join(pkg, 'NOTICE'), 'Jig');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(pkg, { recursive: true, force: true });
});

const opts = (version: string) => ({
  agent: 'claude', scope: 'project' as const,
  projectRoot: project, packageRoot: pkg, version,
});

describe('update', () => {
  it('replaces an untouched rule file', () => {
    install(opts('0.1.0'));
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update(opts('0.2.0'));
    const body = readFileSync(join(project, '.jig', '00-anti-patterns.md'), 'utf8');
    expect(body).toContain('Rule revised');
    expect(result.updated).toContain(join('.jig', '00-anti-patterns.md'));
    expect(result.skipped).toHaveLength(0);
  });

  it('skips a rule file the user has edited', () => {
    install(opts('0.1.0'));
    const target = join(project, '.jig', '00-anti-patterns.md');
    writeFileSync(target, `${readFileSync(target, 'utf8')}\n### A-99 My own rule\n`);
    seedPackage('### A-01 Rule revised\n❌ bad\n✅ better\n');
    const result = update(opts('0.2.0'));
    expect(readFileSync(target, 'utf8')).toContain('A-99 My own rule');
    expect(readFileSync(target, 'utf8')).not.toContain('Rule revised');
    expect(result.skipped).toContain(join('.jig', '00-anti-patterns.md'));
  });

  it('always replaces LICENSE and NOTICE even if edited', () => {
    install(opts('0.1.0'));
    writeFileSync(join(project, '.jig', 'NOTICE'), 'tampered');
    writeFileSync(join(pkg, 'NOTICE'), 'Jig v2');
    update(opts('0.2.0'));
    expect(readFileSync(join(project, '.jig', 'NOTICE'), 'utf8')).toBe('Jig v2');
  });

  it('reports the version transition', () => {
    install(opts('0.1.0'));
    const result = update(opts('0.2.0'));
    expect(result.fromVersion).toBe('0.1.0');
    expect(result.toVersion).toBe('0.2.0');
  });

  it('records the new version in the manifest', () => {
    install(opts('0.1.0'));
    update(opts('0.2.0'));
    const m = JSON.parse(readFileSync(join(project, '.jig', 'manifest.json'), 'utf8'));
    expect(m.version).toBe('0.2.0');
  });

  it('throws when Jig is not installed', () => {
    expect(() => update(opts('0.2.0'))).toThrow(/not installed/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/update.test.ts`
Expected: FAIL — cannot resolve `../src/commands/update.js`

- [ ] **Step 3: Implement the update command**

Create `packages/cli/src/commands/update.ts`:

```ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { checksum, isModified, readManifest, writeManifest, type Manifest } from '../install/manifest.js';
import { vendorHeader } from '../install/vendor.js';
import { type InstallOptions } from './install.js';

export interface UpdateResult {
  updated: string[];
  skipped: string[];
  fromVersion: string;
  toVersion: string;
}

const ALWAYS_REPLACE = [join('.jig', 'LICENSE'), join('.jig', 'NOTICE')];

export function update(opts: InstallOptions): UpdateResult {
  const existing = readManifest(opts.projectRoot);
  if (!existing) {
    throw new Error(
      `Jig is not installed in ${opts.projectRoot}. Run 'jig install --agent <name>' first.`,
    );
  }

  const updated: string[] = [];
  const skipped: string[] = [];
  const files: Record<string, string> = { ...existing.files };

  const write = (rel: string, content: string) => {
    const abs = join(opts.projectRoot, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
    files[rel] = checksum(content);
    updated.push(rel);
  };

  const rulesDir = join(opts.packageRoot, 'rules');
  for (const file of readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const rel = join('.jig', file);
    if (isModified(opts.projectRoot, rel, existing)) {
      skipped.push(rel);
      continue;
    }
    write(rel, vendorHeader(file, opts.version) + readFileSync(join(rulesDir, file), 'utf8'));
  }

  const indexRel = join('.jig', 'rules.index.json');
  if (isModified(opts.projectRoot, indexRel, existing)) {
    skipped.push(indexRel);
  } else {
    write(indexRel, readFileSync(join(opts.packageRoot, 'rules.index.json'), 'utf8'));
  }

  for (const rel of ALWAYS_REPLACE) {
    write(rel, readFileSync(join(opts.packageRoot, basename(rel)), 'utf8'));
  }

  const manifest: Manifest = {
    ...existing,
    version: opts.version,
    installedAt: new Date().toISOString(),
    files,
  };
  writeManifest(opts.projectRoot, manifest);

  return { updated, skipped, fromVersion: existing.version, toVersion: opts.version };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/update.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Wire the command into the CLI**

Add to `packages/cli/src/index.ts`, before `program.parse()`:

```ts
program
  .command('update')
  .description('Update vendored Jig rules, skipping files you have edited.')
  .action(() => {
    const projectRoot = findProjectRoot(process.cwd());
    try {
      const m = JSON.parse(
        readFileSync(join(projectRoot, '.jig', 'manifest.json'), 'utf8'),
      ) as { agent: string; scope: 'project' | 'global' };
      const result = update({
        agent: m.agent, scope: m.scope, projectRoot, packageRoot, version,
      });
      console.log(`Updated Jig ${result.fromVersion} → ${result.toVersion}`);
      for (const f of result.updated) console.log(`  ~ ${f}`);
      for (const f of result.skipped) console.log(`  · ${f} (edited locally, left alone)`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
```

Add the import at the top: `import { update } from './commands/update.js';`

- [ ] **Step 6: Run the full test suite**

Run: `cd packages/cli && npm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add checksum-aware update command"
```

---

### Task 10: Licence, NOTICE, and README install blocks

**Files:**
- Create: `LICENSE`, `NOTICE`
- Modify: `README.md`, `AGENTS.md`, `ui.config.example.json` → `jig.config.example.json`
- Test: `packages/cli/test/packaging.test.ts`

**Interfaces:**
- Consumes: `ADAPTERS` (Task 7)
- Produces: no code interfaces. This task makes the repository publishable.

- [ ] **Step 1: Add the Apache 2.0 licence**

```bash
curl -fsSL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
head -3 LICENSE
```
Expected: the file begins with `Apache License`. If the download fails, copy the
text from https://www.apache.org/licenses/LICENSE-2.0.txt manually — do not
substitute a different licence.

- [ ] **Step 2: Create `NOTICE`**

```
Jig
Copyright 2026 <your name or organisation>

This product includes software developed as part of the Jig design system.

Portions of the rule set were informed by general UI and accessibility practice.
Numeric defaults are tracked for reconciliation in RECONCILE.md.
```

- [ ] **Step 3: Rename the example config**

```bash
git mv ui.config.example.json jig.config.example.json
```

Then edit `jig.config.example.json` so the `$comment` reads:

```json
{
  "$comment": "Copy to jig.config.json in your project root and edit. Removes the need for an agent to infer mode on every task.",
  "brand": "tokens/brand.default.css",
  "surfaces": [
    { "match": "/",         "mode": "editorial" },
    { "match": "/app/**",   "mode": "product"   },
    { "match": "/admin/**", "mode": "operator"  }
  ]
}
```

- [ ] **Step 4: Write the failing packaging test**

Create `packages/cli/test/packaging.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(process.cwd(), '..', '..');
const readme = () => readFileSync(join(repoRoot, 'README.md'), 'utf8');

describe('packaging', () => {
  it('has a LICENSE naming Apache', () => {
    expect(readFileSync(join(repoRoot, 'LICENSE'), 'utf8')).toContain('Apache License');
  });

  it('has a NOTICE', () => {
    expect(existsSync(join(repoRoot, 'NOTICE'))).toBe(true);
  });

  it('renamed the example config', () => {
    expect(existsSync(join(repoRoot, 'jig.config.example.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'ui.config.example.json'))).toBe(false);
  });

  it('README documents an install line for every adapter', () => {
    const text = readme();
    for (const agent of ['claude', 'codex', 'cursor', 'opencode', 'generic']) {
      expect(text).toContain(`npx jig-ui@latest install --agent ${agent}`);
    }
  });

  it('README no longer refers to the old name or config file', () => {
    const text = readme();
    expect(text).not.toMatch(/\bSquint\b/);
    expect(text).not.toContain('ui.config.json');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd packages/cli && npx vitest run test/packaging.test.ts`
Expected: FAIL on the README assertions

- [ ] **Step 6: Rewrite the README header and install section**

Replace the top of `README.md` (everything before the `## Files` table) with:

```markdown
# Jig

A design system written to be consumed by coding agents, not read by designers.

Installed as `npx jig-ui` — the bare name was taken on npm.

Framework-agnostic. Tokens are CSS custom properties; rules are stated in CSS
properties and behaviour, never in one framework's class names.

## Install

Paste the line for your agent and let it run the command.

| Agent | Command |
| --- | --- |
| Claude Code | `npx jig-ui@latest install --agent claude` |
| Codex | `npx jig-ui@latest install --agent codex` |
| Cursor | `npx jig-ui@latest install --agent cursor` |
| opencode | `npx jig-ui@latest install --agent opencode` |
| Any other agent | `npx jig-ui@latest install --agent generic` |

Add `--scope global` to install for every project instead of just this one
(Cursor and the generic target are project-scoped only).

Then set up the project:

```bash
npx jig-ui@latest init
```

Update later with `npx jig-ui@latest update` — files you have edited are left
alone.
```

- [ ] **Step 7: Replace every remaining reference to the old name**

```bash
cd /home/soket/projects/squint
grep -rln 'Squint\|squint\|ui\.config\.json' README.md AGENTS.md rules/ docs/ || true
```

Update each hit: `Squint` → `Jig`, `ui.config.json` → `jig.config.json`.

Also update the `## Files` table in `README.md` so every rule path is prefixed
with `rules/` (`rules/00-anti-patterns.md`, not `00-anti-patterns.md`) — the
files moved in Task 1 and the table still points at the old locations.

Leave "the squint test" in `rules/03-patterns.md` unchanged — it is the name of
a technique, not the project.

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd packages/cli && npx vitest run test/packaging.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 9: Run the full suite and build**

Run: `cd packages/cli && npm test && npm run build`
Expected: all tests pass, `dist/index.js` builds

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: add Apache-2.0 licence, NOTICE, and rename Squint to Jig"
```

---

## Done when

- `npx jig-ui install --agent <each of five>` produces correct files in a scratch repo.
- Editing a vendored rule file then running `update` preserves the edit and says so.
- `rules.index.json` covers every rule; adding a rule to the markdown without an
  index entry fails the test suite.
- `README.md` carries a paste-ready install line per agent and no references to
  the former name.
- `LICENSE` and `NOTICE` exist at the repo root and are vendored into `.jig/`.

## Not in this plan

`check`, `explain`, `init`, `token`, `audit`, and `bench` are Plans B and C. The
`command-metadata.json` created in Task 6 lists `init`, `check`, and `explain`
so the rendered skill file is complete on arrival — the commands themselves
arrive in the next plan, and running one before then prints commander's standard
unknown-command error.

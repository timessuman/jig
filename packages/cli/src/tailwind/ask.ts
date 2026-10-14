import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Asking the project's own Tailwind v4, rather than a list kept here.
 *
 * Tailwind's design system knows which classes are utilities and what each one
 * generates. A list of its namespaces kept in Jig went stale twice, in both
 * directions. Its loader is async and marked unstable, and the callers are
 * synchronous, so each question runs in a short child process: anything that
 * goes wrong there is an answer of "could not ask", never a failed run.
 */

/** `@tailwindcss/node`, as the project resolves it, or through the plugin that brought it. */
export function tailwindNode(projectRoot: string): string | undefined {
  const from = createRequire(join(projectRoot, 'package.json'));
  try {
    return from.resolve('@tailwindcss/node');
  } catch { /* not hoisted: try through the plugin that depends on it */ }
  for (const plugin of ['@tailwindcss/vite', '@tailwindcss/postcss', '@tailwindcss/cli']) {
    try {
      return createRequire(from.resolve(`${plugin}/package.json`)).resolve('@tailwindcss/node');
    } catch { /* not this one */ }
  }
  return undefined;
}

/**
 * Runs `body` as an async module with `input` and `loadDesignSystem` in scope;
 * whatever it passes to `answer()` comes back. Throws with Tailwind's own
 * message when it fails.
 */
export function askTailwind<T>(projectRoot: string, module: string, body: string, input: unknown): T {
  const code = [
    "import { readFileSync } from 'node:fs';",
    `const { __unstable__loadDesignSystem: loadDesignSystem } = await import(${JSON.stringify(pathToFileURL(module).href)});`,
    "const input = JSON.parse(readFileSync(0, 'utf8'));",
    'const answer = (value) => process.stdout.write(JSON.stringify(value));',
    body,
  ].join('\n');
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: projectRoot,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out) as T;
}

/** The first line of a failure worth showing a reader. */
export function whyNot(err: unknown): string {
  const text = String((err as { stderr?: string }).stderr || (err as Error).message).trim();
  return (text.split('\n').find((l) => /error/i.test(l)) ?? text.split('\n')[0] ?? 'it did not answer').slice(0, 160);
}

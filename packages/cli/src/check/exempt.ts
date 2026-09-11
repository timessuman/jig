import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Files a project has declared render outside the token cascade, and are
 * therefore not held to it.
 *
 * Some surfaces genuinely cannot consume a custom property. An OG card
 * serialised into an SVG `foreignObject` carries no stylesheet; a PDF drawn
 * through a React renderer never sees CSS at all. Every colour in those files
 * has to be a literal copied from the token layer by hand, and no amount of
 * discipline changes that.
 *
 * Without a way to say so those files were in permanent violation, which is an
 * adoption blocker rather than a nuisance: a check that cannot be made to pass
 * is a check people switch off, and switching it off loses the rest of the
 * codebase with it.
 *
 * The exemption is reported on every run, by name. An exemption list is exactly
 * the kind of thing that grows one entry at a time until it covers everything,
 * and the only defence against that is that it is never invisible.
 */

/** Minimal glob: `*` within a segment, `**` across segments, `?` for one
 *  character. Not a full matcher — these are paths in one repository, and a
 *  dependency to match them would be a poor trade. */
function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        if (glob[i + 1] === '/') i++; // `**/` also matches zero directories
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/**
 * Reads `exempt` from `jig.config.json`.
 *
 * A pattern that escapes the project is dropped. `check` reporting nothing
 * because a config contained `../../**` would be the worst possible failure —
 * a green run that inspected nothing — so an escaping pattern is treated as
 * absent rather than honoured.
 */
export function readExemptions(projectRoot: string): string[] {
  const configPath = join(projectRoot, 'jig.config.json');
  if (!existsSync(configPath)) return [];
  let declared: unknown;
  try {
    declared = (JSON.parse(readFileSync(configPath, 'utf8')) as { exempt?: unknown }).exempt;
  } catch {
    return [];
  }
  if (!Array.isArray(declared)) return [];
  return declared.filter(
    (p): p is string =>
      typeof p === 'string' &&
      p.trim() !== '' &&
      !p.startsWith('/') &&
      !p.split('/').includes('..'),
  );
}

/** A pattern excusing more than this is reported as likely too broad.
 *
 *  Not a limit — a project may legitimately have a large PDF or email tree. It
 *  is the point at which a pattern stops looking like "this one file renders
 *  outside the cascade" and starts looking like a naming coincidence:
 *  `**\/*-card.tsx`, written to excuse one OG card, also excuses `doc-card`,
 *  `pricing-card` and every other real component that ends that way. */
const LIKELY_TOO_BROAD = 3;

export interface ExemptionResult {
  scanned: string[];
  exempt: string[];
  /** Per pattern, so the report can name the glob that did this. Naming only
   *  the FILES was the original mistake: it told you what had been excused and
   *  never which rule excused it, which is the one thing you need in order to
   *  recognise the error. And it truncated, so it degraded exactly as the
   *  pattern got broader. */
  byPattern: Array<{ pattern: string; count: number; tooBroad: boolean }>;
}

/** Splits `files` into the ones to scan and the ones a pattern excused. */
export function applyExemptions(files: string[], patterns: string[]): ExemptionResult {
  if (patterns.length === 0) return { scanned: files, exempt: [], byPattern: [] };

  const compiled = patterns.map((pattern) => ({ pattern, re: globToRegExp(pattern), count: 0 }));
  const scanned: string[] = [];
  const exempt: string[] = [];

  for (const file of files) {
    // Every matching pattern is counted, not just the first: a file excused
    // twice means two patterns are broader than they look, and attributing it
    // to one of them would hide the other.
    const matches = compiled.filter((c) => c.re.test(file));
    for (const m of matches) m.count++;
    (matches.length > 0 ? exempt : scanned).push(file);
  }

  return {
    scanned,
    exempt,
    byPattern: compiled.map(({ pattern, count }) => ({
      pattern,
      count,
      tooBroad: count > LIKELY_TOO_BROAD,
    })),
  };
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { declaredSwitches } from '../probe/switches.js';

/**
 * What an HTML mockup must hold before the owner reviews it.
 *
 * The procedure asks for three things a reader of the drawing cannot check by
 * eye, and a drawing that skips them looks complete:
 *
 * 1. A frame per size. On jig-site three mockups in a row were one responsive
 *    page each; the owner saw only the width of the window they opened.
 * 2. Each size's regions in its frame. A frame can exist and be empty, or hold
 *    the desktop composition narrower. The procedure's own self-check ("go down
 *    the spec's regions and find each one in that frame") was prose only.
 * 3. Either side of each switch the project records (`--breakpoint-*`, T-04).
 *    The four sizes fall where a page is judged, not where it changes; jig-site's
 *    header switches at 540, between phone and tablet, and no frame showed 539
 *    beside 540. The probe already measures either side of each switch; the
 *    drawing the owner approves now shows the same widths.
 */
const FRAMES = [['phone', 360], ['tablet', 768], ['desktop', 1280], ['wide', 1600]] as const;

export function mockupDrawingProblems(root: string, specBody: string, at: string): string[] {
  let html: string;
  try { html = readFileSync(join(root, at), 'utf8'); } catch { return []; }
  const frames = readFrames(html);
  const problems: string[] = [];

  const missing = FRAMES.filter(([size]) => !frames.some((f) => f.size === size));
  if (missing.length) {
    problems.push(
      `${at} has no frame for ${missing.map(([size, px]) => `${size} (${px}px)`).join(', ')}. ` +
        `A mockup draws the page once per size, side by side, in the wireframe template's ` +
        `\`<section class="frame" data-size="…">\` boxes, so the owner sees every size at once. ` +
        `A single responsive page shows only the width of the window it is opened in.`,
    );
  }

  // "No icons, imagery, shadows or decoration. An image is a labelled box that
  // says what goes there. An icon is its name in brackets." jig-site's Versions
  // drawing carried the site's real icons and GitHub's mark: appearance, which
  // the mockup keeps out so that review stays on structure.
  const drawn = frames.flatMap((f) => f.art.map((a) => `${f.size ?? 'a'} frame: ${a}`));
  if (drawn.length) {
    problems.push(
      `${at} draws icons or images in its frames (${[...new Set(drawn)].slice(0, 4).join('; ')}). ` +
        `A mockup is structure only: an icon is its name in brackets, \`[search]\`, and an image is a labelled box saying what goes there.`,
    );
  }

  problems.push(...frameRegionProblems(frames, specBody, at));

  const widths = new Set(frames.map((f) => f.width).filter((w): w is number => w !== undefined));
  const crossed = specSwitches(specBody);
  const recorded = declaredSwitches(root);
  // A name that matches no recorded switch filters out every one, and the
  // gate then passes a drawing with none: a spec wrote `breakpoint-nav` and
  // was read as naming a switch called that.
  const unknown = (crossed ?? []).filter((name) => !recorded.some((sw) => sw.name === name));
  if (unknown.length) {
    problems.push(
      `The spec's \`switches:\` names ${unknown.map((n) => `"${n}"`).join(', ')}, which the project does not record. ` +
        `Recorded: ${recorded.map((sw) => `${sw.name} (${sw.px}px)`).join(', ') || 'none'}. Name them as \`--breakpoint-<name>\` gives them.`,
    );
  }
  for (const s of recorded.filter((sw) => !crossed || crossed.includes(sw.name))) {
    const absent = [s.px - 1, s.px].filter((w) => !widths.has(w));
    if (absent.length) {
      problems.push(
        `${at} does not draw either side of the \`--breakpoint-${s.name}\` switch at ${s.px}px (no frame at ${absent.join(' or ')}px). ` +
          `The layout changes there, between the four sizes, so the owner sees the last width before it and the first at it: ` +
          `a frame with \`data-width="${s.px - 1}"\` and one with \`data-width="${s.px}"\`, each that wide. ` +
          `A page that never crosses it says so in its spec: \`switches:\` lists the ones it does, or \`none\`.`,
      );
    }
  }
  return problems;
}

/** Each size's regions from the spec, looked for in that size's frame. */
function frameRegionProblems(frames: Frame[], specBody: string, at: string): string[] {
  const problems: string[] = [];
  const regions = specRegions(specBody);
  for (const [size] of FRAMES) {
    const listed = regions[size];
    const inFrame = frames.filter((f) => f.size === size).flatMap((f) => f.labels);
    if (!listed || listed.length === 0 || !frames.some((f) => f.size === size)) continue;
    const absent = listed.filter((r) => r.name && !r.optional && !regionDrawn(inFrame, r)).map((r) => r.name!);
    if (absent.length) {
      problems.push(
        `${at}: the ${size} frame has no labelled region for ${absent.map((n) => `"${n}"`).join(', ')}. ` +
          `Every region the spec lists for a size is drawn in that size's frame, with its name in a \`.name\` label.`,
      );
    } else if (inFrame.length < listed.filter((r) => !r.optional).length) {
      problems.push(
        `${at}: the ${size} frame labels ${inFrame.length} region(s) and the spec lists ${listed.filter((r) => !r.optional).length} for ${size}. ` +
          `Draw each one in the frame, with its name in a \`.name\` label.`,
      );
    }
  }

  return problems;
}

/**
 * Whether an approved drawing still shows what the spec lists, size by size.
 *
 * jig-site's header spec went through five confirmed rounds after its mockup
 * was approved, adding a toggle, a version link and GitHub's mark, and still
 * said `mockup: approved` over a drawing with none of them. `make` built from
 * it, and a tweak held to it could not pass. A drawing drawn before frames
 * existed has nothing to compare, and is left alone.
 */
export function approvedDrawingProblems(root: string, specBody: string, at: string): string[] {
  let html: string;
  try { html = readFileSync(join(root, at), 'utf8'); } catch { return []; }
  const frames = readFrames(html);
  if (!frames.some((f) => f.size)) return [];
  return frameRegionProblems(frames, specBody, at);
}

/**
 * The recorded switches this page crosses, from the spec's `switches:` (a list
 * of names, or `none`). Absent, every recorded switch is drawn: jig-site's
 * Reference switches its rails at 1216, and its Versions page never crosses
 * that width, so a spec that says so is not asked to draw it.
 */
function specSwitches(specBody: string): string[] | undefined {
  const front = specBody.split(/^---\s*$/m)[1] ?? '';
  const value = /^switches\s*:\s*(.+)$/im.exec(front)?.[1]?.replace(/#.*$/, '').trim();
  if (value === undefined) return undefined;
  if (/^(none|\[\s*\])$/i.test(value)) return [];
  return value.replace(/^\[|\]$/g, '').split(',').map((n) => n.trim().replace(/^["']|["']$/g, '').replace(/^(--)?breakpoint-/, '')).filter(Boolean);
}

interface Frame { size?: string; width?: number; labels: string[]; art: string[] }

/** Each frame from its opening tag to the next, with its `.name` labels. */
function readFrames(html: string): Frame[] {
  // `frame` as a whole class name. `\bframe\b` also matched `spec-frame`, since
  // a hyphen is a word boundary: jig-site's home drawing captioned its rule
  // specimens `spec-frame`, and the gate split every size frame at each one.
  const opens = [...html.matchAll(/<\w+\b[^>]*\bclass\s*=\s*["']([^"']*)["'][^>]*>/gi)]
    .filter((m) => m[1]!.split(/\s+/).includes('frame'));
  return opens.map((open, i) => {
    const tag = open[0];
    const body = html.slice(open.index! + tag.length, opens[i + 1]?.index ?? html.length);
    const size = /\bdata-size\s*=\s*["']([\w-]+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const width = Number(/\bdata-width\s*=\s*["'](\d+)["']/i.exec(tag)?.[1]) || undefined;
    const labels = [...body.matchAll(/<\w+\b[^>]*\bclass\s*=\s*["'][^"']*\bname\b[^"']*["'][^>]*>([^<]*)/gi)]
      .map((m) => normalise(m[1]!))
      .filter(Boolean);
    const art = [...body.matchAll(/<(svg|img|picture|canvas)\b|<i\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:fa|fa-[\w-]+|material-icons|material-symbols[\w-]*|bi|bi-[\w-]+)\b/gi)]
      .map((m) => (m[1] ? `<${m[1].toLowerCase()}>` : 'an icon font'));
    return { size, width, labels, art };
  });
}

/**
 * The regions each size lists. A region written as a short name (`nav`, or
 * `h1: "Versions"`, whose name is before the colon) is looked for by name; one
 * written as a description is counted, because matching a sentence against a
 * label would fail on wording and a gate that cries wolf is ignored.
 */
export function specRegions(specBody: string): Record<string, Array<Region>> {
  const front = specBody.split(/^---\s*$/m)[1] ?? '';
  const sizes = front.split(/^sizes\s*:/im)[1] ?? '';
  const out: Record<string, Array<Region>> = {};
  const own: Record<string, Array<Region>> = {};
  const sameAs: Record<string, string> = {};
  for (const [size] of [...FRAMES, ['landscape', 900] as const]) {
    const block = sizeBlock(sizes, size);
    if (!block) continue;
    const alias = /^\s*same-as\s*:\s*([\w-]+)/im.exec(block)?.[1];
    if (alias) { sameAs[size] = alias.toLowerCase(); continue; }
    own[size] = regionEntries(block).map(regionName);
  }
  for (const size of [...Object.keys(own), ...Object.keys(sameAs)]) {
    let at = size;
    for (let hops = 0; sameAs[at] && hops < 5; hops++) at = sameAs[at]!;
    if (own[at]) out[size] = own[at]!;
  }
  return out;
}

function regionEntries(block: string): string[] {
  const inline = /^\s*regions\s*:\s*\[(.*)\]\s*$/im.exec(block);
  if (inline) return inline[1]!.split(',').map((s) => s.trim()).filter(Boolean);
  const start = /^(\s*)regions\s*:\s*$/im.exec(block);
  if (!start) return [];
  const indent = start[1]!.length;
  const entries: string[] = [];
  for (const line of block.slice(start.index + start[0].length).split('\n')) {
    if (!line.trim()) continue;
    const lead = /^\s*/.exec(line)![0].length;
    if (lead <= indent) break;
    const item = /^\s*-\s*(.+)$/.exec(line);
    if (item) entries.push(item[1]!);
  }
  return entries;
}

/**
 * A region as the spec names it. The name is what comes before the colon, when
 * it is short. A parenthetical qualifies it and is not part of it: "example
 * (rules only)" is the region a drawing labels "example (two specimens)". One
 * that says "only" is conditional, and a drawing of the other case leaves it
 * out. A list, "why, metadata, plain-text twin", names several regions drawn
 * one by one. Seen on jig-site's rule page, whose drawing was flagged for
 * three regions it drew.
 */
interface Region { name?: string; parts?: string[]; optional?: boolean }

function regionName(entry: string): Region {
  const text = entry.trim().replace(/^["']|["']$/g, '').replace(/\\"/g, '"');
  const head = normalise(text.split(':')[0]!);
  const optional = /\([^)]*\bonly\b[^)]*\)/.test(head);
  const bare = stripQualifiers(head);
  if (!bare || bare.split(' ').length > 4) return {};
  const parts = bare.split(/\s*,\s*(?:and\s+)?|\s+and\s+(?=[^,]*$)/).map((p) => p.trim()).filter(Boolean);
  return { name: bare, ...(parts.length > 1 ? { parts } : {}), ...(optional ? { optional } : {}) };
}

function stripQualifiers(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/** Whether a frame's labels show a region: by its whole name, or by each name it lists. */
function regionDrawn(labels: string[], region: Region): boolean {
  const found = (name: string) => labels.some((label) => labelMatches(label, name) || labelMatches(stripQualifiers(label), name));
  return found(region.name!) || (!!region.parts && region.parts.every(found));
}

function labelMatches(label: string, name: string): boolean {
  return label === name || label.startsWith(`${name} `) || label.startsWith(`${name}:`) || new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(label);
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[`"'“”]/g, '').replace(/\s+/g, ' ').trim();
}

function sizeBlock(sizes: string, size: string): string {
  const start = new RegExp(`^(\\s+)${size}\\s*:.*$`, 'im').exec(sizes);
  if (!start) return '';
  const indent = start[1]!.length;
  const lines: string[] = [];
  for (const line of sizes.slice(start.index + start[0].length).split('\n')) {
    if (line.trim() && /^\s*/.exec(line)![0].length <= indent) break;
    lines.push(line);
  }
  return lines.join('\n');
}

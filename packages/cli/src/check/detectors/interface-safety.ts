import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isReaderText } from '../ext.js';
import { mkFinding } from '../finding.js';
import type { Detector, Finding } from '../types.js';

// K-128 to K-131, the ones a file can settle.
//
// Not a security review, and the section says so. These are the interface's own
// four: a new-tab link handing over the window it left, user content written as
// markup, a credential field fighting the password manager, and somebody else's
// code running inside the page with nothing narrowing it.

const BLANK_LINK = /<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi;
const HAS_NOOPENER = /\brel\s*=\s*["'][^"']*\bno(?:opener|referrer)\b/i;
const HTML_SINK = /\bdangerouslySetInnerHTML|\bv-html|\binnerHTML\s*=|\{@html\b/g;
// Inside a <script> this is not markup at all: it is how React emits JSON-LD and
// a nonce'd bootstrap, and both are the idiom. A script's contents are executed
// or parsed as data, never rendered, so the rule does not apply.
const IN_SCRIPT = /<script\b[^>]*$/i;
const SERIALISED = /JSON\.stringify\s*\(/;
// A sink fed a literal is a decision; fed a value, it is the one being warned about.
const LITERAL_SINK = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:\s*["'`]|innerHTML\s*=\s*["'`]/;
const CREDENTIAL_FIELD = /<input\b[^>]*\btype\s*=\s*["'](?:password)["'][^>]*>/gi;
const AUTOCOMPLETE_OFF = /\bautocomplete\s*=\s*["'](?:off|false)["']/i;
const IFRAME = /<iframe\b[^>]*>/gi;
const HAS_SANDBOX = /\bsandbox\s*=/i;
// A same-document frame is not somebody else's code.
const EXTERNAL_SRC = /\bsrc\s*=\s*["'](?:https?:)?\/\//i;

export const interfaceSafety: Detector = {
  name: 'interface-safety',
  appliesTo: (file) => isReaderText(file),
  run(_source, file, ctx) {
    const raw = ctx.raw;
    const starts = buildLineIndex(raw);
    const findings: Finding[] = [];
    const at = (rule: string, offset: number, message: string) => {
      const line = lineForOffset(starts, offset);
      findings.push({ ...mkFinding(ctx, 'interface-safety', file, line, message, sourceLine(raw, line)), ruleId: rule });
    };

    for (const link of raw.matchAll(BLANK_LINK)) {
      if (HAS_NOOPENER.test(link[0])) continue;
      at('K-128', link.index!, 'a link opening a new tab with no rel="noopener" — the page it opens gets a handle on this window and can navigate it elsewhere');
    }

    for (const sink of raw.matchAll(HTML_SINK)) {
      const context = raw.slice(sink.index!, sink.index! + 120);
      if (LITERAL_SINK.test(context) || SERIALISED.test(context)) continue;
      // The open tag this sits inside, if any.
      const before = raw.slice(Math.max(0, sink.index! - 400), sink.index!);
      if (IN_SCRIPT.test(before.slice(before.lastIndexOf('<')))) continue;
      at('K-129', sink.index!, `${sink[0].replace(/\s*=$/, '')} writes a value into the page as markup — render it as text, or sanitise on the way in`);
    }

    for (const field of raw.matchAll(CREDENTIAL_FIELD)) {
      if (!AUTOCOMPLETE_OFF.test(field[0])) continue;
      at('K-130', field.index!, 'a password field with autocomplete off — this stops the password manager, not an attacker, and the reader falls back to one they can remember');
    }

    for (const frame of raw.matchAll(IFRAME)) {
      if (HAS_SANDBOX.test(frame[0]) || !EXTERNAL_SRC.test(frame[0])) continue;
      at('K-131', frame.index!, 'a frame of somebody else\'s page with no sandbox — give it only the capabilities the embed needs');
    }

    return findings.filter((f) => f.ruleId === ctx.ruleId);
  },
};

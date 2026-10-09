import { buildLineIndex, lineForOffset, sourceLine } from '../css.js';
import { isReaderText } from '../ext.js';
import { mkFinding } from '../finding.js';
import { DESCRIPTION_BUDGET, HTML_DESCRIPTION, HTML_DESCRIPTION_REVERSED, TITLE_BUDGET, isWholeDocument, readMetadata } from '../metadata.js';
import type { Detector, Finding } from '../types.js';

// J-121 / J-122 / J-123 / J-125 / J-164, the parts a file can settle on its own.
//
// Frameworks declare metadata in a dozen shapes and a page may inherit all of
// it from a layout, so **absence** is only reported for a document that carries
// its own <head>. Everywhere else the render decides, and the probe reads it.
// What is decidable anywhere is a value this file does write: a title past its
// budget is past it however the framework ships it.
//
// `noindex` is mode-gated. `product` and `operator` are what someone reaches
// after signing in; an admin screen in a search result is an invitation, and a
// sign-in page in one invites credential stuffing.

const HEAD_FRAGMENT = /<svelte:head[\s>]|<head[\s>]|<Head[\s>]|<Helmet[\s>]|slot\s*=\s*["']head["']/;

const INVENTED_DATE = /(?:lastModified|datePublished|dateModified|publishedTime|modifiedTime)\s*:\s*(?:new Date\(\s*\)|Date\.now\(\s*\))/;

export const metadata: Detector = {
  name: 'metadata',
  appliesTo: (file) => isReaderText(file),
  run(_source, file, ctx) {
    const raw = ctx.raw;
    const found = readMetadata(raw);
    const starts = buildLineIndex(raw);
    const findings: Finding[] = [];
    const at = (rule: string, offset: number, message: string) => {
      const line = lineForOffset(starts, offset);
      findings.push({ ...mkFinding(ctx, 'metadata', file, line, message, sourceLine(raw, line)), ruleId: rule });
    };

    // Every title the file writes, not only the first: a route that returns one
    // for a record and another when it is missing declares both, and both ship.
    for (const title of found.titles) {
      if (title.value.length > TITLE_BUDGET) {
        at('J-122', title.index, `the title is ${title.value.length} characters, past the ${TITLE_BUDGET} a search result shows — the end is cut, mid-sentence`);
      }
    }
    if (found.description && found.description.value.length > DESCRIPTION_BUDGET) {
      at('J-122', found.description.index, `the description is ${found.description.value.length} characters, past the ${DESCRIPTION_BUDGET} a search result shows`);
    }

    const invented = INVENTED_DATE.exec(raw);
    if (invented) {
      at('J-125', invented.index, 'a date generated at request time is false on every request, and repeated daily it teaches the crawler to disbelieve the field');
    }

    // Only a whole document can be said to be missing what it never delegates.
    if (isWholeDocument(raw)) {
      const indexable = ctx.mode !== 'product' && ctx.mode !== 'operator';
      if (indexable && !found.hasTitle) {
        at('J-121', 0, 'this page has no <title> — a search result then shows a truncated URL');
      }
      if (indexable && !found.hasDescription) {
        at('J-121', 0, 'this page has no meta description — the search engine writes one from whatever text it finds first, usually the navigation');
      }
      if (indexable && !found.hasPreview) {
        const missing = [!found.hasPreviewTitle && 'og:title', !found.hasPreviewDescription && 'og:description'].filter(Boolean).join(' and ');
        at('J-164', 0, found.hasPreviewTitle || found.hasPreviewDescription
          ? `this page has no ${missing} — a link to it, pasted into a message or a post, shows a card with that part guessed`
          : 'this page has no link preview (og:title and og:description) — a link to it, pasted into a message or a post, shows a card built from whatever the page happens to carry');
      }
      if (!indexable && !found.noindex) {
        at('J-123', 0, `this surface is ${ctx.mode}, which is what somebody reaches after signing in, and the page carries no noindex — robots.txt is public and advisory, and is not this`);
      }
    } else {
      // A head fragment (`<svelte:head>`, Astro, Helmet, `next/head`) that
      // writes this page's own description tag and no og:description. Whatever
      // a layout adds, it cannot know a description written here, so a link to
      // the page shows a card without it. In a control run a SvelteKit page did
      // exactly this, and no whole document was there for the check to read.
      // Only where the file writes into a head: on jig-site a build script's
      // regular expression held the same text.
      const own = HEAD_FRAGMENT.test(raw) ? (HTML_DESCRIPTION.exec(raw) ?? HTML_DESCRIPTION_REVERSED.exec(raw)) : null;
      const indexable = ctx.mode !== 'product' && ctx.mode !== 'operator';
      if (indexable && own && found.description && !found.hasPreviewDescription) {
        at('J-164', own.index, `this file writes the page's description but no og:description${found.hasPreviewTitle ? '' : ' or og:title'} — a link to it, pasted into a message or a post, shows a card without the description written here`);
      }
    }

    // Five rules name this detector, so the runner calls it once per rule.
    // Each call returns its own.
    return findings.filter((f) => f.ruleId === ctx.ruleId);
  },
};

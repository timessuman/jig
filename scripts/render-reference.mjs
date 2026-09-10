#!/usr/bin/env node
/**
 * Render a page range of an image-only PDF to PNGs, for reading a reference
 * that has no text layer.
 *
 * The reconciliation source is a scanned/exported book: no text layer at all,
 * so `pdftotext`-style extraction returns nothing on every page. The `Read`
 * tool renders PDF pages itself, but needs poppler (`pdftoppm`) installed —
 * which needs root. This does the same job with pdfjs plus a prebuilt canvas,
 * no system packages and no sudo.
 *
 * Two dead ends recorded so nobody repeats them:
 *   - Extracting the embedded JPEG streams (`/DCTDecode`) yields illustration
 *     assets, not page renders. The first one out is a decorative background
 *     grid.
 *   - pdfjs reports its own page count, which can differ from what other tools
 *     report for the same file. Trust the page numbers printed on the pages.
 *
 * Usage, from a scratch directory (never commit the PDF — see .gitignore):
 *   npm install pdfjs-dist @napi-rs/canvas
 *   node render-reference.mjs <pdf> <fromPage> <toPage> <outDir>
 *
 * Then read the PNGs — ideally from a subagent, so the page images do not sit
 * in the main conversation's context.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [pdf, from, to, out] = process.argv.slice(2);
if (!pdf || !from || !to || !out) {
  console.error('usage: render-reference.mjs <pdf> <fromPage> <toPage> <outDir>');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const doc = await getDocument({
  data: new Uint8Array(readFileSync(pdf)),
  useSystemFonts: true,
}).promise;

const last = Math.min(Number(to), doc.numPages);
for (let p = Number(from); p <= last; p++) {
  const page = await doc.getPage(p);
  // 1.6 is legible for body text at these page dimensions without producing
  // files large enough to be awkward to read back.
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  writeFileSync(join(out, `p${String(p).padStart(3, '0')}.png`), canvas.toBuffer('image/png'));
}
console.log(`rendered pages ${from}-${last} of ${doc.numPages} to ${out}`);

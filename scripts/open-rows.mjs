#!/usr/bin/env node
/**
 * Print every unreconciled row in RECONCILE.md, grouped by section.
 *
 * Exists because of a real mistake: a chapter of the reference was read by a
 * subagent whose brief was written from memory, and it asked about three open
 * rows while silently omitting two others from the same section. The chapter
 * was then replaced with the next one, so the evidence for those two was gone.
 *
 * Before briefing anyone — a subagent or yourself — to read a chapter, run this
 * and take the questions from its output. A row that is open and belongs to the
 * chapter in hand goes in the brief. No exceptions from memory.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = readFileSync(join(repoRoot, 'RECONCILE.md'), 'utf8').split('\n');

let section = null;
const open = new Map();
for (const line of lines) {
  if (line.startsWith('## ')) section = line.slice(3).trim();
  const row = /^\|\s*([A-Z]+\d+)\s*\|\s*([\s\S]*?)\s*\|/.exec(line);
  if (!row || !line.includes('⬜')) continue;
  if (!open.has(section)) open.set(section, []);
  // First sentence only: enough to recognise the row, short enough to scan.
  const claim = row[2].split(/\.\s|\.\*\*/)[0].replace(/\*\*/g, '').slice(0, 110);
  open.get(section).push(`${row[1]} — ${claim}`);
}

let total = 0;
for (const [name, rows] of open) {
  console.log(`\n${name}`);
  for (const r of rows) console.log(`  ${r}`);
  total += rows.length;
}
console.log(`\n${total} open row(s). Ask about every one that the chapter in hand could answer.`);

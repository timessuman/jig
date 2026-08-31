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

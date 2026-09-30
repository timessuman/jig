import { quoteHeld } from './decisions.js';

/**
 * What Jig records as the owner's word: the one rule, and the one place it is
 * checked.
 *
 * Every time Jig let an agent record something as the owner's, an agent
 * recorded its own reading of what the owner said. A decision's reason quoted
 * words the owner never used; a tweak wrote an exception "given directly by the
 * owner ... by reference rather than words"; a spec gave the owner quotations
 * they had not said; a mockup skip quoted "It uses the Guide's approved
 * layout", a remark about the chrome, with nobody asked. Each was guarded in
 * its own file after it happened, and the next one arrived somewhere unguarded.
 *
 * So the rule is stated once: a word recorded as the owner's is words the
 * owner said, and words that say the thing they are recorded for. The first
 * half is `quoteHeld`. The second is `saysSo`, for the five words that move
 * the work forward on the owner's behalf: confirming a spec, approving or
 * skipping a drawing, leaving a re-judge for later, and a tweak's change.
 */
export type OwnerWord = 'confirm' | 'approve' | 'skip' | 'defer';

const SAYS: Record<OwnerWord, RegExp> = {
  confirm: /\b(confirm(s|ed)?|yes|yep|approve[ds]?|looks (good|right|fine)|lgtm|go ahead|agreed|that['’]?s right|correct|ok(ay)?)\b|^\s*go\b/im,
  approve: /\b(approve[ds]?|looks (good|right|fine)|lgtm|yes|go ahead|good to go|confirm(s|ed)?|agreed|build it|that['’]?s (it|right)|ok(ay)?)\b/i,
  skip: /\bskip|\bno (mockup|drawing)|without (a )?(mockup|drawing)|(don['’]?t|do not|no need to) (draw|mock)|(mockup|drawing) (isn['’]?t|is not) needed/i,
  defer: /\b(later|at ship|defer(red)?|wait|leave (it|the critique|the re-?judge)|(don['’]?t|do not) (re-?judge|critique)|no (re-?judge|critique)|skip the (re-?judge|critique))\b/i,
};

/** Whether the words say the thing: a yes, an approval, a skip, a deferral. */
export function saysSo(word: OwnerWord, text: string): boolean {
  return SAYS[word].test(text);
}

const WHAT: Record<OwnerWord, string> = {
  confirm: 'confirm the spec',
  approve: 'approve the drawing',
  skip: 'skip the mockup',
  defer: 'leave the re-judge for later',
};

/**
 * The problem with recording `quoted` as the owner's word to `word`, or none.
 * `owner` is everything the owner said in the session.
 */
export function ownerWordProblem(word: OwnerWord, quoted: string, owner: string, where: string): string | undefined {
  const q = quoted.replace(/^["“]|["”]$/g, '').trim();
  if (!q) return `${where} records the owner's word to ${WHAT[word]} without their words. Quote what they said.`;
  if (!quoteHeld(q, owner)) return `${where} quotes "${q}", which the owner did not say in this session. Quote their reply as they wrote it; a word nobody gave is not one.`;
  if (!saysSo(word, q)) return `${where} quotes "${q}", which does not ${WHAT[word]}. Words the owner said about something else are not their word on this: ask them, and quote the answer.`;
  return undefined;
}

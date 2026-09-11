export interface Rule {
  id: string;
  section: string;
  number: number;
  title: string;
  wrong: string;
  correction: string;
  /**
   * The prose after the correction, line by line.
   *
   * 40 of the 104 rules carry it — 96 lines — and it was parsed away for three
   * releases, so `jig explain` showed a ❌/✅ pair and none of the reasoning
   * behind it. `A-04` explains why shadow-only definition cannot hold 3:1;
   * `C-22` loses sixteen lines. The rules were written with that reasoning and
   * shipped without it, which is the worst of both: the text is in the tarball,
   * in every skill directory, and unreachable through the command built to read
   * it.
   */
  notes: string[];
  /**
   * Prose between the heading and the ❌, where a rule has any.
   *
   * `C-49` opens with two paragraphs and a three-row table distinguishing when
   * a link needs colour, when it needs an underline, and when neither is
   * required. Its pair alone says "keep the underline" and omits every case the
   * table exists to draw. Collecting only what follows the correction looked
   * like a complete fix because the rules carrying the MOST prose happen to
   * carry it at the end.
   */
  preamble: string[];
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
        notes: [],
        preamble: [],
        source: `${sourceFile}#${id.toLowerCase()}`,
      };
      continue;
    }
    if (!current) continue;

    // Any other heading ends the rule. Without this a section break would let
    // one rule absorb the next section's prose — harmless while only ❌/✅ were
    // collected, and wrong the moment anything else is.
    if (line.startsWith('#')) {
      push();
      current = null;
      continue;
    }

    if (line.startsWith('❌') && !current.wrong) {
      current.wrong = line.slice(1).trim();
    } else if (line.startsWith('✅') && !current.correction) {
      current.correction = line.slice(1).trim();
    } else {
      // Before the ❌ it is preamble, after the ✅ it is reasoning. Blank lines
      // and `---` separators carry no information and would only make every
      // excerpt ragged.
      const text = line.trim();
      if (!text || /^-{3,}$/.test(text)) continue;
      (current.correction ? current.notes : current.preamble).push(text);
    }
  }
  push();
  return rules;
}

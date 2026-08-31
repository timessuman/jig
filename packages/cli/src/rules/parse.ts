export interface Rule {
  id: string;
  section: string;
  number: number;
  title: string;
  wrong: string;
  correction: string;
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
        source: `${sourceFile}#${id.toLowerCase()}`,
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('❌') && !current.wrong) {
      current.wrong = line.slice(1).trim();
    } else if (line.startsWith('✅') && !current.correction) {
      current.correction = line.slice(1).trim();
    }
  }
  push();
  return rules;
}

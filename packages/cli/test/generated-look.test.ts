import { describe, it, expect } from 'vitest';
import {
  sideTabBorder, roundedAccentBorder, decorativeGridBackground, glowAccent, creamPalette,
  pulsingDot, italicSerifDisplay, headingKicker, eyebrowChip, numberedSectionLabels,
} from '../src/check/detectors/generated-look.js';
import { maskNonStyleRegions } from '../src/check/styles.js';
import type { Detector, DetectorContext } from '../src/check/types.js';

/**
 * The generated-page tells (A-135 to A-146, G-145). Each detector is tried on
 * the shape it names, in CSS and in utility classes, and on the nearest shape
 * that is not it: the conventional case the rule itself allows.
 */
const ctx = (raw: string): DetectorContext => ({ ruleId: 'X-0', bucket: 'hybrid', severity: 'warning', tokens: {}, projectParticipates: false, raw });
const run = (d: Detector, file: string, raw: string) => {
  const source = file.endsWith('.css') ? raw : maskNonStyleRegions(raw, file);
  return d.run(source, file, ctx(raw));
};
const html = (body: string) => `<!doctype html><html><head><title>t</title></head><body><main>\n${body}\n</main></body></html>`;

describe('side-tab-border (A-139)', () => {
  it('fires on a thick coloured stripe down one side, in CSS and in classes', () => {
    expect(run(sideTabBorder, 'a.css', '.card {\n  border: 1px solid #e5e5e5;\n  border-left: 4px solid #2563eb;\n}')).toHaveLength(1);
    expect(run(sideTabBorder, 'a.html', html('<div class="rounded-lg border-l-4 border-blue-500 p-4">Plan</div>'))).toHaveLength(1);
  });
  it('leaves a quotation, a neutral divider, and an equal border alone', () => {
    expect(run(sideTabBorder, 'a.css', 'blockquote {\n  border-left: 4px solid #2563eb;\n}')).toEqual([]);
    expect(run(sideTabBorder, 'a.css', '.card {\n  border-left: 4px solid #d4d4d4;\n}')).toEqual([]);
    expect(run(sideTabBorder, 'a.html', html('<div class="border-4 border-l-4 border-blue-500">x</div>'))).toEqual([]);
  });
});

describe('rounded-accent-border (A-140)', () => {
  it('fires on a thick coloured outline around a large radius', () => {
    expect(run(roundedAccentBorder, 'a.css', '.card {\n  border: 2px solid #7c3aed;\n  border-radius: 20px;\n}')).toHaveLength(1);
    expect(run(roundedAccentBorder, 'a.html', html('<a class="border-2 border-indigo-500 rounded-full px-4">Start</a>'))).toHaveLength(1);
  });
  it('leaves a hairline, a small radius, and a grey outline alone', () => {
    expect(run(roundedAccentBorder, 'a.css', '.card {\n  border: 1px solid #7c3aed;\n  border-radius: 20px;\n}')).toEqual([]);
    expect(run(roundedAccentBorder, 'a.css', '.card {\n  border: 2px solid #7c3aed;\n  border-radius: 4px;\n}')).toEqual([]);
    expect(run(roundedAccentBorder, 'a.html', html('<div class="border-2 border-gray-300 rounded-2xl">x</div>'))).toEqual([]);
  });
});

describe('decorative-grid-background (A-143)', () => {
  it('fires on grid lines, and on repeating stripes', () => {
    const grid = '.hero {\n  background-image: linear-gradient(#0001 1px, transparent 1px), linear-gradient(90deg, #0001 1px, transparent 1px);\n  background-size: 24px 24px;\n}';
    expect(run(decorativeGridBackground, 'a.css', grid)).toHaveLength(1);
    expect(run(decorativeGridBackground, 'a.css', '.band {\n  background: repeating-linear-gradient(45deg, #eee 0 8px, #fff 8px 16px);\n}')).toHaveLength(1);
    expect(run(decorativeGridBackground, 'a.html', html('<section class="bg-[linear-gradient(#0001_1px,transparent_1px),linear-gradient(90deg,#0001_1px,transparent_1px)] bg-[size:24px_24px]">x</section>'))).toHaveLength(1);
  });
  it('leaves a single gradient and a plain surface alone', () => {
    expect(run(decorativeGridBackground, 'a.css', '.hero {\n  background: linear-gradient(#fff, #f5f5f5);\n}')).toEqual([]);
  });
});

describe('glow-accent (A-144)', () => {
  it('fires on an unoffset, blurred, saturated shadow', () => {
    expect(run(glowAccent, 'a.css', '.btn {\n  box-shadow: 0 0 24px #22d3ee;\n}')).toHaveLength(1);
    expect(run(glowAccent, 'a.html', html('<button class="shadow-[0_0_20px_#a855f7]">Go</button>'))).toHaveLength(1);
    expect(run(glowAccent, 'a.html', html('<div class="shadow-xl shadow-cyan-500/50">x</div>'))).toHaveLength(1);
  });
  it('leaves an offset shadow, a grey one, and a focus ring alone', () => {
    expect(run(glowAccent, 'a.css', '.card {\n  box-shadow: 0 4px 12px rgba(0,0,0,.1);\n}')).toEqual([]);
    expect(run(glowAccent, 'a.css', '.card {\n  box-shadow: 0 0 16px rgba(0,0,0,.2);\n}')).toEqual([]);
    expect(run(glowAccent, 'a.css', '.btn:focus {\n  box-shadow: 0 0 0 3px #2563eb;\n}')).toEqual([]);
  });
});

describe('cream-palette (A-137)', () => {
  it('fires on a cream page surface, as CSS, a token, or a class on the body', () => {
    expect(run(creamPalette, 'a.css', 'body {\n  background: #f5f0e8;\n}')).toHaveLength(1);
    expect(run(creamPalette, 'a.css', ':root {\n  --color-bg: #faf7f2;\n}')).toHaveLength(1);
    expect(run(creamPalette, 'a.html', '<html><body class="bg-amber-50 text-stone-800"><main>x</main></body></html>')).toHaveLength(1);
  });
  it('leaves white, a neutral grey, and a cream accent on a small element alone', () => {
    expect(run(creamPalette, 'a.css', 'body {\n  background: #fafafa;\n}')).toEqual([]);
    expect(run(creamPalette, 'a.css', '.badge {\n  background: #f5f0e8;\n}')).toEqual([]);
  });
});

describe('pulsing-dot (G-145)', () => {
  it('fires on a pinging or pulsing dot', () => {
    expect(run(pulsingDot, 'a.html', html('<span class="size-2 rounded-full bg-green-500 animate-ping"></span> Operational'))).toHaveLength(1);
    expect(run(pulsingDot, 'a.html', html('<span class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>'))).toHaveLength(1);
    expect(run(pulsingDot, 'a.css', '.live {\n  border-radius: 50%;\n  animation: pulse 2s infinite;\n}')).toHaveLength(1);
    // The pulse on a class in the stylesheet, the dot's shape on the element.
    const split = '<html><head><style>\n.status-pulse { animation: pulse-glow 2s ease infinite; }\n</style></head><body><main>\n<span class="w-2 h-2 bg-green-500 rounded-full status-pulse"></span> Operational\n</main></body></html>';
    expect(run(pulsingDot, 'a.html', split)).toHaveLength(1);
  });
  it('leaves a pulsing skeleton block alone', () => {
    expect(run(pulsingDot, 'a.html', html('<div class="h-4 w-48 rounded bg-gray-200 animate-pulse"></div>'))).toEqual([]);
  });
});

describe('italic-serif-display (A-138)', () => {
  it('fires on an italic serif headline, or an italic serif word inside one', () => {
    expect(run(italicSerifDisplay, 'a.css', 'h1 {\n  font-family: "Instrument Serif", Georgia, serif;\n  font-style: italic;\n}')).toHaveLength(1);
    expect(run(italicSerifDisplay, 'a.html', html('<h1 class="font-serif text-6xl">Beautifully <em>crafted</em></h1>'))).toHaveLength(1);
    // The serif on a class in the stylesheet, as a generated editorial page writes it.
    const page = '<html><head><style>\n.display { font-family: "Cormorant Garamond", Georgia, serif; }\n</style></head><body><main>\n<h1 class="display text-8xl">A room worth staying <em>a while</em> in.</h1>\n</main></body></html>';
    expect(run(italicSerifDisplay, 'a.html', page)).toHaveLength(1);
  });
  it('leaves an upright serif headline and an italic sans one alone', () => {
    expect(run(italicSerifDisplay, 'a.html', html('<h1 class="font-serif text-6xl">Search your logs</h1>'))).toEqual([]);
    expect(run(italicSerifDisplay, 'a.css', 'h1 {\n  font-family: Inter, sans-serif;\n  font-style: italic;\n}')).toEqual([]);
  });
});

describe('heading-kicker (A-135) and eyebrow-chip (A-136)', () => {
  const kicker = (t: string, h: string) => `<p class="text-xs uppercase tracking-widest text-gray-500">${t}</p>\n<h2>${h}</h2>`;
  it('fires on a small caps line over every heading, and on a pill over the headline', () => {
    expect(run(headingKicker, 'a.html', html(kicker('Features', 'What you get') + kicker('How it works', 'Three steps')))).toHaveLength(2);
    expect(run(eyebrowChip, 'a.html', html('<span class="inline-flex rounded-full border px-3 py-1 text-sm">Introducing v2</span>\n<h1>Search your logs</h1>'))).toHaveLength(1);
    // With its own dot inside, as a generated hero writes it.
    expect(run(eyebrowChip, 'a.html', html('<span class="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">\n  <span class="h-1.5 w-1.5 rounded-full bg-teal-400"></span> Built for teams of 2-50\n</span>\n<h1 class="text-6xl">Ask your logs</h1>'))).toHaveLength(1);
  });
  it('leaves one label over one heading alone, and a pill that is not over the headline', () => {
    expect(run(headingKicker, 'a.html', html(kicker('Pricing', 'Plans')))).toEqual([]);
    expect(run(eyebrowChip, 'a.html', html('<span class="rounded-full border px-3 py-1">New</span>\n<h2>Changelog</h2>'))).toEqual([]);
  });
});

describe('numbered-section-labels (A-146)', () => {
  it('fires on 0N labels over section headings', () => {
    const body = '<span class="text-xs">01</span><h2>Discover</h2>\n<span class="text-xs">02</span><h2>Design</h2>';
    expect(run(numberedSectionLabels, 'a.html', html(body))).toHaveLength(2);
  });
  it('leaves an ordered list of real steps alone, and a single number', () => {
    expect(run(numberedSectionLabels, 'a.html', html('<ol><li><span>01</span><h3>Install</h3></li><li><span>02</span><h3>Run</h3></li></ol>'))).toEqual([]);
    expect(run(numberedSectionLabels, 'a.html', html('<span>01</span><h2>Only one</h2>'))).toEqual([]);
  });
});

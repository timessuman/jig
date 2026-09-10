const $ = (s) => document.querySelector(s);

// Mode and theme switching. One brand file and one mode file are active at a
// time, which is what the system requires of any real surface.
document.querySelectorAll('.bar button[data-mode]').forEach((b) =>
  b.addEventListener('click', () => {
    // Listener first: the new stylesheet loads asynchronously, so reading the
    // computed values before `load` fires would report the outgoing mode.
    $('#mode').addEventListener('load', () => { renderDiagnostics(); annotateType(); }, { once: true });
    $('#mode').href = `../../tokens/mode.${b.dataset.mode}.css`;
    document.querySelectorAll('.bar button[data-mode]').forEach((o) =>
      o.setAttribute('aria-pressed', String(o === b)));
  }));

// SCOPED TO THE BAR. `<html>` carries data-theme as the theme itself, so a bare
// `[data-theme]` selector matched three elements, not two: the click listener
// was attached to <html> as well, which meant clicking ANYWHERE on the page ran
// the theme handler and reset both buttons to aria-pressed="false". It also made
// `document.querySelector('[data-theme="dark"]')` return <html> rather than the
// button once dark was active — the state marker and the controls that set it
// cannot share a selector.
document.querySelectorAll('.bar button[data-theme]').forEach((b) =>
  b.addEventListener('click', () => {
    document.documentElement.dataset.theme = b.dataset.theme;
    document.querySelectorAll('.bar button[data-theme]').forEach((o) =>
      o.setAttribute('aria-pressed', String(o === b)));
    renderDiagnostics();
  }));

// Specimens generated from the token names, so a renamed or removed token
// shows up here as a blank swatch rather than silently passing.
// Token names are written out in full rather than interpolated, so the
// coverage check (rule 6) can find them with a literal search. A clever check
// that expands `--color-text-${n}` would be a check with its own bugs.
const SEMANTIC = [
  { name: 'error',   text: '--color-text-error',   fill: '--color-fill-error',   weak: '--color-stroke-error-weak',   strong: '--color-stroke-error-strong' },
  { name: 'warning', text: '--color-text-warning', fill: '--color-fill-warning', weak: '--color-stroke-warning-weak', strong: '--color-stroke-warning-strong' },
  { name: 'success', text: '--color-text-success', fill: '--color-fill-success', weak: '--color-stroke-success-weak', strong: '--color-stroke-success-strong' },
  { name: 'info',    text: '--color-text-info',    fill: '--color-fill-info',    weak: '--color-stroke-info-weak',    strong: '--color-stroke-info-strong' },
];

$('#semantics').innerHTML = SEMANTIC.map((c) => `
  <div class="swatch">
    <div class="chip" style="background:var(${c.text})"></div>
    <div class="meta">
      <div style="color:var(${c.text})">${c.name} — text</div>
      <div style="border-top:1px solid var(${c.strong});margin-top:var(--spacing-2xs);padding-top:var(--spacing-2xs);font-size:var(--text-caption);color:var(--color-text-weak)">stroke-strong above</div>
      <code>${c.text}</code>
    </div>
  </div>`).join('');

$('#onfill').innerHTML = SEMANTIC.map((c) =>
  `<span class="tag" style="color:var(${c.text});background:var(${c.fill});border-color:var(${c.weak})">${c.name} on fill</span>`
).join('');

const TYPE = [
  ['--text-caption', '--leading-caption'], ['--text-body', '--leading-body'],
  ['--text-prose', '--leading-prose'], ['--text-lead', '--leading-lead'],
  ['--text-h3', '--leading-h3'], ['--text-h2', '--leading-h2'], ['--text-h1', '--leading-h1'],
];
$('#type').innerHTML = TYPE.map(([size, leading]) => `
  <p data-token="${size}" style="font-size:var(${size});line-height:var(${leading});margin-block:var(--spacing-xs)">
    ${size.replace('--text-', '')} — the quick brown fox jumps over the lazy dog
    <code style="color:var(--color-text-weak);font-size:var(--text-caption)">${size}</code>
    <code class="computed"></code>
  </p>`).join('');

// --text-h1 and --text-h2 are clamp() in editorial and product, so the specimen
// alone cannot tell you whether a fluid size is behaving — at any one width it
// looks like a fixed number. Print what each token ACTUALLY computes to at the
// current viewport, name the range for the fluid ones, and re-read on resize.
// Without this the preview renders every token and still shows nothing about
// the one property most likely to break.
function annotateType() {
  const root = getComputedStyle(document.documentElement);
  document.querySelectorAll('#type p[data-token]').forEach((p) => {
    const declared = root.getPropertyValue(p.dataset.token).trim();
    const px = Math.round(parseFloat(getComputedStyle(p).fontSize) * 10) / 10;
    const rems = [...declared.matchAll(/([\d.]+)rem/g)].map((m) => Number(m[1]) * 16);
    p.querySelector('.computed').textContent = declared.startsWith('clamp(')
      ? `${px}px — fluid ${rems[0]}–${rems[rems.length - 1]} @ ${window.innerWidth}px wide`
      : `${px}px — fixed`;
  });
}
annotateType();
addEventListener('resize', annotateType);

const SPACE = ['--spacing-2xs', '--spacing-xs', '--spacing-s', '--spacing-m',
               '--spacing-l', '--spacing-xl', '--spacing-xxl'];
$('#spacing').innerHTML = SPACE.map((t) => `
  <div style="display:flex;align-items:center;gap:var(--spacing-s);margin-block:var(--spacing-2xs)">
    <div style="height:var(--spacing-s);width:var(${t});background:var(--color-brand)"></div>
    <code style="color:var(--color-text-weak);font-size:var(--text-caption)">${t}</code>
  </div>`).join('');

/* ---- Sections covering the remaining tokens ---------------------------
   Every token defined in tokens/ must appear somewhere in this directory.
   check-tokens.mjs rule 6 enforces that, so a new token cannot be added
   without also being rendered. ------------------------------------------ */

const el = (id) => document.getElementById(id);

el('elevation').innerHTML = [
  ['--color-bg-base', '--shadow-none', 'base · no shadow'],
  ['--color-bg-raised', '--shadow-raised', 'raised · raised shadow'],
  ['--color-bg-overlay', '--shadow-overlay', 'overlay · overlay shadow'],
].map(([bg, sh, label]) => `
  <div style="background:var(${bg});box-shadow:var(${sh});border-radius:var(--radius-surface);padding:var(--spacing-card);min-width:12rem">
    <div>${label}</div><code>${bg}</code><br><code>${sh}</code>
  </div>`).join('');

el('states').innerHTML = [
  ['--color-state-hover', 'hover layer'],
  ['--color-state-press', 'press layer'],
  ['--color-focus', 'focus colour'],
].map(([t, label]) => `
  <div class="swatch" style="min-width:11rem">
    <div class="chip" style="background:var(${t})"></div>
    <div class="meta">${label}<br><code>${t}</code></div>
  </div>`).join('');

el('icons').innerHTML = [
  ['--color-icon', 'icon', 'settings'],
  ['--color-icon-weak', 'icon weak', 'chevron-right'],
].map(([t, label, name]) => `
  <span style="display:inline-flex;align-items:center;gap:var(--spacing-inline);color:var(${t})">
    <i data-lucide="${name}" aria-hidden="true"></i>
    ${label} <code>${t}</code>
  </span>`).join('');

el('brandvars').innerHTML = [
  '--color-text-brand', '--color-stroke-brand-strong', '--color-stroke-brand-weak',
  '--color-fill-brand', '--color-on-brand',
].map((t) => `
  <div class="swatch" style="min-width:11rem">
    <div class="chip" style="background:var(${t})"></div>
    <div class="meta"><code>${t}</code></div>
  </div>`).join('');

el('radius').innerHTML = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-full']
  .map((t) => `
    <div style="width:6rem;height:6rem;background:var(--color-fill);border:1px solid var(--color-stroke-strong);border-radius:var(${t});display:grid;place-items:center;text-align:center">
      <code style="font-size:var(--text-caption)">${t.replace('--radius-', '')}</code>
    </div>`).join('');

el('families').innerHTML = `
  <p style="font-family:var(--font-display);font-size:var(--text-h3);margin-block:var(--spacing-xs)">Display face — headings <code>--font-display</code></p>
  <p style="font-family:var(--font-text);margin-block:var(--spacing-xs)">Text face — body copy <code>--font-text</code></p>
  <p style="font-family:var(--font-mono);margin-block:var(--spacing-xs)">Mono face — code <code>--font-mono</code></p>
  <p style="font-weight:var(--font-weight-bold);margin-block:var(--spacing-xs)">Bold weight <code>--font-weight-bold</code></p>
  <p style="font-family:var(--font-numeric);font-feature-settings:var(--font-numeric-features);margin-block:var(--spacing-xs)">
    Tabular numerals 1,240.00 / 880.50 <code>--font-numeric</code> <code>--font-numeric-features</code></p>`;

el('grid-demo').innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(var(--grid-columns),1fr);gap:var(--grid-gutter);padding-inline:var(--grid-margin);background:var(--color-fill);border-radius:var(--radius-surface);padding-block:var(--spacing-s);margin-top:var(--spacing-s)">
    ${Array.from({ length: 12 }, () => '<div style="height:var(--spacing-l);background:var(--color-fill-brand);border:1px solid var(--color-stroke-brand-weak)"></div>').join('')}
  </div>
  <p class="note"><code>--grid-columns</code> · <code>--grid-gutter</code> · <code>--grid-margin</code> — the wide-viewport values.</p>

  <div style="display:grid;grid-template-columns:repeat(var(--grid-columns-sm),1fr);gap:var(--grid-gutter-sm);padding-inline:var(--grid-margin-sm);background:var(--color-fill);border-radius:var(--radius-surface);padding-block:var(--spacing-s);margin-top:var(--spacing-s)">
    ${Array.from({ length: 4 }, () => '<div style="height:var(--spacing-l);background:var(--color-fill-brand);border:1px solid var(--color-stroke-brand-weak)"></div>').join('')}
  </div>
  <p class="note"><code>--grid-columns-sm</code> · <code>--grid-gutter-sm</code> · <code>--grid-margin-sm</code> — the small-viewport values, shown here at full width because nothing switches between the two: this system defines no breakpoint. The consuming project chooses where to swap. <code>--grid-margin-sm</code> is the gutter <code>T22</code> examined and kept.</p>`;

el('motion').innerHTML = [
  ['--duration-fast', '--ease-out'],
  ['--duration-base', '--ease-out'],
  ['--duration-slow', '--ease-in-out'],
].map(([d, e]) => `
  <div class="motion-chip" style="transition-duration:var(${d});transition-timing-function:var(${e})">
    <code>${d.replace('--duration-', '')}</code><br><code style="font-size:var(--text-caption)">${e}</code>
  </div>`).join('');

// Ambient motion (P-13). Three layers, each on a different period, so the
// composition never re-aligns into one pulse. Deliberately understated: if you
// notice a layer while reading the note above it, the value is wrong.
el('ambient').innerHTML = [
  ['--duration-ambient-fast', 'drift'],
  ['--duration-ambient-base', 'sway'],
  ['--duration-ambient-slow', 'breathe'],
].map(([d, name]) => `
  <div class="ambient-layer ambient-${name}" style="animation-duration:var(${d})">
    <code>${d.replace('--duration-', '')}</code>
  </div>`).join('');

el('roles').innerHTML = [
  '--spacing-section', '--spacing-section-sm', '--spacing-card', '--spacing-stack',
  '--spacing-group', '--spacing-label', '--spacing-inline',
  '--spacing-heading-before', '--spacing-heading-after',
].map((t) => `
  <div style="display:flex;align-items:center;gap:var(--spacing-s);margin-block:var(--spacing-2xs)">
    <div style="height:var(--spacing-s);width:var(${t});background:var(--color-stroke-strong);flex:none"></div>
    <code style="font-size:var(--text-caption)">${t}</code>
  </div>`).join('');

el('touch').innerHTML = `
  <span style="display:inline-grid;place-items:center;min-width:var(--size-touch-target);min-height:var(--size-touch-target);outline:1px dashed var(--color-stroke-strong)">
    <button class="btn btn-secondary" style="min-height:var(--size-control)">Control</button>
  </span>
  <span style="display:inline-grid;place-items:center;min-width:var(--size-touch-target);min-height:var(--size-touch-target);outline:1px dashed var(--color-stroke-strong);margin-inline-start:var(--spacing-s)">
    <button class="btn btn-secondary" style="min-height:var(--size-control-sm);font-size:var(--text-caption)">Small</button>
  </span>
  <p class="note">Dashed boxes are <code>--size-touch-target</code>; the buttons are <code>--size-control</code> and <code>--size-control-sm</code>. The small control still sits inside a full touch target — the target is an accessibility floor and does not shrink with the control.</p>

  <div style="margin-top:var(--spacing-s);border:1px solid var(--color-stroke-weak);border-radius:var(--radius-surface);overflow:hidden">
    <div style="height:var(--size-row);display:flex;align-items:center;padding-inline:var(--spacing-s);border-bottom:1px solid var(--color-stroke-weak)"><code>--size-row</code></div>
    <div style="height:var(--size-row-compact);display:flex;align-items:center;padding-inline:var(--spacing-s)"><code>--size-row-compact</code></div>
  </div>
  <p class="note">Row heights. Both are undefined in <code>editorial</code> and <code>--size-row-compact</code> only in <code>operator</code>, so these rows collapse to their content in the modes that do not define them — the mode table's <code>—</code> showing itself.</p>`;

// Re-rendered on every mode and theme switch, not once at load. It used to be
// written a single time, so after switching mode the table still reported the
// mode the page had opened with — a diagnostics panel that states the wrong
// mode is worse than none, because the values beside it are then read as
// belonging to a mode they do not.
function renderDiagnostics() {
  const cs = getComputedStyle(document.documentElement);
  el('diag').innerHTML = `
  <table><tbody>${[
    '--mode', '--brand-h', '--brand-s', '--brand-l',
    // The full channel set, not just the hues. These are the raw inputs the
    // semantic colours are derived from; showing only `-h` meant `-s`, `-l` and
    // `-fill-a` were defined values nobody had ever looked at.
    '--error-h', '--error-s', '--error-l', '--error-fill-a',
    '--warning-h', '--warning-s', '--warning-l', '--warning-fill-a',
    '--success-h', '--success-s', '--success-l', '--success-fill-a',
    '--info-h', '--info-s', '--info-l', '--info-fill-a',
    '--tracking-body', '--measure-prose', '--size-row',
  ].map((t) => `<tr><td><code>${t}</code></td><td class="num">${cs.getPropertyValue(t).trim() || '—'}</td></tr>`).join('')}</tbody></table>`;
}
renderDiagnostics();


// Render Lucide icons after all sections exist. If the CDN did not load, the
// `data-lucide` elements stay empty and every label beside them still reads —
// the preview degrades rather than breaking.
if (window.lucide) {
  lucide.createIcons({ attrs: { width: 'var(--size-icon)', height: 'var(--size-icon)' } });
} else {
  console.warn('Lucide CDN unavailable — icons omitted, labels intact.');
}

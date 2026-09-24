# Examples

One file per rule, `<ID>.html`, showing what the rule forbids and what it asks for
instead. A rule describes a failure in words; a reader recognises it by sight, and
most of these failures are things people have seen a hundred times without a name
for them. The example is the picture beside the name.

## Shape

```html
<!-- A-58 · Decorative styling that implies meaning -->
<figure data-example="dont">
  …the failure, as small as it can be and still be recognised…
</figure>
<figure data-example="do">
  …the same content, done the way the rule asks…
</figure>
```

- **Exactly one `dont` and one `do`.** The `do` shows the same content, not a
  different, easier one. A fix that changes the content proves nothing.
- **Self-contained.** Styles are `style` attributes on the elements. No `<style>`,
  `<script>`, `<link>`, event handler, or external URL. A consumer renders a figure
  in a sandboxed frame or an inert box, and it has to look the same in both.
- **Small.** A figure is drawn for a box about 320 by 180 pixels. It exaggerates
  just enough to be recognised, and no more.
- **Raw values are fine here.** An example has to show violet, a glow, a 44px
  radius. It is a specimen of the failure, not a component, so the token rule
  that governs a real page does not apply inside it.
- **The `do` follows every rule**, not only its own. A fix that commits a
  different failure teaches the second one.

## Not for everything visible

Some rules are about code, metadata or behaviour and have no look. Their example
shows what a person meets because of it: the search result a missing description
produces, the tab a link hands over, the field a password manager cannot fill.
Where even that is impossible, the figure shows the code, set as code.

## Checked

`packages/cli/test/examples.test.ts` fails when a rule has no example, when a file
has other than one `dont` and one `do`, or when a figure carries anything that
would not render the same in a sandbox.

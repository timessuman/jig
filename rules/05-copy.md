# 05 · Copy

**Status:** draft v0.1
**Scope:** universal. Interface text in every mode, and the prose a page ships: docs, guides, marketing pages, blog posts.
**Load when:** writing or reviewing any user-facing string — labels, buttons, headings, errors, empty states, help text — or any prose longer than a paragraph.

Interface text is interface design. A screen with perfect spacing and a vague button label is a broken screen. Most of what follows costs nothing to apply and is invisible when done well.

Rules keep the `I-` prefix and their original numbers, which is why they are not contiguous — numbers are stable identifiers, never renumbered (`00-anti-patterns.md`).

---

## Voice

### I-53 Title Case Used For Interface Text
❌ "Add To Cart", "Save Post for Later?"
✅ Sentence case: only the first word and proper nouns capitalised. "Add to cart", "Save post for later?"
Title case is harder to read — the eye expects lowercase, and each capital interrupts the scan. Its rules are also not standardised, so it is applied inconsistently even by people trying. Applies to headings, buttons, labels, menu items, table headers and dialog titles alike.

### I-55 Vague or inflated language
❌ "Utilise", "leverage", "seamlessly", "Custom domains are the bee's knees"
✅ Write as if talking to a capable person unfamiliar with the topic. Short words over long ones. No jargon, no slang, no technical vocabulary the reader has not been given. Contractions are good — "you're", "they're", "who's" — they read as speech rather than documentation.

### I-79 Padding words and introductory phrases
❌ "Would you like to save the article? Don't worry, you'll still be able to publish it later."
✅ "Save article? Save the article to your library to publish later"
Cut: **filler** — actually, basically, really, truthfully, quite. **Introductory phrases** — "would you like to", "in order to", "when it comes to", "are you sure", "there are", "it is". **Articles**, where the meaning survives without them.
Keep sentences under 20 words. A sentence with several commas loses the reader partway.
The test: remove a word. If nothing is lost, it was not doing anything.

---

## Structure

### I-54 Text that buries the point
❌ "You should read these 5 UI design eBooks", "Subscribe to my newsletter to learn UI design"
✅ Front-load — the key information first. "5 UI design eBooks you should read", "Learn UI design by subscribing to my newsletter"
People scan the first two or three words of a line and skip the rest. Applies hardest to headings, links and buttons, which are also read out of context by screen readers.

### I-80 Long text without a structure
❌ A run of text with no ordering — context first, the conclusion buried in the middle, and the thing the reader has to do somewhere near the end.
✅ For anything longer than a sentence, use the **inverted pyramid**: most important information first, supporting detail next, background last.

| Layer | Goes in |
| --- | --- |
| Most important | The heading — enough on its own to complete the task |
| Supporting | The paragraph beneath, for those who need more |
| Background | A separate screen or a disclosure (`P-11`) |

Someone who reads only the heading still gets the point. Someone who needs the detail can find it. Nobody is made to read background information to reach the action.

### I-81 Vague headings
❌ "Location", "Check-in", "Parking"
✅ "Beautiful waterfront location", "Fast check-in experience", "Free secure parking"
A heading must carry its own meaning. People scan headings and skip the supporting text, and screen reader users routinely pull up a list of every heading on a page to navigate — a list of one-word labels tells them nothing.
Break long passages into groups with a descriptive heading each, rather than one unbroken block.
**The same holds for a page's headline.** "Build the future of work", "Your all-in-one platform", "Where ideas come to life" could sit above any product, which means they say nothing about this one. A headline names what the product does and for whom: "Search your logs by asking in plain English". If it would still be true after swapping in a competitor's name, rewrite it.

### I-82 Uneven text length across parallel elements
❌ Three feature columns of two, four and three lines
✅ Write parallel elements to a similar length. Uneven blocks break the alignment that groups them (`03` layout method) and make a tidy layout look accidental. Edit the long one down rather than padding the short one.

---

## Words

### I-83 Numbers spelled out
❌ "eight hundred and ninety nine designers"
✅ "899 designers". Numerals have a different shape to letters, so they are faster to find and read, and anyone looking for a figure expects a figure.
Format consistently: **1,000** not 1000. For very large numbers, mix numerals and words — **1 billion**, not 1,000,000,000 — so nobody has to count digits.

### I-84 Abbreviations and acronyms
❌ "Apt. no.", "The ETA of the dept. manager is COB tomorrow"
✅ "Apartment number". Write it out. Abbreviations save a few characters and cost the reader a moment of decoding every time.
Where one is genuinely necessary, expand it on first use: "ETA (estimated time of arrival)". Best is usually to remove it altogether, even if the sentence gets longer.

### I-85 UPPERCASE
❌ Uppercase sentences, uppercase buttons, uppercase anything long
✅ Reading works by word shape, and every uppercase word is the same rectangle, so the reader is forced letter by letter.
The one legitimate use is a **short label** distinguishing itself from nearby text — a category or section marker. Then: small size, bold weight, and increased letter spacing (`--tracking-caps`). 14px bold with generous tracking reads as a label; 18px regular with none reads as shouting.

### I-86 Full stops on fragments
❌ "Property features." · "Free secure parking."
✅ Most interface text is too short to need them. Use a full stop only where the text is a complete sentence containing commas.
Whichever you choose, be consistent across sibling elements — a list where three items end in a stop and two do not looks like a mistake, because it is one.

### I-118 Em dashes in interface text
❌ "Your plan — including every seat — renews monthly", "Free — forever", "Deleted — this cannot be undone"
✅ A full stop, a comma, a colon or a new element. "Your plan renews monthly, including every seat." "Free forever." "Deleted. This cannot be undone."
Interface text is read in fragments, at a glance, in a space someone else's content has to fit too. An em dash is a pause the reader has to interpret: it stands in for a comma, a colon, a bracket or a full stop, and which one it is only becomes clear after reading past it. The punctuation that says exactly one thing is faster.
It is also the clearest tell of machine-written copy. Generated text reaches for the em dash far more often than a person does, and readers have learned to notice. Copy that reads as generated is copy the reader trusts less, whatever it says.
This is about interface strings: labels, buttons, headings, errors, empty states, help text, and the prose a page ships. Markdown counts where a framework renders it as a page, which is most of them (`src/content`, `content/`, MDX routes). A repository document does not: `README.md`, `CHANGELOG.md`, `AGENTS.md` and their kin are written for whoever works on the code, and so are your commit messages and this file.
A verbatim quotation keeps its own punctuation. Text a page quotes from another source (a document, a spec, a person), marked as a quotation with `<blockquote>` or `<q>`, is that source's words, and so is a program's own output or code shown as it is, in `<pre>`, `<code>`, `<samp>` or `<kbd>`. Changing either to satisfy this rule would misquote it. The page's own copy around the quotation, and any heading or label it gives it, is still held to the rule.
The en dash keeps its one job: ranges, where it is read as "to" (`2–10 seats`, `Mon–Fri`). That is not a pause, and it is not affected.

### I-87 Inconsistent vocabulary
❌ "Add to cart" beside a "Bag" icon; "Sign up" on the page and "Register" in the nav
✅ One word per concept, everywhere. Keep a term list in the project and follow it.
The usual offenders: cart / bag · sign up / register · log in / sign in · delete / remove · publish / post · subscribe / join · edit / update.
Users assume different words mean different things, because in a well-built interface they do.

---

## Labels and links

### I-88 "My" or "your" on form labels
❌ "My email", "Your email"
✅ "Email". Think of the interface as speaking to the user: a field labelled "My email" refers to the *interface's* email. "Your" is at least accurate but usually unnecessary. Mixing both in one product is the worst case.

### I-89 Generic link text
❌ "Learn more", "Read more", "Click here" — especially three "Learn more" links in a row
✅ Name the destination: "Explore templates", "How affiliates work", "Email marketing features".
Screen reader users pull up a list of every link on a page; a list of "learn more" is useless. Sighted users scanning have to read the surrounding text to work out where each one goes. Three identical links also imply one destination.
"Click here" is worse still: it explains a mechanism people already understand, and it is wrong for anyone on touch, keyboard or voice.
Often the cleanest fix is to drop the link and make the **heading** the link.
**Buttons too.** "Get started", "Learn more", "Try it free" on every call to action say that something happens, not what. Name the outcome: "Create a workspace", "Search your first log file", "Book a 20-minute demo". A button whose label would fit any product is a button the reader has to decode.

### I-57 Actions and text centred by default
❌ Centred buttons and centred body text as a general habit
✅ Start-align text and actions. A consistent left edge scans faster, and a start-aligned action stays inside the viewport of someone using a screen magnifier.

### I-56 Brand colour spent on decoration
❌ Brand colour on headings and dividers while links and buttons are neutral
✅ Reserve `--color-brand` for interactive elements. The implication runs **one way**: brand colour means interactive; interactive need not mean brand colour (`C-49`, `C-50`).

---

## Errors

### I-90 Error messages that report without helping
❌ "Oops, something went wrong! Your payment wasn't successful as an error occurred" → **OK**
✅ "Payment failed. Update your payment details and try again" → **Update payment details**

An error message has three jobs: say **what happened**, say **why** where it helps, and give the **way forward**. Then:

- **Never blame the user.** Not "you entered an invalid card number" but "that card number doesn't look right".
- **Cut the apology.** "Please", "sorry", "oops", "unfortunately" add length and delay the useful part. A cheerful "Oops!" above a failed payment is worse than nothing.
- **No system voice.** No codes, stack traces or internal terminology in front of a user.
- **Make the heading and the button descriptive enough to work alone.** Someone who reads only "Payment failed" and the button label can recover without the paragraph.

See `P-01` for *where* the message goes and `F-37` for field-level validation text.

---

## Prose

**Scope:** prose longer than a paragraph that a page ships: docs, guides,
marketing pages, and everything under *Long-form* below. Interface strings stay
under the rules above; `I-79`'s 20-word sentence limit is for them, not for
prose. A page with no prose longer than a paragraph judges these `n/a`.

These rules judge whether prose is specific, sourced and authored. They never
judge who wrote it: a finding says the copy reads as generic, never that a
model wrote it.

### I-148 A claim with no source
❌ "Teams using Acme ship 37% faster." "A 2024 Stanford study found…" A feature described that the product does not have.
✅ Every figure, study, quotation, date and feature a page states traces to something in the project: its data, its docs, a link to the source, the product itself. Otherwise it is cut, or written as what it is: "in our own use", "we expect".
A made-up figure reads exactly like a real one, and it is the claim a reader is most likely to repeat. Of everything here, it costs the most when it is wrong.

### I-149 Specific in sound, empty in fact
❌ "Organisations that adopt these practices often see significant gains in efficiency."
✅ Name who, how many, how much, compared with what. "The billing team closed the month in two days instead of five."
The test, as `I-81` has it for headlines: if the sentence would still be true after swapping in any other product, team or year, it says nothing.

### I-150 Formula openers, closers and signposts
❌ "In today's rapidly changing world…" "It is important to note that…" "Let's dive in." "Here's the thing:" "In conclusion…" "Only time will tell."
✅ Start with the point; end when it has been made. Signpost only where a reader would otherwise be lost.
`check` warns on a short, fixed list of phrases that are almost never needed; the judgment half covers the same habit in other words. A quotation keeps its own words, as with `I-118`.

### I-151 Saying it twice
❌ A conclusion that restates the introduction. A lead sentence repeated as the next section's opening. The same point made again in new words two paragraphs later.
✅ Each paragraph adds something. Where a reader needs a reminder, point back to where it was said.

### I-152 A rhetorical shape on repeat
❌ "It's not X, it's Y" in every section; three adjectives, three verbs, three clauses, sentence after sentence; every paragraph built claim, example, takeaway.
✅ Any one of these is fine. The finding is density: the same shape often enough that a reader starts to hear it.

### I-153 Enthusiasm the content has not earned
❌ "An incredibly exciting, truly transformative opportunity." "The possibilities are endless."
✅ Let the thing described make the case. If it is impressive, the specifics show it; if they do not, the adjectives will not.

### I-154 Stacked hedges
❌ "It may potentially suggest that this could, in some cases, help."
✅ One qualifier, where the uncertainty is real: "The evidence suggests…"
Exception: legal, medical and scientific text, and any claim that is genuinely uncertain, may need more.

### I-155 Emoji in headings
❌ "🚀 Getting started", "✨ Key features"
✅ The words carry the heading. An emoji is read aloud by a screen reader as its name, and at the head of every section it reads as a template.
In markup, `A-05` already reports every emoji, a heading's included; `check` reports this rule for a Markdown page's headings, which `A-05` does not read.

### I-156 Structure imposed rather than earned
❌ Overview, Key benefits, Challenges, Best practices, Conclusion, whatever the subject. A heading every two paragraphs. Every bullet opening with a bold phrase. A numbered list for things with no order.
✅ Let the content decide the structure: a heading where a reader would look for one, a numbered list for a sequence, bold only where a reader scanning must stop.

---

## Long-form

**Scope:** authored writing a person puts their name to: blog posts, essays,
case studies, release notes written as a story. Everything under *Prose* applies
as well. Judged by a reader, never measured: rhythm and voice have no number a
check could hold, and a score would reward prose that games it.

### I-157 Nothing only the author could say
❌ "The migration was challenging, but the team learned valuable lessons."
✅ "The migration looked like a weekend's work. It took three weeks, because two services wrote the same table and nobody had written that down."
A post worth reading holds something the reader could not have written themselves: a case, a number, a mistake, a decision and its reason.

### I-158 No point of view
❌ "There are several factors to consider, each with its own trade-offs."
✅ Say which factor mattered, and why: "The technology was not the hard part. Changing how procurement worked was."
Balance is fine when the question is open. A post that never commits to anything has not said what its author thinks.

### I-159 An even rhythm
❌ Sentence after sentence of the same length and build; paragraphs of identical size down the page.
✅ Short sentences where something lands, longer ones where an idea needs room. Read it aloud: an even rhythm is audible long before it is visible.
Not a length rule, and not a count: `I-79`'s limit is for interface strings.

### I-160 Feeling named, not shown
❌ "I was fascinated by the results, which provided valuable insights."
✅ "I did not expect the result. We had tested it three times, and it failed in exactly the same place."
Where a post reports a reaction, the specifics carry it; a named emotion with nothing behind it reads as flat.

---

## L-06 · Copy checklist

1. Sentence case throughout? (`I-53`)
2. Any word removable without loss? (`I-79`)
3. Key information first in every heading, link and button? (`I-54`)
4. Every heading meaningful read on its own? (`I-81`)
5. Every link naming its destination? (`I-89`)
6. Numerals as figures, formatted consistently? (`I-83`)
7. One word per concept across the whole product? (`I-87`)
8. Every error saying what happened and what to do next? (`I-90`)
9. Every figure, study, quotation and feature traceable to a source? (`I-148`)
10. Prose saying something specific, once, without formula? (`I-149`, `I-150`, `I-151`)
11. For long-form: something only the author could say, and a view? (`I-157`, `I-158`)

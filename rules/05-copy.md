# 05 · Copy

**Status:** draft v0.1
**Scope:** universal. Interface text in every mode.
**Load when:** writing or reviewing any user-facing string — labels, buttons, headings, errors, empty states, help text.

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

## Checklist

1. Sentence case throughout? (`I-53`)
2. Any word removable without loss? (`I-79`)
3. Key information first in every heading, link and button? (`I-54`)
4. Every heading meaningful read on its own? (`I-81`)
5. Every link naming its destination? (`I-89`)
6. Numerals as figures, formatted consistently? (`I-83`)
7. One word per concept across the whole product? (`I-87`)
8. Every error saying what happened and what to do next? (`I-90`)

---

## Notes for the author (not for the agent)

**Where your taste is recorded here:** the ban on apology words in errors, and `I-90`'s requirement that the heading and button work without the body text. Both come from the same instinct as the rest of the system — the person reading is trying to get something done, and the interface should not make them wade.

`I-87` is the rule most likely to need a project-specific companion. A term list belongs in the brand file's voice section, not here; this rule only says that one must exist and be followed.

Deliberately absent: tone-of-voice guidance beyond plain language. Tone is a brand decision and varies per client, so it belongs in `03-brand.md` when that file exists.

# The input field's value is the source of truth; session state is re-derived each keystroke

The typing-session reducer (`applyKeystroke` in `app/utils/typingSession.ts`) treats
the hidden input field's full string value as authoritative and **re-derives** the
whole per-word state from it on every change — it never diffs "which one character
was added or removed". On each keystroke it strips spaces (a space is an advance
signal, never stored as content), validates the entire typed string against the
current word, derives `isWordErrored` from whether the typed string is a correct
leading prefix, and stores wrong and over-typed characters verbatim (capped a few
past the word's end) rather than swallowing them. A word advances only on an exact,
error-free match **and** only once its per-word clock has started.

We chose this because the previous reducer assumed exactly one character changed per
event (`newValue[newValue.length - 1]` vs `currentWord[currentInput.length]`). That
assumption breaks for every multi-character input — paste, IME composition, mobile
autocorrect, select-and-replace, and the multi-character chords a CharaChorder emits —
and it spawned a class of off-by-one bugs: space completing an errored word, mid-word
typos being silently swallowed so Backspace ate a correct letter, and an atomic
"word + space" paste completing in zero elapsed time (an infinite WPM that poisoned
the graduation stats).

## Consequences

State is a pure function of the input string, so the controlled input can never
diverge from session state and the reducer is robust to any delta, not just
single keystrokes. `isWordErrored`/`hasError` are **derived, not latched**:
backspacing a typo back to a correct prefix un-reds the word, so a mistake costs you
exactly the characters you typed wrong, never your correct prefix. Because every
keystroke returns a fresh state object, React always re-renders and restores the
controlled input — there is no same-reference no-op path to reason about. The
"never stuck" guarantee from issue #27 falls out for free: wrong characters are
always stored, so a real Backspace event always fires.

The clock-started precondition on completion means an atomic "word + space" paste
can't post a zero-elapsed result; instead it lands the word, starts the clock, and
the next space completes it with a real time. The per-word clock still survives
backspaces (fumbling counts as genuine difficulty — see
`computeWordTimingFromEvents`).

## Considered and rejected

**Keep diffing single keystrokes and patch each bug locally.** This is what produced
the off-by-ones in the first place — the issue #27 fix (store the wrong *first* char)
and the error *latch* (block input until the field is empty) were local patches with
no shared contract, and they disagreed with each other (first-char typos were stored,
mid-word typos were swallowed). Rejected: re-deriving from the whole string makes the
inconsistency unrepresentable.

**Advance on space even when the word is incomplete or errored** (MonkeyType's
default: space means "next word", and missed spaces cascade errors until you backspace
to the gap). Rejected for this app: Bottom10 is a slow-word *accuracy* trainer, so a
word with mistakes must not be completable — you correct it in place. The stricter
"advance only on an exact, error-free match" rule is intentional, not a missing
feature.

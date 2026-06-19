# Bottom10

A typing trainer that concentrates practice on a user's slowest words. Each test
draws from a working set of the worst-performing words and repeats them; words
"graduate" out once typed consistently fast enough.

## Language

**Score**:
A word's stored typing speed, in milliseconds-per-character, averaged across all
attempts. Lower is faster. This is a durable, persisted property of a word.
_Avoid_: time (the raw average ms is a separate stored field), WPM (Score is the
inverse, per-character unit).

**Per-word WPM**:
The instantaneous words-per-minute of a *single* word completion, derived from
that one attempt's elapsed time. Distinct from **Score**, which is averaged over
many attempts. Normalized to a 5-character standard word so it is comparable to
the **WPM target**.
_Avoid_: speed, score (Score is the averaged, stored value — not this).

**WPM target**:
The user-set words-per-minute goal. Drives the **graduation threshold**: a per-
character time below which a completion counts toward graduation.

**Graduation**:
A word's exit from the practice pool, earned after its **Score** stays under the
**graduation threshold** for a number of consecutive tests.

**Working set**:
The handful of non-graduated words that populate the current test and are
repeated across it, rather than drawing many unique words. Membership is by test
population — the worst (highest-Score) non-graduated words, topped up with
**untouched** words when fewer than ten have a Score — *not* by Score itself.
_Alias_: "the current ten" (its size is fixed at ten).

**Untouched**:
A word that has never been typed, so it has no **Score**. Most of the word list
is untouched until practiced. An untouched word counts as part of the **working
set** only while it is padding a sparse early test; otherwise it sits outside
both the working set and the graduated set.

**WPM particle**:
A Borderlands-style number that pops off a word the moment it is completed,
arcs up and falls, then fades. It shows that completion's **Per-word WPM** and
is colored green when the completion met or beat the **graduation threshold**
(graduation pace) and red when it fell short.
_Avoid_: damage number, popup, floating text.

**Graduation flight**:
The visible celebration of a **Graduation**: at the end of a test, each word
that graduated this round arcs out of the **working set** ("the current ten")
and lands in the graduated list, which reacts as it arrives. It is the moment
that makes *which* words graduated unmistakable. Distinct from the **WPM
particle**, which marks a single completion's pace and dies in place; the
graduation flight marks a word's permanent exit from the practice pool and
travels to its new home. Plays without interrupting the next test.
_Avoid_: confetti, celebration, transition.

**Tension shake**:
An escalating per-letter tremor across the words of a test, ramping linearly
from perfectly still at the start to its peak on the final word. It is a felt
signal that the *end of the test* is approaching — proximity, not performance.
Each letter jitters independently; the whole field shares one intensity set by
how far through the test the typist is.
_Avoid_: screen shake (the brief whole-field jolt of a **Detonation**),
nervousness, vibration.

**Finish prompt**:
The steady, breathing cue that appears once the final word of a test is typed
correctly, signaling that pressing space completes the test. It holds still
while the words rattle at peak **Tension shake** — the one calm thing on screen
— so the eye is drawn to the single remaining action. Without it, a typist who
has correctly typed the last word has no way to know the test is waiting on a
space.
_Avoid_: "press any key", continue button, pause.

**Detonation**:
The per-letter explosion of a finished test's words, flung off the page the
instant space completes the test. It reuses the Borderlands particle motion of
the **WPM particle**, amplified to clear the screen, and plays as non-blocking
flair *over* the next test, which fades in behind it. Distinct from the **WPM
particle**, which marks one completion's pace and dies in place, and from the
**Graduation flight**, which carries a graduated word to its permanent home; the
Detonation simply clears the spent test to punctuate its end.
_Avoid_: confetti, transition, screen wipe.

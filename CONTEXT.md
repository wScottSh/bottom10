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

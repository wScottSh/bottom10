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
The handful of worst (highest-Score) non-graduated words that a test repeats,
rather than drawing many unique words.

**WPM particle**:
A Borderlands-style number that pops off a word the moment it is completed,
arcs up and falls, then fades. It shows that completion's **Per-word WPM** and
is colored green when the completion met or beat the **graduation threshold**
(graduation pace) and red when it fell short.
_Avoid_: damage number, popup, floating text.

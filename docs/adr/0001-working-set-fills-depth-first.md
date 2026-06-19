# Working set fills depth-first; untouched words are last-resort padding

The working set (the ten words a test drills) is built worst-Score-first, and
untouched words — Score 0 — sort *last*, so they enter only as padding when
fewer than ten scored, non-graduated words exist. We chose this so a user
masters their current worst ten until each graduates before any new word cycles
in, rather than churning in fresh words every test.

## Consequences

The count of scored, non-graduated words is capped at ten: no new word gets a
Score until a graduation frees a slot. A word's lifecycle is therefore strictly
monotonic — Untouched → Working set → Graduated — and a word never leaves the
working set except by graduating (its Score and graduation streak can regress,
but it stays in the set). This is what makes "the untouched / the current ten /
the graduated" a clean three-way partition with no leftover fourth group.

## Considered and rejected

Breadth-first: sort untouched words *first* (or interleave them) to keep tests
varied. Rejected — the working set would churn every test, no stable "bottom
ten" would exist, and words could leave the set without graduating, defeating
the focused-repetition premise of the app.

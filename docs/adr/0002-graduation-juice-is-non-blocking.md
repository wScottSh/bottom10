# Graduation juice is non-blocking; there is no end-of-round pause

When a word graduates, the celebration (the **Graduation flight**) plays as a
non-blocking overlay while the next test starts immediately. There is no
results screen, held beat, or pause between tests — graduation is acknowledged
*over* the live restart, never by interrupting it. The user can keep typing
through the entire effect without losing a keystroke.

We chose this because the core premise of the app is relentless,
repetition-driven drilling of a user's worst words. A pause at round-end —
however celebratory — would interrupt the flow precisely at the moment we are
rewarding, punishing the behavior we want to reinforce. A fast typist graduating
words every few rounds would be interrupted constantly.

## Consequences

The celebration must be built as an overlay that animates independently of the
typing surface, not as a state the orchestration blocks on. Because the next
test repaints the typing area synchronously at round-end, the flight cannot
anchor to the just-finished word's on-screen position; it instead originates
from the word's always-present "current ten" row in the sidebar (see
**Graduation flight** in CONTEXT.md). When the sidebar is collapsed there is no
source or destination, so graduation plays silently — hiding the lifecycle UI
opts out of its juice.

## Considered and rejected

A held end-of-round beat: pause ~1–1.5s on a celebratory state before loading
the next test. Rejected — it interrupts flow at the reward moment, and the
interruption compounds for the fast, frequently-graduating users who have
earned it most. The relentless-flow premise outweighs the extra drama a pause
would buy.

A full results screen between tests. Rejected for the same reason, more
strongly — it converts a continuous trainer into a turn-based one.

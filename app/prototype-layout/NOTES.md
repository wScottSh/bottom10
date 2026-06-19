# PROTOTYPE — main layout (issue #18)

**Question:** How should the main screen frame the three zones — Untouched
(count + peek, never a full scroll), Current ten / Working set (worst-first, with
score + graduation progress), and Graduated — around the center typing area?

Three frames, switchable at `/prototype-layout?variant=A|B|C` (floating bottom bar
or ← / → keys). Mock data only; static typing area.

- **A — Dual rail (fixed):** keeps today's two-sidebar shape but fixes it. Left =
  Current ten worst-first with per-word progress bars + streak pips; untouched
  collapses to a count chip at the bottom. Right = Graduated. Lowest-risk change.
- **B — Pipeline rail:** one left rail renders the whole lifecycle top→bottom as a
  literal flow: Untouched (source) → Current ten (active, expanded) → Graduated
  (sink). Typing gets a wider center. Makes the monotonic Untouched→Working→Graduated
  journey (see ADR 0001) visible.
- **C — Top HUD / focus mode:** typing is full-width and dominant; the three zones
  are a compact game-style progress bar across the top (untouched count → ten chips
  with streak dots → graduated count) plus a recent-grads footer.

**Verdict:** **B — Pipeline rail** (chosen 2026-06-19). The one-rail lifecycle
flow Untouched → Current ten → Graduated is the frame to fold into TypingTest.

When a frame wins: fold it into `app/components/TypingTest.tsx` + sidebars, then
delete this whole `app/prototype-layout/` folder.

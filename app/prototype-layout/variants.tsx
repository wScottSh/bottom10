// PROTOTYPE — throwaway. Three radically different frames for the main layout (issue #18).
// Each frame is free to throw out the layout entirely; they only share the TypingArea
// content stand-in and the mock data. Delete this whole folder once a frame wins.
'use client';

import TypingArea from './TypingArea';
import {
  WPM_TARGET,
  workingSet,
  untouchedCount,
  untouchedNext,
  graduatedCount,
  graduatedRecent,
} from './mockData';

const PANEL = 'bg-[#2c2c2c]';
const ACCENT = '#e2b714';

// ── shared atoms ───────────────────────────────────────────────────────────
function StreakPips({ streak }: { streak: 0 | 1 }) {
  // graduation needs 2 consecutive clean tests; show 2 pips
  return (
    <span className="inline-flex gap-[3px] items-center" title={`${streak}/2 toward graduation`}>
      {[0, 1].map((i) => (
        <span
          key={i}
          className={`h-[6px] w-[6px] rounded-full ${i < streak ? 'bg-cyan-400' : 'bg-[#555]'}`}
        />
      ))}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VARIANT A — "Dual rail, fixed" — minimal change: keep two sidebars but fix
// them. Left = working set, worst-first, with graduation progress. Untouched
// collapses to a chip at the bottom of the left rail. Right = graduated.
// ════════════════════════════════════════════════════════════════════════════
export function VariantA() {
  return (
    <div className="min-h-screen bg-[#232323] text-[#e2e2e2] flex">
      {/* left rail: working set + untouched chip */}
      <aside className={`${PANEL} w-72 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-black/30">
          <h2 className="text-lg">Current ten</h2>
          <span className="text-sm" style={{ color: ACCENT }}>{WPM_TARGET} wpm</span>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {workingSet.map((r, i) => (
            <li key={r.word} className="px-2 py-2 rounded hover:bg-white/5">
              <div className="flex items-baseline justify-between">
                <span className="flex items-baseline gap-2">
                  <span className="text-xs text-[#666] w-4 tabular-nums">{i + 1}</span>
                  <span className={r.streak ? 'text-cyan-400' : ''}>{r.word}</span>
                </span>
                <span className="text-sm" style={{ color: r.streak ? '#22d3ee' : ACCENT }}>
                  {r.wpm}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 pl-6">
                {/* progress bar: distance to target wpm */}
                <div className="h-[3px] flex-1 mr-3 bg-[#444] rounded">
                  <div
                    className="h-full rounded"
                    style={{ width: `${Math.min(100, (r.wpm / WPM_TARGET) * 100)}%`, background: ACCENT }}
                  />
                </div>
                <StreakPips streak={r.streak} />
              </div>
            </li>
          ))}
        </ul>
        <div className="p-3 border-t border-black/30 text-sm text-[#888]">
          <div className="flex justify-between">
            <span>Untouched</span>
            <span className="tabular-nums">{untouchedCount}</span>
          </div>
          <div className="text-xs text-[#666] truncate mt-1">next: {untouchedNext.slice(0, 3).join(', ')}…</div>
        </div>
      </aside>

      {/* center typing */}
      <main className="flex-1 flex items-center justify-center px-12">
        <div className="w-full max-w-3xl">
          <TypingArea />
        </div>
      </main>

      {/* right rail: graduated */}
      <aside className={`${PANEL} w-64 flex flex-col`}>
        <div className="p-4 border-b border-black/30 flex items-baseline justify-between">
          <h2 className="text-lg text-green-500">Graduated</h2>
          <span className="text-sm text-green-600 tabular-nums">{graduatedCount}</span>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {graduatedRecent.map((r) => (
            <li key={r.word} className="flex justify-between text-sm px-2 py-1 text-green-500">
              <span>{r.word}</span>
              <span className="tabular-nums">{r.wpm}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VARIANT B — "Pipeline rail" — one left rail renders the whole lifecycle as a
// vertical flow: Untouched (source, top) → Current ten (active, middle) →
// Graduated (sink, bottom). The journey is literal and downward. No right rail;
// typing gets more room.
// ════════════════════════════════════════════════════════════════════════════
export function VariantB() {
  return (
    <div className="min-h-screen bg-[#232323] text-[#e2e2e2] flex">
      <aside className={`${PANEL} w-80 flex flex-col`}>
        {/* SOURCE: untouched */}
        <div className="p-4 border-b border-black/30">
          <div className="flex items-baseline justify-between text-[#888]">
            <span className="uppercase text-xs tracking-widest">Untouched</span>
            <span className="text-2xl tabular-nums text-[#aaa]">{untouchedCount}</span>
          </div>
          <div className="text-xs text-[#666] mt-1">next in: {untouchedNext.slice(0, 3).join(' · ')}</div>
        </div>
        <div className="text-center text-[#555] text-xs py-1">↓ enters when a slot frees ↓</div>

        {/* ACTIVE: current ten */}
        <div className="flex-1 overflow-y-auto px-2 py-2 bg-black/10">
          <div className="px-2 pb-2 text-xs uppercase tracking-widest" style={{ color: ACCENT }}>
            Current ten · worst first
          </div>
          {workingSet.map((r, i) => (
            <div
              key={r.word}
              className="px-2 py-2 rounded mb-1 bg-[#2c2c2c] border-l-2"
              style={{ borderColor: r.streak ? '#22d3ee' : ACCENT }}
            >
              <div className="flex items-baseline justify-between">
                <span className={r.streak ? 'text-cyan-400' : ''}>{r.word}</span>
                <span className="text-sm tabular-nums" style={{ color: r.streak ? '#22d3ee' : ACCENT }}>{r.wpm} wpm</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-[3px] flex-1 bg-[#444] rounded">
                  <div className="h-full rounded" style={{ width: `${Math.min(100,(r.wpm/WPM_TARGET)*100)}%`, background: r.streak ? '#22d3ee' : ACCENT }} />
                </div>
                <StreakPips streak={r.streak} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-green-700 text-xs py-1">↓ graduates at target pace ↓</div>

        {/* SINK: graduated */}
        <div className="p-4 border-t border-black/30">
          <div className="flex items-baseline justify-between text-green-500">
            <span className="uppercase text-xs tracking-widest">Graduated</span>
            <span className="text-2xl tabular-nums">{graduatedCount}</span>
          </div>
          <div className="text-xs text-green-700 mt-1 truncate">
            latest: {graduatedRecent.slice(0, 4).map((g) => g.word).join(' · ')}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center px-16">
        <div className="w-full max-w-4xl">
          <TypingArea />
        </div>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VARIANT C — "Top HUD / focus mode" — typing is full-width and dominant. The
// three zones are a compact horizontal progress bar across the top, game-style:
// untouched count → ten chips with streak dots → graduated count. Detail lives
// in a peek strip, not rails.
// ════════════════════════════════════════════════════════════════════════════
export function VariantC() {
  return (
    <div className="min-h-screen bg-[#232323] text-[#e2e2e2] flex flex-col">
      {/* top HUD */}
      <header className="px-6 py-4 flex items-stretch gap-4 border-b border-black/40">
        {/* untouched source */}
        <div className="flex flex-col justify-center items-center px-4 rounded bg-[#2c2c2c] min-w-[88px]">
          <span className="text-2xl tabular-nums text-[#aaa]">{untouchedCount}</span>
          <span className="text-[10px] uppercase tracking-widest text-[#777]">untouched</span>
        </div>

        <div className="self-center text-[#555]">→</div>

        {/* the ten as chips */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {workingSet.map((r) => (
            <div
              key={r.word}
              className="flex flex-col items-center px-3 py-1.5 rounded bg-[#2c2c2c] shrink-0"
              style={{ outline: r.streak ? '1px solid #22d3ee' : 'none' }}
            >
              <span className={`text-sm ${r.streak ? 'text-cyan-400' : ''}`}>{r.word}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] tabular-nums" style={{ color: r.streak ? '#22d3ee' : ACCENT }}>{r.wpm}</span>
                <StreakPips streak={r.streak} />
              </div>
            </div>
          ))}
        </div>

        <div className="self-center text-[#555]">→</div>

        {/* graduated sink */}
        <div className="flex flex-col justify-center items-center px-4 rounded bg-[#2c2c2c] min-w-[88px]">
          <span className="text-2xl tabular-nums text-green-500">{graduatedCount}</span>
          <span className="text-[10px] uppercase tracking-widest text-green-700">graduated</span>
        </div>
      </header>

      {/* full-width typing */}
      <main className="flex-1 flex items-center justify-center px-24">
        <div className="w-full max-w-5xl">
          <div className="mb-3 text-xs uppercase tracking-widest text-[#666]" style={{ color: ACCENT }}>
            target {WPM_TARGET} wpm
          </div>
          <TypingArea />
        </div>
      </main>

      {/* graduated peek footer */}
      <footer className="px-6 py-2 border-t border-black/40 text-xs text-green-700 flex gap-4 overflow-x-auto">
        <span className="uppercase tracking-widest shrink-0">recent grads</span>
        {graduatedRecent.map((g) => (
          <span key={g.word} className="shrink-0 text-green-600">{g.word} <span className="tabular-nums">{g.wpm}</span></span>
        ))}
      </footer>
    </div>
  );
}

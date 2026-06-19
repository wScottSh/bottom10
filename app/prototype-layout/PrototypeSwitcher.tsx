// PROTOTYPE — throwaway. Floating variant switcher. Hidden in production builds.
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const VARIANTS: Record<string, string> = {
  A: 'Dual rail (fixed)',
  B: 'Pipeline rail',
  C: 'Top HUD / focus',
};
const KEYS = Object.keys(VARIANTS);

export default function PrototypeSwitcher() {
  const router = useRouter();
  const params = useSearchParams();
  const current = (params.get('variant') ?? 'A').toUpperCase();
  const idx = Math.max(0, KEYS.indexOf(current));

  const go = (next: number) => {
    const key = KEYS[(next + KEYS.length) % KEYS.length];
    router.replace(`/prototype-layout?variant=${key}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === 'ArrowRight') go(idx + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx]);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-white text-black px-3 py-2 shadow-2xl shadow-black/50 text-sm font-medium">
      <button onClick={() => go(idx - 1)} className="px-2 hover:opacity-60" aria-label="previous variant">←</button>
      <span className="tabular-nums min-w-[180px] text-center">
        {KEYS[idx]} — {VARIANTS[KEYS[idx]]}
      </span>
      <button onClick={() => go(idx + 1)} className="px-2 hover:opacity-60" aria-label="next variant">→</button>
    </div>
  );
}

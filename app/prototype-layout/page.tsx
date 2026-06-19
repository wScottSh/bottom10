// PROTOTYPE — throwaway route for issue #18 (main layout).
// Three frames of the three-zone shell (Untouched / Current ten / Graduated)
// switchable via ?variant=A|B|C and the floating bottom bar. Mock data only — no
// persistence, no live typing. Delete this whole folder once a frame wins and the
// decision is folded into the real TypingTest layout.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VariantA, VariantB, VariantC } from './variants';
import PrototypeSwitcher from './PrototypeSwitcher';

function Frame() {
  const variant = (useSearchParams().get('variant') ?? 'A').toUpperCase();
  return (
    <>
      {variant === 'B' ? <VariantB /> : variant === 'C' ? <VariantC /> : <VariantA />}
      <PrototypeSwitcher />
    </>
  );
}

export default function PrototypeLayoutPage() {
  return (
    <Suspense fallback={null}>
      <Frame />
    </Suspense>
  );
}

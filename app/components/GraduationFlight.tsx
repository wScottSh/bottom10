'use client';

import { useState, useRef, useEffect } from 'react';

interface Pulse {
  id: number;
  word: string;
}

interface GraduationFlightProps {
  newlyGraduated: string[];
}

export default function GraduationFlight({ newlyGraduated }: GraduationFlightProps) {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!newlyGraduated.length) return;
    setPulses(prev => [
      ...prev,
      ...newlyGraduated.map(word => ({ id: nextId.current++, word })),
    ]);
  }, [newlyGraduated]);

  return (
    <>
      {pulses.map(({ id, word }) => (
        <span
          key={id}
          data-testid="graduation-pulse"
          data-word={word}
          className="graduation-pulse"
          onAnimationEnd={() => setPulses(prev => prev.filter(p => p.id !== id))}
        />
      ))}
    </>
  );
}

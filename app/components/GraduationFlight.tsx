'use client';

import { useState, useRef, useEffect } from 'react';

export interface FlightSource {
  word: string;
  srcTop: number;
  srcLeft: number;
  dstTop: number;
  dstLeft: number;
}

interface Pulse {
  id: number;
  word: string;
}

interface FlightClone extends FlightSource {
  id: number;
  delay: number;
}

interface GraduationFlightProps {
  newlyGraduated: string[];
  flightSources?: FlightSource[];
}

export default function GraduationFlight({ newlyGraduated, flightSources }: GraduationFlightProps) {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [clones, setClones] = useState<FlightClone[]>([]);
  const nextId = useRef(0);

  // Landing pulses: fire immediately (also serves as reduced-motion and collapsed-sidebar path)
  useEffect(() => {
    if (!newlyGraduated.length) return;
    setPulses(prev => [
      ...prev,
      ...newlyGraduated.map(word => ({ id: nextId.current++, word })),
    ]);
  }, [newlyGraduated]);

  // Flight clones: fire when Sidebar provides layout info (one render after graduation).
  // Skipped under prefers-reduced-motion — the landing pulse (above) remains the sole feedback.
  useEffect(() => {
    if (!flightSources || !flightSources.length) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setClones(prev => [
      ...prev,
      ...flightSources.map((src, i) => ({
        ...src,
        id: nextId.current++,
        delay: i * 100,
      })),
    ]);
  }, [flightSources]);

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
      {clones.map(({ id, word, srcTop, srcLeft, dstTop, dstLeft, delay }) => (
        <span
          key={id}
          data-testid="graduation-flight-clone"
          data-word={word}
          className="graduation-flight-clone"
          style={{
            left: dstLeft,
            top: dstTop,
            '--dx': `${srcLeft - dstLeft}px`,
            '--dy': `${srcTop - dstTop}px`,
            animationDelay: `${delay}ms`,
          } as React.CSSProperties}
          onAnimationEnd={() => setClones(prev => prev.filter(c => c.id !== id))}
        >
          {word}
        </span>
      ))}
    </>
  );
}

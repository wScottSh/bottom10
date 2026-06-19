'use client';

import { useState, useRef, useEffect } from 'react';

export interface FlightSource {
  word: string;
  srcTop: number;
  srcLeft: number;
  srcWidth: number;
  srcHeight: number;
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

interface DepartingSlot {
  id: number;
  word: string;
  top: number;
  left: number;
  width: number;
  height: number;
  delay: number;
}

interface GraduationFlightProps {
  newlyGraduated: string[];
  flightSources?: FlightSource[];
}

export default function GraduationFlight({ newlyGraduated, flightSources }: GraduationFlightProps) {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [clones, setClones] = useState<FlightClone[]>([]);
  const [departingSlots, setDepartingSlots] = useState<DepartingSlot[]>([]);
  const nextId = useRef(0);

  // Landing pulses: fire immediately (also serves as reduced-motion and collapsed-sidebar path)
  useEffect(() => {
    if (!newlyGraduated.length) return;
    setPulses(prev => [
      ...prev,
      ...newlyGraduated.map(word => ({ id: nextId.current++, word })),
    ]);
  }, [newlyGraduated]);

  // Flight clones + departing slot overlays: fire when Sidebar provides layout info.
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
    setDepartingSlots(prev => [
      ...prev,
      ...flightSources.map((src, i) => ({
        id: nextId.current++,
        word: src.word,
        top: src.srcTop,
        left: src.srcLeft,
        width: src.srcWidth,
        height: src.srcHeight,
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
      {departingSlots.map(({ id, word, top, left, width, height, delay }) => (
        <span
          key={id}
          data-testid="graduation-departing-slot"
          data-word={word}
          className="graduation-departing-slot"
          style={{
            top,
            left,
            width,
            height,
            animationDelay: `${delay}ms`,
          } as React.CSSProperties}
          onAnimationEnd={() => setDepartingSlots(prev => prev.filter(s => s.id !== id))}
        />
      ))}
    </>
  );
}

'use client';

import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { DETONATION } from '../utils/juiceConfig';

export interface DetonationLetter {
  char: string;
  x: number;
  y: number;
}

interface DetonationParticle {
  id: number;
  char: string;
  x: number;
  y: number;
  dx: string;
  dy: string;
  spin: string;
}

export interface DetonationHandle {
  detonate: (letters: DetonationLetter[]) => void;
}

// Random value in [-range, +range].
const jitter = (range: number) => (Math.random() - 0.5) * 2 * range;

const DetonationParticles = forwardRef<DetonationHandle>(function DetonationParticles(_, ref) {
  const [particles, setParticles] = useState<DetonationParticle[]>([]);
  const nextId = useRef(0);

  useImperativeHandle(ref, () => ({
    detonate(letters) {
      if (!letters.length) return;
      const newParticles = letters.map(letter => {
        const id = nextId.current++;
        const angle = Math.random() * Math.PI * 2;
        const speed = DETONATION.velocityPx + jitter(DETONATION.velocitySpreadPx);
        const dx = Math.round(Math.cos(angle) * speed);
        const dy = Math.round(Math.sin(angle) * speed);
        const spin = Math.round(jitter(DETONATION.maxSpinDeg));
        return {
          id,
          char: letter.char,
          x: letter.x,
          y: letter.y,
          dx: `${dx}px`,
          dy: `${dy}px`,
          spin: `${spin}deg`,
        };
      });
      setParticles(prev => [...prev, ...newParticles]);
    },
  }));

  const removeParticle = (id: number) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  };

  return (
    <>
      {particles.map(p => (
        <span
          key={p.id}
          className="detonation-letter"
          style={{
            left: p.x,
            top: p.y,
            '--det-dx': p.dx,
            '--det-dy': p.dy,
            '--det-spin': p.spin,
            '--det-duration': `${DETONATION.durationMs}ms`,
          } as React.CSSProperties}
          onAnimationEnd={() => removeParticle(p.id)}
        >
          {p.char}
        </span>
      ))}
    </>
  );
});

export default DetonationParticles;

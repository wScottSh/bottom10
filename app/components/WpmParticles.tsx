'use client';

import { useState, useRef, useImperativeHandle, forwardRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  wpm: number;
  isFast: boolean;
}

export interface WpmParticlesHandle {
  spawn: (x: number, y: number, wpm: number, isFast: boolean) => void;
}

const WpmParticles = forwardRef<WpmParticlesHandle>(function WpmParticles(_, ref) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);

  useImperativeHandle(ref, () => ({
    spawn(x, y, wpm, isFast) {
      const id = nextId.current++;
      setParticles(prev => [...prev, { id, x, y, wpm, isFast }]);
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
          className="wpm-particle"
          style={{
            left: p.x,
            top: p.y,
            color: p.isFast ? 'var(--success)' : 'var(--error)',
          }}
          onAnimationEnd={() => removeParticle(p.id)}
        >
          {p.wpm}
        </span>
      ))}
    </>
  );
});

export default WpmParticles;

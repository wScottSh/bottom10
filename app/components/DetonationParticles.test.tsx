// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import DetonationParticles, { DetonationHandle, DetonationLetter } from './DetonationParticles';

// jsdom does not implement AnimationEvent, so the browser-native animationend
// event cannot be fired. Call the React-registered onAnimationEnd prop directly
// instead — this is the standard workaround for testing animation cleanup in jsdom.
function fireAnimationEnd(element: Element) {
  const propsKey = Object.keys(element).find(k => k.startsWith('__reactProps'));
  if (!propsKey) throw new Error('No __reactProps on element');
  const props = (element as any)[propsKey];
  act(() => props.onAnimationEnd({ type: 'animationend' }));
}

describe('DetonationParticles', () => {
  it('renders one element per letter at its snapshot coordinates', () => {
    const ref = createRef<DetonationHandle>();
    const { container } = render(<DetonationParticles ref={ref} />);

    const letters: DetonationLetter[] = [
      { char: 'h', x: 100, y: 200 },
      { char: 'i', x: 110, y: 200 },
    ];

    act(() => { ref.current!.detonate(letters); });

    const elements = container.querySelectorAll('.detonation-letter');
    expect(elements).toHaveLength(2);

    const el0 = elements[0] as HTMLElement;
    expect(el0.textContent).toBe('h');
    expect(el0.style.left).toBe('100px');
    expect(el0.style.top).toBe('200px');

    const el1 = elements[1] as HTMLElement;
    expect(el1.textContent).toBe('i');
    expect(el1.style.left).toBe('110px');
    expect(el1.style.top).toBe('200px');
  });

  it('self-cleans each element on animationEnd', () => {
    const ref = createRef<DetonationHandle>();
    const { container } = render(<DetonationParticles ref={ref} />);

    act(() => { ref.current!.detonate([{ char: 'a', x: 50, y: 100 }]); });
    expect(container.querySelectorAll('.detonation-letter')).toHaveLength(1);

    fireAnimationEnd(container.querySelector('.detonation-letter')!);

    expect(container.querySelector('.detonation-letter')).toBeNull();
  });

  it('cleans up each element independently when multiple are spawned', () => {
    const ref = createRef<DetonationHandle>();
    const { container } = render(<DetonationParticles ref={ref} />);

    act(() => {
      ref.current!.detonate([
        { char: 'a', x: 10, y: 20 },
        { char: 'b', x: 20, y: 20 },
      ]);
    });
    expect(container.querySelectorAll('.detonation-letter')).toHaveLength(2);

    fireAnimationEnd(container.querySelectorAll('.detonation-letter')[0]);

    expect(container.querySelectorAll('.detonation-letter')).toHaveLength(1);
  });

  it('renders each letter as its snapshot character', () => {
    const ref = createRef<DetonationHandle>();
    const { container } = render(<DetonationParticles ref={ref} />);

    act(() => {
      ref.current!.detonate([
        { char: 't', x: 0, y: 0 },
        { char: 'y', x: 10, y: 0 },
        { char: 'p', x: 20, y: 0 },
      ]);
    });

    const elements = Array.from(container.querySelectorAll('.detonation-letter'));
    expect(elements.map(e => e.textContent)).toEqual(['t', 'y', 'p']);
  });
});

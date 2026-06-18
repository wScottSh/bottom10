// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import WpmParticles, { WpmParticlesHandle } from './WpmParticles';

// jsdom does not implement AnimationEvent, so the browser-native animationend
// event cannot be fired. Call the React-registered onAnimationEnd prop directly
// instead — this is the standard workaround for testing animation cleanup in jsdom.
function fireAnimationEnd(element: Element) {
  const propsKey = Object.keys(element).find(k => k.startsWith('__reactProps'));
  if (!propsKey) throw new Error('No __reactProps on element');
  const props = (element as any)[propsKey];
  act(() => props.onAnimationEnd({ type: 'animationend' }));
}

describe('WpmParticles', () => {
  it('renders a particle with correct wpm and green color for fast word', () => {
    const ref = createRef<WpmParticlesHandle>();
    const { container } = render(<WpmParticles ref={ref} />);

    act(() => { ref.current!.spawn(100, 50, 75, true); });

    const particle = container.querySelector('.wpm-particle') as HTMLElement;
    expect(particle).not.toBeNull();
    expect(particle.textContent).toBe('75');
    expect(particle.style.color).toBe('var(--success)');
  });

  it('renders a particle with correct wpm and red color for slow word', () => {
    const ref = createRef<WpmParticlesHandle>();
    const { container } = render(<WpmParticles ref={ref} />);

    act(() => { ref.current!.spawn(100, 50, 45, false); });

    const particle = container.querySelector('.wpm-particle') as HTMLElement;
    expect(particle).not.toBeNull();
    expect(particle.textContent).toBe('45');
    expect(particle.style.color).toBe('var(--error)');
  });

  it('removes particle from DOM on animationEnd (self-cleanup)', () => {
    const ref = createRef<WpmParticlesHandle>();
    const { container } = render(<WpmParticles ref={ref} />);

    act(() => { ref.current!.spawn(100, 50, 60, true); });
    expect(container.querySelectorAll('.wpm-particle')).toHaveLength(1);

    fireAnimationEnd(container.querySelector('.wpm-particle')!);

    expect(container.querySelector('.wpm-particle')).toBeNull();
  });

  it('cleans up each particle independently when multiple are spawned', () => {
    const ref = createRef<WpmParticlesHandle>();
    const { container } = render(<WpmParticles ref={ref} />);

    act(() => {
      ref.current!.spawn(100, 50, 60, true);
      ref.current!.spawn(200, 50, 80, false);
    });
    expect(container.querySelectorAll('.wpm-particle')).toHaveLength(2);

    fireAnimationEnd(container.querySelectorAll('.wpm-particle')[0]);

    expect(container.querySelectorAll('.wpm-particle')).toHaveLength(1);
  });

  it('positions particle at spawn coordinates', () => {
    const ref = createRef<WpmParticlesHandle>();
    const { container } = render(<WpmParticles ref={ref} />);

    act(() => { ref.current!.spawn(123, 456, 70, true); });

    const particle = container.querySelector('.wpm-particle') as HTMLElement;
    expect(particle.style.left).toBe('123px');
    expect(particle.style.top).toBe('456px');
  });
});

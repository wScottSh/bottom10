// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import GraduationFlight, { FlightSource } from './GraduationFlight';

// jsdom does not fire animationend natively; invoke the React-registered prop directly.
function fireAnimationEnd(element: Element) {
  const propsKey = Object.keys(element).find(k => k.startsWith('__reactProps'));
  if (!propsKey) throw new Error('No __reactProps on element');
  const props = (element as any)[propsKey];
  act(() => props.onAnimationEnd({ type: 'animationend' }));
}

describe('GraduationFlight', () => {
  it('renders one pulse element per newly graduated word', () => {
    const { container } = render(<GraduationFlight newlyGraduated={['foo', 'bar']} />);
    expect(container.querySelectorAll('[data-testid="graduation-pulse"]')).toHaveLength(2);
  });

  it('marks each pulse with the graduated word name', () => {
    const { container } = render(<GraduationFlight newlyGraduated={['foo']} />);
    expect(container.querySelector('[data-testid="graduation-pulse"][data-word="foo"]')).not.toBeNull();
  });

  it('renders no pulse elements when newlyGraduated is empty', () => {
    const { container } = render(<GraduationFlight newlyGraduated={[]} />);
    expect(container.querySelector('[data-testid="graduation-pulse"]')).toBeNull();
  });

  it('removes a pulse on animationEnd (self-cleanup)', () => {
    const { container } = render(<GraduationFlight newlyGraduated={['foo']} />);
    expect(container.querySelectorAll('[data-testid="graduation-pulse"]')).toHaveLength(1);

    fireAnimationEnd(container.querySelector('[data-testid="graduation-pulse"]')!);

    expect(container.querySelector('[data-testid="graduation-pulse"]')).toBeNull();
  });

  it('cleans up each pulse independently when multiple words graduate', () => {
    const { container } = render(<GraduationFlight newlyGraduated={['foo', 'bar']} />);
    expect(container.querySelectorAll('[data-testid="graduation-pulse"]')).toHaveLength(2);

    fireAnimationEnd(container.querySelectorAll('[data-testid="graduation-pulse"]')[0]);

    expect(container.querySelectorAll('[data-testid="graduation-pulse"]')).toHaveLength(1);
  });

  it('adds new pulses when newlyGraduated prop changes to a new graduation batch', () => {
    const { container, rerender } = render(<GraduationFlight newlyGraduated={['foo']} />);
    expect(container.querySelectorAll('[data-testid="graduation-pulse"]')).toHaveLength(1);

    rerender(<GraduationFlight newlyGraduated={['bar']} />);
    // Old pulse still present (not yet cleaned by animationEnd); new one added
    expect(container.querySelectorAll('[data-testid="graduation-pulse"]')).toHaveLength(2);
  });
});

describe('GraduationFlight — flight clones (FLIP animation)', () => {
  const makeSource = (word: string, srcTop = 100): FlightSource => ({
    word,
    srcTop,
    srcLeft: 10,
    dstTop: 300,
    dstLeft: 10,
  });

  it('renders a graduation-flight-clone per graduated word when flight sources are provided', () => {
    const { container } = render(
      <GraduationFlight newlyGraduated={['foo']} flightSources={[makeSource('foo')]} />
    );
    expect(container.querySelectorAll('[data-testid="graduation-flight-clone"]')).toHaveLength(1);
  });

  it('marks each flight clone with the word name', () => {
    const { container } = render(
      <GraduationFlight newlyGraduated={['foo']} flightSources={[makeSource('foo')]} />
    );
    expect(container.querySelector('[data-testid="graduation-flight-clone"][data-word="foo"]')).not.toBeNull();
  });

  it('flight clone self-cleans on animationEnd', () => {
    const { container } = render(
      <GraduationFlight newlyGraduated={['foo']} flightSources={[makeSource('foo')]} />
    );
    const clone = container.querySelector('[data-testid="graduation-flight-clone"]')!;
    fireAnimationEnd(clone);
    expect(container.querySelector('[data-testid="graduation-flight-clone"]')).toBeNull();
  });

  it('multiple clones have staggered animation-delay for cascade', () => {
    const sources = [makeSource('foo', 100), makeSource('bar', 120)];
    const { container } = render(
      <GraduationFlight newlyGraduated={['foo', 'bar']} flightSources={sources} />
    );
    const clones = container.querySelectorAll('[data-testid="graduation-flight-clone"]') as NodeListOf<HTMLElement>;
    expect(clones).toHaveLength(2);
    expect(clones[0].style.animationDelay).toBe('0ms');
    expect(clones[1].style.animationDelay).toBe('100ms');
  });

  it('does not render flight clones when flightSources is empty', () => {
    const { container } = render(
      <GraduationFlight newlyGraduated={['foo']} flightSources={[]} />
    );
    expect(container.querySelector('[data-testid="graduation-flight-clone"]')).toBeNull();
    // Landing pulse still fires
    expect(container.querySelector('[data-testid="graduation-pulse"]')).not.toBeNull();
  });
});

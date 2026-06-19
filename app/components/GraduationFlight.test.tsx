// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import GraduationFlight from './GraduationFlight';

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

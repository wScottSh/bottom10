// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import KeyboardLayout from './KeyboardLayout';

describe('KeyboardLayout', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(<KeyboardLayout visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the strip when visible', () => {
    const { container } = render(<KeyboardLayout visible={true} />);
    const strip = container.querySelector('.keyboard-layout-strip');
    expect(strip).not.toBeNull();
  });

  it('renders the layout image with correct alt text when visible', () => {
    const { container } = render(<KeyboardLayout visible={true} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.alt).toBe('CharaChorder 2 English Layout');
  });

  it('uses the correct image source path', () => {
    const { container } = render(<KeyboardLayout visible={true} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/CCEnglish2.png');
  });
});

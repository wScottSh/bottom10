// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Sidebar from './Sidebar';

describe('Sidebar wpmTarget prop', () => {
  it('displays the wpmTarget prop value', () => {
    render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={75}
      />
    );
    expect(screen.getByText('75 wpm')).toBeTruthy();
  });

  it('displays a different wpmTarget when the prop changes', () => {
    const { rerender } = render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={40}
      />
    );
    expect(screen.getByText('40 wpm')).toBeTruthy();

    rerender(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        toggleSidebar={() => {}}
        onWpmChange={() => {}}
        wpmTarget={80}
      />
    );
    expect(screen.getByText('80 wpm')).toBeTruthy();
  });

  it('calls onWpmChange with the submitted value when the user edits WPM', () => {
    const onWpmChange = vi.fn();
    render(
      <Sidebar
        isOpen={true}
        wordStats={{}}
        toggleSidebar={() => {}}
        onWpmChange={onWpmChange}
        wpmTarget={40}
      />
    );

    fireEvent.click(screen.getByText('40 wpm'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.click(screen.getByText('set'));

    expect(onWpmChange).toHaveBeenCalledWith(60);
  });
});

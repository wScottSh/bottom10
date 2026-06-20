'use client';

import React from 'react';

interface KeyboardLayoutProps {
  visible: boolean;
}

export default function KeyboardLayout({ visible }: KeyboardLayoutProps) {
  if (!visible) return null;

  return (
    <div className="keyboard-layout-strip">
      <img src="/CCEnglish2.png" alt="CharaChorder 2 English Layout" className="keyboard-layout-img" />
    </div>
  );
}

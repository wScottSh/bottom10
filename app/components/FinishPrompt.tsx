'use client';

import React from 'react';
import { FINISH_PROMPT } from '../utils/juiceConfig';

interface FinishPromptProps {
  visible: boolean;
}

export default function FinishPrompt({ visible }: FinishPromptProps) {
  if (!visible) return null;

  return (
    <div
      className="finish-prompt"
      aria-label="Press space to finish"
      style={{
        '--finish-pulse-duration': `${FINISH_PROMPT.pulseDurationMs}ms`,
        '--finish-pulse-easing': FINISH_PROMPT.pulseEasing,
        '--finish-pulse-scale': FINISH_PROMPT.pulseScale,
        '--finish-pulse-opacity-min': FINISH_PROMPT.pulseOpacityMin,
      } as React.CSSProperties}
    >
      <kbd className="finish-prompt-keycap">space</kbd>
    </div>
  );
}

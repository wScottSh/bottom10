'use client';

import { useState, KeyboardEvent } from 'react';
import { WordStats } from '../utils/wordUtils';
import { buildLifecycleView } from '../utils/wordSelection';
import { GRADUATION_STREAK } from '../utils/graduation';

const getStatusColor = (isCandidate: boolean, fallback: string): string => {
  if (isCandidate) return 'text-cyan-400';
  return fallback;
};

interface SidebarProps {
  isOpen: boolean;
  wordStats: Record<string, WordStats>;
  allWords: string[];
  toggleSidebar: () => void;
  onWpmChange: (wpm: number) => void;
  wpmTarget: number;
}

export default function Sidebar({ isOpen, wordStats, allWords, toggleSidebar, onWpmChange, wpmTarget }: SidebarProps) {
  const [isEditingWpm, setIsEditingWpm] = useState(false);
  const [tempWpm, setTempWpm] = useState('');

  const handleWpmSubmit = () => {
    const newWpm = parseInt(tempWpm);
    if (newWpm > 0) {
      onWpmChange(newWpm);
    }
    setIsEditingWpm(false);
    setTempWpm('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleWpmSubmit();
    }
  };

  const { workingSet } = buildLifecycleView(wordStats, allWords);

  return (
    <div className={`fixed left-0 top-0 h-full bg-[#2c2c2c] transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-0'
    }`}>
      <button
        onClick={toggleSidebar}
        className="absolute -right-10 top-4 bg-[#2c2c2c] p-2 rounded-r"
      >
        {isOpen ? '←' : '→'}
      </button>

      <div className="h-full overflow-y-auto p-4">
        {/* WPM Target UI */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg text-[#e2e2e2]">Current ten</h2>
          {isEditingWpm ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tempWpm}
                onChange={(e) => setTempWpm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-12 p-1 bg-transparent text-[#e2b714] border-b border-[#e2b714] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
              <button
                onClick={handleWpmSubmit}
                className="text-xs text-[#e2b714] hover:text-white px-1"
              >
                set
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingWpm(true)}
              className="text-sm text-[#e2b714] hover:text-white"
            >
              {wpmTarget} wpm
            </button>
          )}
        </div>

        <ul className="space-y-1">
          {workingSet.map(({ word, wpm, streak, isCandidate }, index) => {
            const wordColor = getStatusColor(isCandidate, '');
            const wpmColor = getStatusColor(isCandidate, 'text-[#e2b714]');
            return (
              <li key={`${word}-${index}`}>
                <div className="flex justify-between text-sm">
                  <span className={wordColor}>
                    {word}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: GRADUATION_STREAK }, (_, i) =>
                      i < streak ? (
                        <span key={i} data-testid="pip-filled" className="text-[#e2b714] text-xs leading-none">●</span>
                      ) : (
                        <span key={i} data-testid="pip-empty" className="text-[#555] text-xs leading-none">●</span>
                      )
                    )}
                    {wpm !== null && (
                      <span className={wpmColor}>
                        {wpm} wpm
                      </span>
                    )}
                  </div>
                </div>
                {wpm !== null && (
                  <div className="mt-0.5 h-1 w-full rounded bg-[#3c3c3c]">
                    <div
                      data-testid="wpm-bar"
                      className="h-1 rounded bg-[#e2b714]"
                      style={{ width: `${Math.min(100, Math.round(wpm / wpmTarget * 100))}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

'use client';

import { useState, KeyboardEvent } from 'react';
import { WordStats } from '../utils/wordUtils';
import { buildLifecycleView } from '../utils/wordSelection';
import { GRADUATION_STREAK } from '../utils/graduation';

const UNTOUCHED_PEEK = 3;
const GRADUATED_PEEK = 3;

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
  const [isUntouchedExpanded, setIsUntouchedExpanded] = useState(false);
  const [isGraduatedExpanded, setIsGraduatedExpanded] = useState(false);

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

  const { workingSet, untouched, graduated } = buildLifecycleView(wordStats, allWords);
  const visibleUntouched = isUntouchedExpanded ? untouched.next : untouched.next.slice(0, UNTOUCHED_PEEK);
  const visibleGraduated = isGraduatedExpanded ? graduated : graduated.slice(0, GRADUATED_PEEK);

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

      {isOpen && (
        <div className="h-full overflow-y-auto p-4">
          {untouched.count > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#888]">{untouched.count} untouched</span>
                {untouched.next.length > UNTOUCHED_PEEK && (
                  <button
                    data-testid={isUntouchedExpanded ? 'untouched-collapse' : 'untouched-expand'}
                    onClick={() => setIsUntouchedExpanded(!isUntouchedExpanded)}
                    className="text-xs text-[#666] hover:text-[#888]"
                  >
                    {isUntouchedExpanded ? '▲ less' : '▼ more'}
                  </button>
                )}
              </div>
              <ul className="space-y-0.5">
                {visibleUntouched.map(word => (
                  <li key={word} className="text-xs text-[#666]">{word}</li>
                ))}
              </ul>
              <p className="text-xs text-[#555] mt-1">↓ enters when a slot frees</p>
            </div>
          )}

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
            {workingSet.map(({ word, wpm, streak, isCandidate, movement }, index) => {
              const wordColor = getStatusColor(isCandidate, '');
              const wpmColor = getStatusColor(isCandidate, 'text-[#e2b714]');
              return (
                <li key={`${word}-${index}`}>
                  <div className="flex justify-between text-sm">
                    <span className={wordColor}>
                      {word}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {movement === 'up' && (
                        <span data-testid="movement-up" className="text-xs text-green-400">↑</span>
                      )}
                      {movement === 'down' && (
                        <span data-testid="movement-down" className="text-xs text-red-400">↓</span>
                      )}
                      {Array.from({ length: GRADUATION_STREAK }, (_, i) => {
                        const filled = i < streak;
                        return (
                          <span
                            key={i}
                            data-testid={filled ? 'pip-filled' : 'pip-empty'}
                            className={`text-xs leading-none ${filled ? 'text-[#e2b714]' : 'text-[#555]'}`}
                          >
                            ●
                          </span>
                        );
                      })}
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

          {graduated.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[#555] mb-1">↑ graduates at target pace</p>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#888]">{graduated.length} graduated</span>
                {graduated.length > GRADUATED_PEEK && (
                  <button
                    data-testid={isGraduatedExpanded ? 'graduated-collapse' : 'graduated-expand'}
                    onClick={() => setIsGraduatedExpanded(!isGraduatedExpanded)}
                    className="text-xs text-[#666] hover:text-[#888]"
                  >
                    {isGraduatedExpanded ? '▲ less' : '▼ more'}
                  </button>
                )}
              </div>
              <ul className="space-y-0.5">
                {visibleGraduated.map(({ word, wpm }) => (
                  <li key={word} className="flex justify-between text-xs text-green-500">
                    <span>{word}</span>
                    <span>{wpm} wpm</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

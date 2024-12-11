'use client';

import { useState, KeyboardEvent } from 'react';
import { getTopWordsForTest, calculateGraduationThreshold, WordStats, isGraduated } from '../utils/wordUtils';

interface SidebarProps {
  isOpen: boolean;
  wordStats: Record<string, WordStats>;
  toggleSidebar: () => void;
  onWpmChange: (wpm: number) => void;
}

export default function Sidebar({ isOpen, wordStats, toggleSidebar, onWpmChange }: SidebarProps) {
  const [wpmTarget, setWpmTarget] = useState<number>(() => {
    const saved = localStorage.getItem('wpmTarget');
    return saved ? parseInt(saved) : 40;
  });
  const [isEditingWpm, setIsEditingWpm] = useState(false);
  const [tempWpm, setTempWpm] = useState('');

  const handleWpmSubmit = () => {
    const newWpm = parseInt(tempWpm);
    if (newWpm > 0) {
      setWpmTarget(newWpm);
      localStorage.setItem('wpmTarget', newWpm.toString());
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

  const sortedWords = Object.entries(wordStats)
    .map(([word, stats]) => ({
      word,
      stats,
      isGraduated: isGraduated(stats.lastScore, wpmTarget)
    }))
    .sort((a, b) => {
      // First separate graduated vs non-graduated
      if (a.isGraduated !== b.isGraduated) return a.isGraduated ? 1 : -1;
      
      // Then handle unscored vs scored
      if (!a.stats.lastScore && b.stats.lastScore) return 1;
      if (a.stats.lastScore && !b.stats.lastScore) return -1;
      if (!a.stats.lastScore && !b.stats.lastScore) return 0;
      
      // Finally sort by score (higher = worse performance)
      return b.stats.lastScore - a.stats.lastScore;
    });

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
          <h2 className="text-lg text-[#e2e2e2]">Word List</h2>
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
          {sortedWords.map(({ word, stats, isGraduated }, index) => (
            <li key={`${word}-${index}`}>
              <div className="flex justify-between text-sm">
                <span className={isGraduated ? 'text-green-500' : ''}>
                  {word}
                </span>
                {stats.lastScore > 0 && (
                  <span className={`${isGraduated ? 'text-green-500' : 'text-[#e2b714]'}`}>
                    {Math.round(stats.lastScore)}
                  </span>
                )}
              </div>
              {index === 9 && <hr className="my-2 border-[#e2b714]" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
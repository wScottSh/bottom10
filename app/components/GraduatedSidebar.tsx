
'use client';

import { WordStats, isGraduated } from '../utils/wordUtils';

interface GraduatedSidebarProps {
  isOpen: boolean;
  wordStats: Record<string, WordStats>;
  toggleSidebar: () => void;
  wpmTarget: number;
}

export default function GraduatedSidebar({ isOpen, wordStats, toggleSidebar, wpmTarget }: GraduatedSidebarProps) {
  const sortedWords = Object.entries(wordStats)
    .map(([word, stats]) => ({
      word,
      stats,
      isGraduated: isGraduated(stats.lastScore, wpmTarget)
    }))
    .filter(entry => entry.isGraduated)
    .sort((a, b) => a.stats.lastScore - b.stats.lastScore);  // Best performers first

  return (
    <div className={`fixed right-0 top-0 h-full bg-[#2c2c2c] transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-0'
    }`}>
      <button
        onClick={toggleSidebar}
        className="absolute -left-10 top-4 bg-[#2c2c2c] p-2 rounded-l"
      >
        {isOpen ? '→' : '←'}
      </button>
      
      <div className="h-full overflow-y-auto p-4">
        <h2 className="text-lg text-[#e2e2e2] mb-4">Graduated Words</h2>
        <ul className="space-y-1">
          {sortedWords.map(({ word, stats }, index) => (
            <li key={`${word}-${index}`}>
              <div className="flex justify-between text-sm">
                <span className="text-green-500">{word}</span>
                <span className="text-green-500">
                  {Math.round(stats.lastScore)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
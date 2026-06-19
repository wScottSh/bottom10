'use client';

import { WordStats } from '../utils/wordUtils';
import { selectGraduatedWordRows } from '../utils/wordSelection';

interface GraduatedSidebarProps {
  isOpen: boolean;
  wordStats: Record<string, WordStats>;
  toggleSidebar: () => void;
}

export default function GraduatedSidebar({ isOpen, wordStats, toggleSidebar }: GraduatedSidebarProps) {
  const rows = selectGraduatedWordRows(wordStats);

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
          {rows.map(({ word, wpm }, index) => (
            <li key={`${word}-${index}`}>
              <div className="flex justify-between text-sm">
                <span className="text-green-500">{word}</span>
                <span className="text-green-500">
                  {wpm} wpm
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

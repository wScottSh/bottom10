'use client';

import { useState } from 'react';

interface WordStats {
  word: string;
  time: number;
  attempts: number;
  lastScore: number;
}

export default function Sidebar({ 
  isOpen, 
  wordStats, 
  toggleSidebar 
}: { 
  isOpen: boolean;
  wordStats: Record<string, WordStats>;
  toggleSidebar: () => void;
}) {
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
        <h2 className="text-lg mb-4 text-[#e2e2e2]">Word List</h2>
        <ul className="space-y-1">
          {Object.entries(wordStats).map(([word, stats]) => (
            <li key={word} className="flex justify-between text-sm">
              <span>{word}</span>
              {stats.lastScore > 0 && (
                <span className="text-[#e2b714]">
                  {Math.round(stats.lastScore)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
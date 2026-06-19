// PROTOTYPE — throwaway. A static stand-in for the live typing area so each frame
// has real center-stage density to butt against. Not interactive.
import { typingWords, typingCurrentIndex, typingCurrentCharsTyped } from './mockData';

export default function TypingArea({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative leading-relaxed ${compact ? 'text-xl' : 'text-2xl'}`}>
      {typingWords.map((word, wi) => {
        const isCurrent = wi === typingCurrentIndex;
        const done = wi < typingCurrentIndex;
        return (
          <span key={wi} className={done ? 'text-[#646669]' : 'text-[#d1d0c5]'}>
            {word.split('').map((ch, ci) => {
              const typed = isCurrent && ci < typingCurrentCharsTyped;
              const onCursor = isCurrent && ci === typingCurrentCharsTyped;
              return (
                <span
                  key={ci}
                  className={`relative ${typed ? 'text-[#e2e2e2]' : ''}`}
                >
                  {ch}
                  {onCursor && (
                    <span className="absolute left-0 -bottom-[0.1em] h-[2px] w-full bg-[#e2b714]" />
                  )}
                </span>
              );
            })}
            {' '}
          </span>
        );
      })}
    </div>
  );
}

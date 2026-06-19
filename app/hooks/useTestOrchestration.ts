import { useState, useRef, useCallback, useEffect } from 'react';
import { applySessionToStats, TypedWord, WordStats } from '../utils/wordUtils';
import { generateWordSet } from '../utils/wordGeneration';
import { CompletedWordOutcome } from '../utils/typingSession';
import { ClockLike } from '../utils/clock';
import { useTypingSession } from './useTypingSession';
import { detectGraduations } from '../utils/graduation';

export function useTestOrchestration(opts: {
  globalWordStats: Record<string, WordStats>;
  setGlobalWordStats: (stats: Record<string, WordStats>) => void;
  wpmTarget: number;
  allWords: string[];
  clock?: ClockLike;
  wordCount?: number;
}) {
  const [words, setWords] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(opts.wordCount ?? 50);
  const [newlyGraduated, setNewlyGraduated] = useState<string[]>([]);
  const { session, applyKeystroke, reset: resetSession } = useTypingSession({ clock: opts.clock });

  // Per-test accumulator of completed words; never rendered, so a ref (not state)
  // avoids a redundant re-render on every keystroke.
  const typedWordsRef = useRef<TypedWord[]>([]);

  // Refs so stable callbacks can always read the latest values without re-creating.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const wordCountRef = useRef(wordCount);
  wordCountRef.current = wordCount;
  const globalWordStatsRef = useRef(opts.globalWordStats);
  globalWordStatsRef.current = opts.globalWordStats;
  const wpmTargetRef = useRef(opts.wpmTarget);
  wpmTargetRef.current = opts.wpmTarget;
  const setGlobalWordStatsRef = useRef(opts.setGlobalWordStats);
  setGlobalWordStatsRef.current = opts.setGlobalWordStats;
  const allWordsRef = useRef(opts.allWords);
  allWordsRef.current = opts.allWords;

  const startWithWords = useCallback((newWords: string[]) => {
    if (newWords.length === 0) return;
    setWords(newWords);
    typedWordsRef.current = [];
    resetSession();
  }, [resetSession]);

  const startNewTest = useCallback(() => {
    startWithWords(
      generateWordSet(wordCountRef.current, globalWordStatsRef.current, allWordsRef.current)
    );
  }, [startWithWords]);

  // Auto-start the first test on mount.
  useEffect(() => {
    startNewTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enter-to-restart: pressing Enter at any time starts a fresh test.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') startNewTest();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startNewTest]);

  // Called by the component on every input change. Drives the session reducer,
  // accumulates typed-word data, and auto-restarts when the last word is completed.
  // Returns the completed-word outcome so the component can spawn a WPM particle.
  const handleKeystroke = useCallback((value: string): CompletedWordOutcome | null => {
    const currentWords = wordsRef.current;
    const wordIndex = sessionRef.current.currentWordIndex;
    const isLastWord = wordIndex + 1 === currentWords.length;

    const completed = applyKeystroke(value, currentWords);
    if (!completed) return null;

    const newTypedWord: TypedWord = { word: completed.word, time: completed.elapsed, errors: 0 };
    const updatedTypedWords = [...typedWordsRef.current, newTypedWord];
    typedWordsRef.current = updatedTypedWords;

    if (isLastWord) {
      const prevStats = globalWordStatsRef.current;
      const updatedStats = applySessionToStats(prevStats, updatedTypedWords, wpmTargetRef.current);
      const graduated = detectGraduations(prevStats, updatedStats);
      const newWords = generateWordSet(wordCountRef.current, updatedStats, allWordsRef.current);
      setGlobalWordStatsRef.current(updatedStats);
      setNewlyGraduated(graduated);
      startWithWords(newWords);
    }

    return completed;
  }, [applyKeystroke, startWithWords]);

  return {
    words,
    wordCount,
    setWordCount,
    session,
    handleKeystroke,
    startWithWords,
    newlyGraduated,
  };
}

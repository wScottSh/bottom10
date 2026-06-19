import { useState, useRef, useCallback } from 'react';
import {
  TypingSessionState,
  CompletedWordOutcome,
  applyKeystroke as applyKeystrokeReducer,
} from '../utils/typingSession';
import { ClockLike, WALL_CLOCK } from '../utils/clock';

const INITIAL_SESSION: TypingSessionState = {
  currentInput: '',
  currentWordIndex: 0,
  currentCharIndex: 0,
  hasError: false,
  isWordErrored: false,
  testStarted: false,
  wordStartTimestamp: null,
};

// Owns the typing-session state and drives it through the pure reducer in
// typingSession.ts. applyKeystroke is a stable callback that returns the
// completed-word outcome synchronously, so it reads the latest state from a ref
// (a functional setState updater could not return a value to the caller).
export function useTypingSession(opts?: { clock?: ClockLike }) {
  const [session, setSession] = useState<TypingSessionState>(INITIAL_SESSION);
  const sessionRef = useRef<TypingSessionState>(session);
  sessionRef.current = session;
  const clockRef = useRef<ClockLike>(opts?.clock ?? WALL_CLOCK);

  const applyKeystroke = useCallback(
    (newValue: string, words: string[], timestamp?: number): CompletedWordOutcome | null => {
      const ts = timestamp ?? clockRef.current.now();
      const { state, completedWord } = applyKeystrokeReducer(sessionRef.current, newValue, words, ts);
      sessionRef.current = state;
      setSession(state);
      return completedWord;
    },
    []
  );

  const reset = useCallback(() => {
    sessionRef.current = INITIAL_SESSION;
    setSession(INITIAL_SESSION);
  }, []);

  return { session, applyKeystroke, reset };
}

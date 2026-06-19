import { useState, useRef, useCallback } from 'react';
import {
  TypingSessionState,
  CompletedWordOutcome,
  applyKeystroke as applyKeystrokeReducer,
} from '../utils/typingSession';

const INITIAL_SESSION: TypingSessionState = {
  currentInput: '',
  currentWordIndex: 0,
  currentCharIndex: 0,
  hasError: false,
  isWordErrored: false,
  testStarted: false,
  wordStartTimestamp: null,
};

export function useTypingSession() {
  const [session, setSession] = useState<TypingSessionState>(INITIAL_SESSION);
  const sessionRef = useRef<TypingSessionState>(session);
  sessionRef.current = session;

  const applyKeystroke = useCallback(
    (newValue: string, words: string[], timestamp: number): CompletedWordOutcome | null => {
      const { state, completedWord } = applyKeystrokeReducer(sessionRef.current, newValue, words, timestamp);
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

// Pure typing-session reducer: owns all per-keystroke state transitions —
// correct character entry, space-advance, error detection, isWordErrored latching,
// backspace recovery, word timing, and completed-word outcome emission.

export interface TypingSessionState {
  currentInput: string;
  currentWordIndex: number;
  currentCharIndex: number;
  hasError: boolean;
  isWordErrored: boolean;
  testStarted: boolean;
  wordStartTimestamp: number | null;
}

// Emitted when a word is completed (space after correct word, or last-word direct
// completion). Carries the data TypingTest needs to record the attempt and spawn
// the WPM particle without any DOM measurement.
export interface CompletedWordOutcome {
  word: string;
  elapsed: number;
}

// Applies one keystroke to the session state. Returns the new state and an
// optional completed-word outcome. state is returned as the original reference
// (===) only when the keystroke is a true no-op (space on wrong word, blocked
// by isWordErrored, no current word).
export function applyKeystroke(
  state: TypingSessionState,
  newValue: string,
  words: string[],
  timestamp: number
): { state: TypingSessionState; completedWord: CompletedWordOutcome | null } {
  const currentWord = words[state.currentWordIndex];
  if (!currentWord) return { state, completedWord: null };

  // Space: advance on correct word, ignore on partial/wrong word.
  if (newValue.endsWith(' ')) {
    if (newValue.trim() === currentWord) {
      const elapsed = state.wordStartTimestamp !== null
        ? timestamp - state.wordStartTimestamp
        : 0;
      return {
        state: {
          ...state,
          currentInput: '',
          currentWordIndex: state.currentWordIndex + 1,
          currentCharIndex: 0,
          hasError: false,
          isWordErrored: false,
          wordStartTimestamp: null,
        },
        completedWord: { word: currentWord, elapsed },
      };
    }
    return { state, completedWord: null };
  }

  // Backspace: shrink input, clear hasError, clear isWordErrored only when empty.
  if (newValue.length < state.currentInput.length) {
    return {
      state: {
        ...state,
        currentInput: newValue,
        currentCharIndex: newValue.length,
        hasError: false,
        isWordErrored: newValue.length === 0 ? false : state.isWordErrored,
      },
      completedWord: null,
    };
  }

  // Adding a character. isWordErrored blocks all input until backspace clears it.
  if (state.isWordErrored) return { state, completedWord: null };

  // Typing the first character of the test starts the clock, right or wrong.
  const testStarted = state.testStarted || newValue.length === 1;
  const newChar = newValue[newValue.length - 1];
  const expectedChar = currentWord[state.currentInput.length];
  // Start timing on the first character typed for this word (right or wrong).
  const wordStartTimestamp = state.wordStartTimestamp ?? (newValue.length === 1 ? timestamp : null);

  if (newChar !== expectedChar) {
    // Wrong character: set error, latch isWordErrored when there are chars to delete.
    return {
      state: {
        ...state,
        hasError: true,
        isWordErrored: state.currentInput.length > 0,
        testStarted,
        wordStartTimestamp,
      },
      completedWord: null,
    };
  }

  // Happy path: correct character entry.
  const newState: TypingSessionState = {
    ...state,
    currentInput: newValue,
    currentCharIndex: newValue.length,
    hasError: false,
    testStarted,
    wordStartTimestamp,
  };

  // Last-word direct completion: correct char fills the final word (no space needed).
  const isLastWord = state.currentWordIndex + 1 === words.length;
  if (isLastWord && newValue === currentWord) {
    const elapsed = wordStartTimestamp !== null ? timestamp - wordStartTimestamp : 0;
    return { state: newState, completedWord: { word: currentWord, elapsed } };
  }

  return { state: newState, completedWord: null };
}

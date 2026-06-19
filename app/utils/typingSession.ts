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

export interface ApplyKeystrokeResult {
  state: TypingSessionState;
  completedWord: CompletedWordOutcome | null;
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
): ApplyKeystrokeResult {
  const currentWord = words[state.currentWordIndex];
  if (!currentWord) return { state, completedWord: null };

  // Elapsed typing time for the current word; 0 if the clock never started.
  const elapsedSince = (start: number | null) => (start !== null ? timestamp - start : 0);

  // Space: advance on correct word, ignore on partial/wrong word.
  if (newValue.endsWith(' ')) {
    if (newValue.trim() === currentWord) {
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
        completedWord: { word: currentWord, elapsed: elapsedSince(state.wordStartTimestamp) },
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
    // Wrong character: red the whole word (isWordErrored) until backspaced clear.
    // On the first char we must record the rejected keystroke in currentInput so a
    // real Backspace fires later — an empty field fires no onChange for Backspace in
    // real browsers, which would strand the word red forever (issue #27). currentCharIndex
    // stays put so the cursor doesn't advance over the rejected char. Mid-word, the
    // correct prefix is already there to delete, so leave currentInput untouched.
    const firstChar = state.currentInput.length === 0;
    return {
      state: {
        ...state,
        currentInput: firstChar ? newValue : state.currentInput,
        hasError: true,
        isWordErrored: true,
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

  return { state: newState, completedWord: null };
}

// True only when the typist has fully and correctly typed the last word and is
// waiting for the space press that completes the test (the Finish prompt state).
export function isAwaitingFinish(state: TypingSessionState, words: string[]): boolean {
  if (words.length === 0) return false;
  const lastIndex = words.length - 1;
  if (state.currentWordIndex !== lastIndex) return false;
  if (state.isWordErrored) return false;
  return state.currentInput === words[lastIndex];
}

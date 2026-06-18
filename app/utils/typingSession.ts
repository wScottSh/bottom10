// Pure typing-session reducer: owns all per-keystroke state transitions —
// correct character entry, space-advance, error detection, isWordErrored latching,
// and backspace recovery. Last-word completion remains in the component because
// it triggers side effects (recordCompletedWord, finishTest).

export interface TypingSessionState {
  currentInput: string;
  currentWordIndex: number;
  currentCharIndex: number;
  hasError: boolean;
  isWordErrored: boolean;
  testStarted: boolean;
}

// Applies one keystroke to the session state and returns the new state.
// Returns the original state reference (===) only when the keystroke is a
// true no-op (space on wrong word, blocked by isWordErrored, no current word).
export function applyKeystroke(
  state: TypingSessionState,
  newValue: string,
  words: string[]
): TypingSessionState {
  const currentWord = words[state.currentWordIndex];
  if (!currentWord) return state;

  // Space: advance on correct word, ignore on partial/wrong word.
  if (newValue.endsWith(' ')) {
    if (newValue.trim() === currentWord) {
      return {
        ...state,
        currentInput: '',
        currentWordIndex: state.currentWordIndex + 1,
        currentCharIndex: 0,
        hasError: false,
        isWordErrored: false,
      };
    }
    return state;
  }

  // Backspace: shrink input, clear hasError, clear isWordErrored only when empty.
  if (newValue.length < state.currentInput.length) {
    return {
      ...state,
      currentInput: newValue,
      currentCharIndex: newValue.length,
      hasError: false,
      isWordErrored: newValue.length === 0 ? false : state.isWordErrored,
    };
  }

  // Adding a character. isWordErrored blocks all input until backspace clears it.
  if (state.isWordErrored) return state;

  const newChar = newValue[newValue.length - 1];
  const expectedChar = currentWord[state.currentInput.length];

  if (newChar !== expectedChar) {
    // Wrong character: set error, latch isWordErrored when there are chars to delete.
    return {
      ...state,
      hasError: true,
      isWordErrored: state.currentInput.length > 0,
      testStarted: state.testStarted || newValue.length === 1,
    };
  }

  // Happy path: correct character entry.
  return {
    ...state,
    currentInput: newValue,
    currentCharIndex: newValue.length,
    hasError: false,
    testStarted: state.testStarted || newValue.length === 1,
  };
}

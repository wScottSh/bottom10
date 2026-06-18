// Pure typing-session reducer: owns the per-keystroke state transition for the
// happy path (correct character entry and space-advance to next word).
// Error paths, backspace, and last-word completion remain inline in the component
// and will migrate here in later slices.

export interface TypingSessionState {
  currentInput: string;
  currentWordIndex: number;
  currentCharIndex: number;
  hasError: boolean;
  isWordErrored: boolean;
  testStarted: boolean;
}

// Applies one keystroke to the session state and returns the new state.
// Returns the original state reference (===) when the keystroke is not a
// happy-path case so callers can use reference equality to detect no-ops.
export function applyKeystroke(
  state: TypingSessionState,
  newValue: string,
  words: string[]
): TypingSessionState {
  const currentWord = words[state.currentWordIndex];
  if (!currentWord) return state;

  // Happy path: space after a correctly-typed word — advance to the next word.
  if (newValue.endsWith(' ') && newValue.trim() === currentWord) {
    return {
      ...state,
      currentInput: '',
      currentWordIndex: state.currentWordIndex + 1,
      currentCharIndex: 0,
      hasError: false,
      isWordErrored: false,
    };
  }

  // Happy path: correct character entry (adding a char, not in word-error state).
  const isAddingChar = newValue.length > state.currentInput.length;
  if (isAddingChar && !state.isWordErrored) {
    const newChar = newValue[newValue.length - 1];
    const expectedChar = currentWord[state.currentInput.length];
    if (newChar === expectedChar) {
      return {
        ...state,
        currentInput: newValue,
        currentCharIndex: newValue.length,
        hasError: false,
        testStarted: state.testStarted || newValue.length === 1,
      };
    }
  }

  return state;
}

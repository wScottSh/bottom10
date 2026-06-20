// Pure typing-session reducer. The input field's value is the single source of
// truth: every keystroke re-derives the whole word state from the full input
// string rather than diffing one character at a time. That makes paste, IME
// composition, autocorrect, select-and-replace, and multi-character chords (e.g.
// a CharaChorder emitting a whole word at once) behave correctly, instead of the
// old "only the last character changed" assumption.

export interface TypingSessionState {
  currentInput: string;
  currentWordIndex: number;
  currentCharIndex: number;
  hasError: boolean;
  isWordErrored: boolean;
  testStarted: boolean;
  wordStartTimestamp: number | null;
}

// Emitted when a word is completed (space pressed on an exactly-correct word,
// including the last word, which also requires a space — see isAwaitingFinish).
// Carries the data TypingTest needs to record the attempt and spawn the WPM
// particle without any DOM measurement.
export interface CompletedWordOutcome {
  word: string;
  elapsed: number;
}

export interface ApplyKeystrokeResult {
  state: TypingSessionState;
  completedWord: CompletedWordOutcome | null;
}

// How many characters past the end of a word the typist may over-type before the
// reducer stops growing the input. Over-typed characters are kept (so they render
// red and can be backspaced) rather than silently swallowed, but a stuck key or a
// huge paste can't grow the buffer without bound.
const EXTRA_CHAR_CAP = 8;

// Applies one keystroke to the session state by re-deriving everything from
// newValue (the full, authoritative input-field string). Returns the new state
// and an optional completed-word outcome. The state is returned as the original
// reference (===) only when there is no current word (a true no-op); every other
// keystroke returns a fresh object so the controlled input always re-renders back
// to currentInput and can never diverge from session state.
export function applyKeystroke(
  state: TypingSessionState,
  newValue: string,
  words: string[],
  timestamp: number
): ApplyKeystrokeResult {
  const currentWord = words[state.currentWordIndex];
  if (!currentWord) return { state, completedWord: null };

  const elapsedSince = (start: number | null) => (start !== null ? timestamp - start : 0);

  // Space is an advance signal, never stored as content. Strip every space to get
  // the typed content; the presence of a space means the typist asked to advance.
  const hadSpace = newValue.includes(' ');
  let typed = newValue.replace(/ /g, '');

  // Advance to the next word only when the word is typed exactly right, a space was
  // pressed, AND the per-word clock has already started. The exact-match rule means
  // an errored or incomplete word can never be completed by pressing space. The
  // clock-started rule means an atomic "word + space" paste/chord can't complete in
  // zero elapsed time (which would post an infinite WPM); instead it falls through,
  // lands the content, starts the clock, and the next space completes it.
  if (hadSpace && typed === currentWord && state.wordStartTimestamp !== null) {
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

  // Cap the stored input: the word plus a few over-typed characters.
  const maxLen = currentWord.length + EXTRA_CHAR_CAP;
  if (typed.length > maxLen) typed = typed.slice(0, maxLen);

  // Errored when what's typed is not a correct leading prefix of the word — any
  // mismatched character, or any character typed past the word's end. (startsWith
  // is false for an over-length string, so it also covers extra characters.)
  const isErrored = !currentWord.startsWith(typed);

  // The per-word clock starts on the first content typed (right or wrong) and is
  // preserved across backspaces — fumbling counts as genuine difficulty.
  const wordStartTimestamp = state.wordStartTimestamp ?? (typed.length > 0 ? timestamp : null);
  const testStarted = state.testStarted || typed.length > 0;

  return {
    state: {
      ...state,
      currentInput: typed,
      currentCharIndex: typed.length,
      hasError: isErrored,
      isWordErrored: isErrored,
      testStarted,
      wordStartTimestamp,
    },
    completedWord: null,
  };
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

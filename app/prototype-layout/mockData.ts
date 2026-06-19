// PROTOTYPE — throwaway. Realistic mock data for the layout prototype (issue #18).
// Shapes mirror ActiveWordRow / GraduatedWordRow so density is honest, but nothing
// here is wired to real stats or persistence. Delete with the rest of this folder.

export const WPM_TARGET = 60;

// The working set ("current ten"): worst-first (lowest wpm first). `streak` is the
// consecutive-sub-threshold graduation counter (0 or 1; 2 would have graduated).
export interface WorkingRow {
  word: string;
  wpm: number;
  streak: 0 | 1; // streak === 1 => graduation candidate (one more clean test to go)
}

export const workingSet: WorkingRow[] = [
  { word: 'rhythm', wpm: 38, streak: 0 },
  { word: 'awkward', wpm: 41, streak: 0 },
  { word: 'minimum', wpm: 44, streak: 0 },
  { word: 'jewelry', wpm: 47, streak: 0 },
  { word: 'plaque', wpm: 49, streak: 0 },
  { word: 'syrup', wpm: 52, streak: 1 },
  { word: 'puzzle', wpm: 54, streak: 0 },
  { word: 'vacuum', wpm: 56, streak: 1 },
  { word: 'quartz', wpm: 58, streak: 0 },
  { word: 'beverage', wpm: 59, streak: 1 },
];

// Untouched reservoir: a count, plus the next few words queued to enter the working
// set (deterministic frequency order). Never a full scroll.
export const untouchedCount = 812;
export const untouchedNext = ['through', 'between', 'important', 'different', 'example'];

// Graduated: best-first (highest wpm). A count plus the achievements themselves.
export interface GraduatedRow {
  word: string;
  wpm: number;
}

export const graduatedCount = 175;
export const graduatedRecent: GraduatedRow[] = [
  { word: 'because', wpm: 92 },
  { word: 'people', wpm: 89 },
  { word: 'should', wpm: 87 },
  { word: 'around', wpm: 84 },
  { word: 'world', wpm: 82 },
  { word: 'great', wpm: 80 },
  { word: 'where', wpm: 78 },
  { word: 'while', wpm: 76 },
  { word: 'these', wpm: 74 },
  { word: 'first', wpm: 72 },
  { word: 'water', wpm: 70 },
  { word: 'small', wpm: 68 },
];

// A frozen snapshot of the center typing area so each frame has real density to push
// against. Index of the "current" word + how many chars are typed into it.
export const typingWords = [
  'rhythm', 'awkward', 'syrup', 'rhythm', 'minimum', 'vacuum', 'jewelry', 'rhythm',
  'plaque', 'awkward', 'quartz', 'syrup', 'puzzle', 'rhythm', 'beverage', 'minimum',
  'awkward', 'vacuum', 'rhythm', 'plaque',
];
export const typingCurrentIndex = 3;
export const typingCurrentCharsTyped = 3; // "rhy|thm"

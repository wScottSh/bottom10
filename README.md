# Bottom 10 Typing

Bottom 10 Typing is a web-based typing tutor that applies the principle of "the squeaky wheel gets the grease" to your typing practice. Instead of practicing large, uniform sets of words, it automatically focuses your attention on the words you struggle with most. By drilling down repeatedly on the slowest words in your skillset, you rapidly gain muscle memory efficiency where you need it most, accelerating your improvement.

## Core Idea

Typing improvement happens fastest when you focus on the words you type the slowest. Traditional typing tests and tutors cycle through large sets of words evenly, which can be inefficient. Bottom 10 Typing flips this around: after each test, it identifies your "worst performing" words — the slowest words in your personal word set — and drills them in the next session. Much like spaced repetition emphasizes the flashcards that give you the most trouble, or a Kanban board’s limits highlight bottlenecks, Bottom 10 Typing makes inefficiencies unmistakably "loud," drawing your focus directly to them.

## How It Works

1. **Word Set**:  
   Start with a default set of words (e.g., the top 1000 English words). You can supply your own word list as a simple text file or array.

2. **Tracking Performance**:  
   Each time you take a short test (a sequence of words presented randomly), every word typed is recorded along with your typing speed and accuracy. Over time, this forms a performance profile for each word.

3. **Dynamic Focus**:  
   After each test, the system automatically identifies the bottom 10 words (by typing speed) and prepares the next test using only those words, in random order. As your slowest words improve, new "worst" words will emerge and be cycled into the training set. This ensures continuous, targeted improvement.

4. **Short Tests, Quick Feedback**:  
   Tests should be short: 30 seconds to a minute at a time. The idea is to get immediate feedback on your speed for each slow word, and then cycle quickly into the next set, adjusting as you improve.

5. **Muscle Memory Development**:  
   By repeatedly focusing on the words that are slowest, you develop automaticity. Over time, your speed on these problem words matches the speed of words you already type effortlessly.

## Key Features

- **Default Word Set**:  
  Comes with a top 1000 English words list by default.  
  Easily load a custom list of words via a configuration file.

- **Data Collection**:  
  Every test stores per-word metrics:
  - Average speed (ms per character or WPM).
  - Accuracy and error rate (if you choose to track keystroke errors).
  
- **Adaptive, Squeaky-Wheel Logic**:  
  At the end of each test, the worst-performing words are identified and become the next test set.

- **Randomization**:  
  Within the "worst performing words," each test randomizes their order. This ensures you don't just memorize a sequence but build true muscle memory on each individual word.

- **Simple UI**:  
  Similar to monkeytype or keybr style, a minimal interface focusing on the text entry box and a list of words you’re practicing.

## Implementation Details

- **Frontend**:  
  A minimal single-page application.  
  - Input field for typing.  
  - Display the current test words in sequence.  
  - Progress bar or word count to show how far into the test you are.  
  - Stats display after each test (or on-demand): show updated average speed per word, highlight the worst words, and load the next test with these words.

- **Backend**:  
  Could be a simple REST API, or entirely client-side using local storage for personal practice. For multi-user scenarios:
  - A small backend (Node.js/Express) storing performance data (JSON in a database or flat file).  
  - API endpoints to:
    - GET the next test words.
    - POST test results (per-word times and errors).
    - GET performance stats for all words.
  
- **Algorithm**:
  1. Maintain a dictionary of words → {average_speed, number_of_samples}.
  2. After each test:
     - For each word, update its speed metric with a running average.
     - Sort the word list by speed.
     - Extract the bottom 10 words to form the next test.
  
- **Data Persistence**:  
  A local DB (SQLite), in-browser IndexedDB, or a server-side file. The focus is on simplicity. For a personal project, local browser storage might be enough.

- **Extensibility**:  
  - Add accuracy metrics: track error percentage for each word.
  - Add configurable test lengths or thresholds for "worst performing" sets.
  - Integrate with spaced repetition concepts: once a word consistently performs above a threshold, mark it as "mastered" and remove it from the cycle.
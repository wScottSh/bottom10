import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Default to node for the pure-logic tests; component tests opt into jsdom
    // via a `// @vitest-environment jsdom` directive at the top of the file.
    environment: 'node',
    globals: true,
  },
});

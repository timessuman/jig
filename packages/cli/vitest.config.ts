import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Windows starts processes slowly, and many tests start git several times.
    // On a 4-core Windows CI runner those tests take 10–20× as long as on
    // Linux, and up to 8.5s when other files launch Chrome at the same moment:
    // a different test went past vitest's default 5s on each run. Elsewhere
    // the default stays, so a test that gets slower still fails there.
    // The browser tests set their own limit.
    testTimeout: process.platform === 'win32' ? 20_000 : 5_000,
  },
});

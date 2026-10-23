import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Many tests run the real CLI as a child process, often several times.
    // On a busy Windows CI runner one of those can take well over vitest's
    // default 5s, and the test failed there while passing everywhere else: a
    // different test each run, all of them slow rather than wrong. A hung test
    // still fails, only later.
    testTimeout: 30_000,
  },
});

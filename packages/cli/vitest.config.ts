import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Many tests start git several times, and process start-up is what a busy
    // machine slows down first. Measured: up to 3.5s on a loaded Linux laptop,
    // where one test went past vitest's default 5s, and up to 8.5s on a 4-core
    // Windows CI runner while other files launched Chrome. The limits leave
    // about twice that, so a slow test still fails, and one that hangs fails
    // well before CI gives up. The browser tests set their own limit.
    testTimeout: process.platform === 'win32' ? 20_000 : 10_000,
  },
});

import { defineConfig } from 'vitest/config'

/* ---------------------------------------------------------------------------
   Two kinds of test, run by `npm test`:

     unit   tests/unit — pure functions: dates, money, validation, CSV,
            matching. Nothing from server/ that opens a connection.
     api    tests/api — the real Express app against a throwaway in-memory
            MongoDB per file (tests/helpers/server.ts).

   The browser tests are Playwright's, in tests/e2e (`npm run test:e2e`).

   Each file runs in its own process (forks), so the module-level state the
   server keeps — the env object, the Mongoose connection, the rate-limit
   stores — never leaks from one file into the next.

   TZ is UTC, as on Render, so a date function that quietly leans on the
   machine's zone fails here rather than on 1 July. (The server pins its own
   zone when server/env.ts loads; the unit project never loads it.)

   The api project also loads tests/helpers/setup-api.ts, which imports
   server/db.ts before the test file runs: Mongoose applies the global toJSON
   plugin (`id` rather than `_id`) only to models compiled after it, so a test
   file that imports server/models at the top must not be the first to load
   them.
--------------------------------------------------------------------------- */

export default defineConfig({
  test: {
    env: { TZ: 'UTC' },
    pool: 'forks',
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/helpers/setup-env.ts'],
          env: { TZ: 'UTC' },
          pool: 'forks',
        },
      },
      {
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          setupFiles: ['tests/helpers/setup-env.ts', 'tests/helpers/setup-api.ts'],
          env: { TZ: 'UTC' },
          pool: 'forks',
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})

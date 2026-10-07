/* ---------------------------------------------------------------------------
   Runs before every API test file, after setup-env.ts has fixed the
   environment. Importing server/db.ts registers the global toJSON plugin
   before any model is compiled, so a test file can `import { Gift } from
   '../../server/models'` at the top and still get the same JSON the API
   sends (see the note in vitest.config.ts).
--------------------------------------------------------------------------- */
import '../../server/db'

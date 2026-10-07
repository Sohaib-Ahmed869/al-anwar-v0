import { connect, disconnect } from '../db'
import { runMigrations } from '../migrations'

/* ---------------------------------------------------------------------------
   Run the one-off data migrations by hand (they also run at every start-up;
   see server/migrations.ts).

     npx tsx server/scripts/migrate.ts                  every one not yet run
     npx tsx server/scripts/migrate.ts --again <name>   one of them, again

   Against production, run it with MONGODB_URI set to the production database.
--------------------------------------------------------------------------- */

const i = process.argv.indexOf('--again')
const again = i >= 0 ? process.argv[i + 1] : undefined

await connect()
try {
  await runMigrations({ again })
} finally {
  await disconnect()
}

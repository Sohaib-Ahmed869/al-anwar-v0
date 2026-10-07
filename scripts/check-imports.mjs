/* ---------------------------------------------------------------------------
   The import boundaries, checked (npm run check:imports, and in CI):

     server/  may import shared/, never src/
     shared/  may import neither src/ nor server/ — both sides compile it

   The server once loaded src/services/give.ts and src/components/*-data.ts by
   path. That typed as `any`, so nothing checked it, and it would have broken
   the day the client file grew a React or asset import. Anything both sides
   need lives in shared/.

   Every quoted relative path is checked, not only `import … from`, because
   the old imports were path strings handed to import() at run time.
   Plain Node, no dependencies, so it runs the same on Windows and Linux.
--------------------------------------------------------------------------- */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const RULES = [
  { dir: 'server', forbidden: ['src'] },
  { dir: 'shared', forbidden: ['src', 'server'] },
]

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* files(p)
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) yield p
  }
}

/* a quoted string that starts with ./ or ../ — an import, a dynamic import, a
   require, or a path kept in a constant for later */
const QUOTED_RELATIVE = /(['"`])(\.{1,2}\/[^'"`\n]*)\1/g

const problems = []
for (const { dir, forbidden } of RULES) {
  for (const file of files(join(ROOT, dir))) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(QUOTED_RELATIVE)) {
      const target = relative(ROOT, resolve(dirname(file), m[2]))
      const top = target.split(sep)[0]
      if (forbidden.includes(top)) {
        const line = text.slice(0, m.index).split('\n').length
        problems.push(`${relative(ROOT, file)}:${line}  ${dir}/ must not import ${top}/  (${m[2]})`)
      }
    }
  }
}

if (problems.length) {
  console.error(`Import boundary broken in ${problems.length} place${problems.length === 1 ? '' : 's'}:\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('\nMove what both sides need into shared/.')
  process.exit(1)
}
console.log('Import boundaries hold: server/ and shared/ import nothing from src/.')

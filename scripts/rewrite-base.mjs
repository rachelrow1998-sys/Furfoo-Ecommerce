/**
 * Rewrites absolute public-asset paths in the built bundle so the site works
 * when served from a sub-path (GitHub Pages project site).
 *
 * Source code references public assets as "/media/...", "/videos/..." etc.
 * Vite's --base only rewrites the assets it emits itself, so these literals
 * are patched here instead of touching 77 call sites across the app.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2]
if (!base || !base.startsWith('/') || !base.endsWith('/')) {
  console.error('usage: node scripts/rewrite-base.mjs /sub-path/')
  process.exit(1)
}
if (base === '/') { console.log('base is root, nothing to rewrite'); process.exit(0) }

const dirs = ['media', 'videos', 'sounds', 'hachi', 'cursor']
const pattern = new RegExp(`(["'\`(])/(${dirs.join('|')})/`, 'g')

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const path = join(dir, entry)
  return statSync(path).isDirectory() ? walk(path) : [path]
})

let changed = 0
for (const file of walk('dist').filter((f) => /\.(js|css|html)$/.test(f))) {
  const before = readFileSync(file, 'utf8')
  const after = before.replace(pattern, `$1${base}$2/`)
  if (after !== before) {
    writeFileSync(file, after)
    changed += 1
    console.log('rewrote', file)
  }
}
console.log(`patched ${changed} file(s) with base ${base}`)

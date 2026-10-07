// Vercel ищет результат сборки в <Root Directory>/.vercel/output. Root Directory проекта может быть и корнем репозитория, и web —
// поэтому кладём готовую сборку в оба места.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const web = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(web, '.vercel', 'output'), dst = join(web, '..', '.vercel', 'output')
if (!existsSync(src)) { console.error('нет', src); process.exit(1) }
rmSync(dst, { recursive: true, force: true })
cpSync(src, dst, { recursive: true, verbatimSymlinks: true })
console.log('сборка Vercel: web/.vercel/output и .vercel/output')

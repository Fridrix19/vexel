// Применяет server/db/migrations/*.sql по порядку; каждая — в своей транзакции.
// База, где схема уже есть, но нет записей в schema_migrations (ручной накат 001–003), размечается без повторного применения.
import pg from 'pg'
import { scryptSync, randomBytes } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'db', 'migrations')
const url = process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL
if (!url) { console.error('DATABASE_URL не задан'); process.exit(1) }

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query('create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())')
  const files = (await readdir(dir)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()
  let done = new Set((await client.query('select version from schema_migrations')).rows.map(r => r.version))

  if (done.size === 0) {
    const has = await client.query("select to_regclass('public.users') as u, to_regprocedure('public.place_order(uuid,uuid,jsonb,text)') as p")
    if (has.rows[0].u) {
      const legacy = files.filter(f => /^00[12]_/.test(f) || (has.rows[0].p && /^003_/.test(f)))
      for (const f of legacy) await client.query('insert into schema_migrations (version) values ($1) on conflict do nothing', [f])
      console.log('схема уже была, размечено:', legacy.join(', '))
      done = new Set(legacy)
    }
  }

  for (const f of files) {
    if (done.has(f)) continue
    const sql = await readFile(join(dir, f), 'utf8')
    const own = /^\s*begin\s*;/im.test(sql)       // 002 сам открывает транзакцию
    process.stdout.write(`→ ${f} … `)
    try {
      if (!own) await client.query('begin')
      await client.query(sql)
      if (own) await client.query('insert into schema_migrations (version) values ($1)', [f])
      else { await client.query('insert into schema_migrations (version) values ($1)', [f]); await client.query('commit') }
      console.log('ok')
    } catch (e) {
      await client.query('rollback').catch(() => {})
      console.log('ошибка'); console.error(e.message, e.detail || ''); process.exit(1)
    }
  }
  console.log('миграции применены')

  // первый админ: admin / admin (или ADMIN_BOOTSTRAP_PASSWORD), только если админов нет. Пароль нужно сменить после входа.
  const n = (await client.query('select count(*)::int n from admins')).rows[0].n
  if (n === 0 && process.env.ADMIN_BOOTSTRAP !== 'off') {
    const pw = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin'
    const salt = randomBytes(16)
    const key = scryptSync(pw.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    const hash = `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`
    await client.query(`insert into admins (login, password_hash, name, role, must_change) values ('admin', $1, 'Владелец', 'owner', true)`, [hash])
    console.log('создан админ: admin (смените пароль после входа)')
  }
} finally { await client.end() }

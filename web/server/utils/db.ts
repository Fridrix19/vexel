import pg from 'pg'

// bigint (баланс, копейки) приходит числом: суммы у нас далеко от 2^53
pg.types.setTypeParser(20, v => Number(v))
pg.types.setTypeParser(1700, v => Number(v))

let pool: pg.Pool | null = null
export function db() {
  if (!pool) {
    const url = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL не задан')
    pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX || 5), idleTimeoutMillis: 30_000 })
  }
  return pool
}

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await db().query(sql, params)).rows as T[]
}
export async function one<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return ((await db().query(sql, params)).rows[0] as T) ?? null
}
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db().connect()
  try {
    await c.query('begin')
    const r = await fn(c)
    await c.query('commit')
    return r
  } catch (e) {
    await c.query('rollback').catch(() => {})
    throw e
  } finally { c.release() }
}

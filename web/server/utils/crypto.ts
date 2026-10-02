import { scrypt, randomBytes, timingSafeEqual, createHash, createHmac, randomInt, createCipheriv, createDecipheriv } from 'node:crypto'

const N = 16384, R = 8, P = 1, LEN = 32
function scryptAsync(pw: string, salt: Buffer): Promise<Buffer> {
  return new Promise((res, rej) => scrypt(pw.normalize('NFKC'), salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? rej(e) : res(k)))
}
// формат: scrypt$N$r$p$salt$hash (base64url)
export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  const key = await scryptAsync(pw, salt)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}
export async function verifyPassword(pw: string, stored: string) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') { await scryptAsync(pw, randomBytes(16)); return false }
  const key = await scryptAsync(pw, Buffer.from(parts[4], 'base64url'))
  const want = Buffer.from(parts[5], 'base64url')
  return key.length === want.length && timingSafeEqual(key, want)
}
// хеш «пустого» пароля — чтобы вход в несуществующий аккаунт занимал столько же времени
let dummy: string | null = null
export async function dummyHash() { return dummy ??= await hashPassword(randomBytes(12).toString('hex')) }

export const newToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function secret() {
  const s = useRuntimeConfig().secret || process.env.NUXT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('NUXT_SECRET не задан')
    return 'dev-secret-do-not-use-in-prod'
  }
  return s
}
export const hmac = (s: string) => createHmac('sha256', secret()).update(s).digest('hex')
export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

// AES-256-GCM для данных выдачи и ключей из пула: iv.tag.ciphertext (base64url)
function encKey() { return createHash('sha256').update('enc:' + secret()).digest() }
export function encrypt(plain: string) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', encKey(), iv)
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64url')).join('.')
}
export function decrypt(blob: string) {
  const [iv, tag, data] = blob.split('.').map(s => Buffer.from(s, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', encKey(), iv); d.setAuthTag(tag)
  return Buffer.concat([d.update(data), d.final()]).toString('utf8')
}

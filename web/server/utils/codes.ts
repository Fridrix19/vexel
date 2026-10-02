import type { H3Event } from 'h3'

export type CodePurpose = 'register' | 'login' | 'reset' | 'change_email' | 'reveal'
const TTL_MIN = 10, MAX_ATTEMPTS = 5, RESEND_SEC = 59, PER_EMAIL_HOUR = 6, PER_IP_HOUR = 30

const codeHash = (email: string, purpose: string, code: string) => hmac(`${email}:${purpose}:${code}`)

// выпускает код, соблюдая паузу повтора и лимиты; прежние коды того же назначения гасит
export async function issueCode(e: H3Event, email: string, purpose: CodePurpose) {
  const ip = clientIp(e)
  const last = await one<{ age: number }>(
    `select extract(epoch from now() - created_at)::int as age from email_codes where email = $1 and purpose = $2 order by created_at desc limit 1`, [email, purpose])
  if (last && last.age < RESEND_SEC) fail(429, 'resend_too_soon', `Новый код можно запросить через ${RESEND_SEC - last.age} с.`, { retry_after: RESEND_SEC - last.age })
  const perEmail = await one<{ n: number }>(`select count(*)::int n from email_codes where email = $1 and created_at > now() - interval '1 hour'`, [email])
  if ((perEmail?.n ?? 0) >= PER_EMAIL_HOUR) fail(429, 'too_many_codes', 'Слишком много кодов за час. Попробуйте позже.')
  if (ip) {
    const perIp = await one<{ n: number }>(`select count(*)::int n from email_codes where ip = $1 and created_at > now() - interval '1 hour'`, [ip])
    if ((perIp?.n ?? 0) >= PER_IP_HOUR) fail(429, 'too_many_codes', 'Слишком много запросов. Попробуйте позже.')
  }
  const code = sixDigits()
  await q(`update email_codes set consumed_at = now() where email = $1 and purpose = $2 and consumed_at is null`, [email, purpose])
  await q(`insert into email_codes (email, purpose, code_hash, expires_at, ip) values ($1, $2, $3, now() + interval '${TTL_MIN} minutes', $4)`,
    [email, purpose, codeHash(email, purpose, code), ip])
  const sent = await sendMail(codeMail(email, purpose, code))
  if (!sent.ok) {
    await q(`update email_codes set consumed_at = now() where email = $1 and purpose = $2 and consumed_at is null`, [email, purpose])
    fail(502, 'mail_failed', 'Не удалось отправить письмо. Проверьте адрес или попробуйте через минуту.')
  }
  const dev = devCodesVisible()
  return { sent: true, resend_after: RESEND_SEC, ttl_min: TTL_MIN, ...(dev ? { dev_code: code } : {}) }
}

// проверяет и гасит код; неверный ввод тратит попытку
export async function consumeCode(email: string, purpose: CodePurpose, code: string) {
  const row = await one<{ id: number; code_hash: string; attempts: number; expired: boolean }>(
    `select id, code_hash, attempts, expires_at < now() as expired from email_codes
      where email = $1 and purpose = $2 and consumed_at is null order by created_at desc limit 1`, [email, purpose])
  if (!row) fail(400, 'code_missing', 'Код не запрашивали или он уже использован. Запросите новый.')
  if (row.expired) fail(400, 'code_expired', 'Срок кода истёк. Запросите новый.')
  if (row.attempts >= MAX_ATTEMPTS) fail(429, 'code_attempts', 'Попытки закончились. Запросите новый код.')
  if (row.code_hash !== codeHash(email, purpose, code)) {
    const r = await one<{ attempts: number }>(`update email_codes set attempts = attempts + 1 where id = $1 returning attempts`, [row.id])
    const left = MAX_ATTEMPTS - (r?.attempts ?? MAX_ATTEMPTS)
    fail(400, 'code_wrong', left > 0 ? `Код не подошёл. Осталось попыток: ${left}.` : 'Попытки закончились. Запросите новый код.', { attempts_left: left })
  }
  const ok = await one(`update email_codes set consumed_at = now() where id = $1 and consumed_at is null returning id`, [row.id])
  if (!ok) fail(400, 'code_missing', 'Код уже использован. Запросите новый.')
  return true
}

// код показывается на экране только на стенде и только пока письма реально не уходят (провайдер log).
// Как только включена настоящая почта — код приходит только письмом.
export function devCodesVisible() {
  const cfg = useRuntimeConfig()
  const dev = cfg.devCodes === true || String(cfg.devCodes) === 'true'
  return dev && !(cfg.mailProvider === 'unisender' && cfg.unisenderKey)
}

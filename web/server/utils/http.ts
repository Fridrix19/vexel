import type { H3Event } from 'h3'

// единый формат ошибки: { statusCode, message, data: { code, ...extra } }
export function fail(status: number, code: string, message: string, extra: Record<string, any> = {}): never {
  throw createError({ statusCode: status, statusMessage: code, message, data: { code, ...extra } })
}

export function clientIp(e: H3Event): string | null {
  // за одним прокси (Render) настоящий адрес — последний в X-Forwarded-For: левые значения клиент может подделать
  const xff = getHeader(e, 'x-forwarded-for')
  const ip = xff ? xff.split(',').map(s => s.trim()).filter(Boolean).pop() : getRequestIP(e)
  return ip && /^[0-9a-f:.]+$/i.test(ip) ? ip : null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export function normEmail(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase()
  if (!EMAIL.test(s) || s.length > 254) fail(422, 'bad_email', 'Проверьте почту — например, mail@example.ru.')
  return s
}
export function checkPassword(v: unknown): string {
  const p = String(v ?? '')
  if (p.length < 8) fail(422, 'weak_password', 'Пароль не короче 8 символов.')
  if (p.length > 200) fail(422, 'weak_password', 'Слишком длинный пароль.')
  if (!/\d/.test(p) || !/[^\d\s]/.test(p)) fail(422, 'weak_password', 'Пароль слишком простой: нужны буквы и цифры.')
  return p
}
export function checkCode(v: unknown): string {
  const c = String(v ?? '').replace(/\D/g, '')
  if (c.length !== 6) fail(422, 'bad_code', 'Код — 6 цифр.')
  return c
}

// переводит ошибки SQL-функций (raise exception 'code') в HTTP
const PG_ERRORS: Record<string, [number, string]> = {
  kyc_required: [403, 'Покупки доступны после верификации личности.'],
  limit_exceeded: [403, 'Превышен лимит расходов.'],
  user_blocked: [403, 'Аккаунт заблокирован. Напишите в поддержку.'],
  insufficient_funds: [402, 'Недостаточно средств на балансе.'],
  plan_not_found: [404, 'Тариф не найден.'],
  product_inactive: [404, 'Товар сейчас недоступен.'],
  plan_not_purchasable: [422, 'Этот тариф нельзя купить — только по запросу.'],
  amount_out_of_range: [422, 'Сумма вне допустимого диапазона.'],
  user_not_found: [404, 'Пользователь не найден.'],
  card_unavailable: [422, 'Карта заморожена или не найдена.'],
}
export function pgFail(e: any): never {
  const known = PG_ERRORS[e?.message]
  if (known) {
    const extra: Record<string, any> = {}
    if (e.message === 'insufficient_funds' && e.detail) extra.shortfall_kop = Number(e.detail)
    if (e.message === 'limit_exceeded' && e.detail) {
      const [rem, lim, reset, kyc] = String(e.detail).split('|')
      Object.assign(extra, { remaining_kop: Number(rem), limit_kop: Number(lim), resets_at: reset || null, kyc_status: kyc })
      const rub = (k: number) => new Intl.NumberFormat('ru-RU').format(Math.round(k / 100)) + ' ₽'
      const until = reset ? ' Лимит обновится ' + new Date(reset).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }) + '.' : ''
      fail(403, 'limit_exceeded', kyc === 'approved'
        ? `Превышен месячный лимит ${rub(Number(lim))}: осталось ${rub(Number(rem))}.${until}`
        : `Без верификации можно тратить до ${rub(Number(lim))} в месяц — осталось ${rub(Number(rem))}.${until} Пройдите верификацию, чтобы снять лимит.`, extra)
    }
    if (e.message === 'amount_out_of_range' && e.detail) { const [a, b] = String(e.detail).split('-').map(Number); extra.min_cents = a; extra.max_cents = b }
    fail(known[0], e.message, known[1], extra)
  }
  throw e
}

// логин: 3–32 символа, латиница, цифры, точка, дефис, подчёркивание; начинается с буквы или цифры
export function normUsername(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(s)) fail(422, 'bad_username', 'Логин: 3–32 символа — латиница, цифры, точка, дефис или _; начинается с буквы или цифры.')
  if (/^(admin|support|vexel|root|system|help|info|noreply|mail)$/.test(s)) fail(422, 'username_reserved', 'Этот логин зарезервирован — выберите другой.')
  return s
}

// почта только с разрешённых доменов (список — в админке, «Настройки»)
export async function checkEmailDomain(email: string) {
  const domain = email.split('@')[1]
  const r = await one<{ v: string[] }>(`select value v from settings where key = 'email_domains'`)
  const list = (r?.v || []).map((d: string) => String(d).toLowerCase())
  if (list.length && !list.includes(domain))
    fail(422, 'email_domain', 'Регистрация — только с почтой крупных сервисов: Gmail, Яндекс, Mail.ru, Rambler, iCloud, Outlook и других. Временные и неизвестные адреса не принимаем.', { allowed: list })
}

// аккаунт по логину или почте
export async function findAccount(login: unknown) {
  const s = String(login ?? '').trim().toLowerCase()
  if (!s) fail(422, 'login_required', 'Укажите логин или почту.')
  return one<{ id: string; email: string; username: string; password_hash: string; status: string; locked: boolean; wait: number }>(
    `select id, email, username, password_hash, status, coalesce(locked_until > now(), false) as locked,
            greatest(0, ceil(extract(epoch from locked_until - now()) / 60))::int as wait
       from users where ${s.includes('@') ? 'email' : 'username'} = $1`, [s])
}
export const maskEmail = (e: string) => e.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2')

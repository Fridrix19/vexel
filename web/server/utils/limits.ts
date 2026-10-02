// лимит расходов и бонусный счёт
export async function spendState(userId: string) {
  const s = await one(`select limit_kop, spent_kop, period_start, resets_at from spend_state($1)`, [userId])
  const limit = s.limit_kop == null ? null : Number(s.limit_kop), spent = Number(s.spent_kop)
  return { limit_kop: limit, spent_kop: spent, remaining_kop: limit == null ? null : Math.max(0, limit - spent), period_start: s.period_start, resets_at: s.resets_at }
}
export async function bonusBalance(userId: string) {
  return Number((await one(`select user_bonus($1) b`, [userId])).b)
}
export async function limitSettings() {
  const r = await one(`select value v from settings where key = 'spend_limits'`)
  const b = await one(`select value v from settings where key = 'bonus'`)
  return { unverified_kop: r?.v?.unverified_kop ?? null, verified_kop: r?.v?.verified_kop ?? null, kyc_bonus_kop: Number(b?.v?.kyc_kop ?? 0) }
}
// бонус за верификацию — один раз на пользователя
export async function grantKycBonus(userId: string) {
  const { kyc_bonus_kop } = await limitSettings()
  if (!kyc_bonus_kop) return 0
  const r = await q(`insert into bonus_entries (user_id, kind, reason, amount_kop, note) values ($1, 'grant', 'kyc', $2, 'Бонус за верификацию')
                     on conflict (user_id) where reason = 'kyc' do nothing returning id`, [userId, kyc_bonus_kop])
  return r.length ? kyc_bonus_kop : 0
}

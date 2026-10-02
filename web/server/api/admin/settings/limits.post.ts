// лимиты расходов и бонус за верификацию: {unverified_rub, verified_rub (пусто — без лимита), kyc_bonus_rub}
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'settings')
  const b = await readBody(e)
  const rub = (v: any, what: string, allowEmpty: boolean) => {
    if (v === null || v === undefined || String(v).trim() === '') { if (allowEmpty) return null; fail(422, 'bad_amount', `${what}: укажите сумму.`) }
    const n = Math.round(Number(String(v).replace(/\s/g, '').replace(',', '.')) * 100)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_00) fail(422, 'bad_amount', `${what}: сумма от 0 до 100 млн ₽.`)
    return n
  }
  const limits = { unverified_kop: rub(b?.unverified_rub, 'Лимит без верификации', true), verified_kop: rub(b?.verified_rub, 'Лимит после верификации', true) }
  const bonus = { kyc_kop: rub(b?.kyc_bonus_rub ?? 0, 'Бонус за верификацию', false) }
  const before = await limitSettings()
  await q(`insert into settings (key, value) values ('spend_limits', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(limits)])
  await q(`insert into settings (key, value) values ('bonus', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(bonus)])
  await audit(e, a, 'settings.limits', null, { before, after: { ...limits, kyc_bonus_kop: bonus.kyc_kop } })
  return await limitSettings()
})

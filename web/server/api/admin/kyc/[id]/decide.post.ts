// решение: {action: 'approve'|'reject', reason, birth_date}
export default defineEventHandler(async (e) => {
  const a = await requireAdmin(e, 'kyc')
  const b = await readBody(e)
  const approve = b?.action === 'approve'
  const reason = String(b?.reason ?? '').trim().slice(0, 300)
  if (!approve && !reason) fail(422, 'reason_required', 'Укажите причину отказа — её увидит пользователь.')
  const bd = b?.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(b.birth_date) ? b.birth_date : null
  const k = await tx(async (c) => {
    const k = (await c.query(`update kyc_submissions set status = $2, reason = $3, birth_date = coalesce($4, birth_date), reviewed_by = $5, reviewed_at = now()
                                where id::text = $1 and status = 'pending' returning *`, [getRouterParam(e, 'id'), approve ? 'approved' : 'rejected', approve ? null : reason, bd, a.id])).rows[0]
    if (!k) fail(409, 'already_reviewed', 'Заявка уже рассмотрена.')
    await c.query(`update users set kyc_status = $2, kyc_reason = $3 where id = $1`, [k.user_id, approve ? 'approved' : 'rejected', approve ? null : reason])
    return k
  })
  const bonus = approve ? await grantKycBonus(k.user_id) : 0
  const lim = await limitSettings()
  await notifyUser(k.user_id, approve ? 'Верификация пройдена' : 'Верификация отклонена',
    approve ? (lim.verified_kop == null ? 'Лимит расходов снят.' : 'Лимит расходов увеличен.') + (bonus ? ` Начислили бонус ${bonus / 100} ₽ — он станет скидкой при следующей оплате.` : '') : 'Причина: ' + reason + '. Загрузите документы ещё раз.', '/dashboard.html#kyc')
  await audit(e, a, approve ? 'kyc.approve' : 'kyc.reject', k.id, { user_id: k.user_id, reason })
  return { ok: true }
})

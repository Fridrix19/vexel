// серверные события в историю пользователя: регистрация, вход, заказ, пополнение, KYC
export function trackAction(userId: string, action: string, meta: Record<string, any> = {}, path = '') {
  q(`insert into events (anon_id, session_id, user_id, type, path, target, label, meta) values ('server', 'server', $1, 'action', $2, $3, $4, $5)`,
    [userId, path || '/api', action, meta.label ? String(meta.label).slice(0, 120) : null, meta]).catch(() => {})
}

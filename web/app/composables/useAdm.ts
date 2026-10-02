// общее для админки: текущий админ, запросы к /api/admin с тостами ошибок, форматирование
import { useToast } from 'primevue/usetoast'

type Me = { admin: { id: string; login: string; name: string; role: string; must_change: boolean } | null; perms: string[] }
export const useAdminState = () => useState<Me>('adm-me', () => ({ admin: null, perms: [] }))

export function useAdm() {
  const toast = useToast()
  const me = useAdminState()
  async function api<T = any>(method: string, path: string, body?: any, opts: { quiet?: boolean } = {}): Promise<T> {
    try {
      return await $fetch<T>('/api/admin' + path, { method: method as any, body, credentials: 'same-origin' })
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || 'Ошибка запроса'
      if (e?.status === 401 || e?.statusCode === 401) { me.value = { admin: null, perms: [] }; navigateTo('/admin/login') }
      else if (!opts.quiet) toast.add({ severity: 'error', summary: 'Не получилось', detail: msg, life: 5000 })
      throw e
    }
  }
  function ok(summary: string, detail = '') { toast.add({ severity: 'success', summary, detail, life: 3000 }) }
  const can = (p: string) => me.value.perms.includes(p)
  return { api, ok, me, can }
}

const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const kop = (v: number | null | undefined) => v == null ? '—' : nf2.format(v / 100).replace(/,00$/, '') + ' ₽'
export const usd = (c: number | null | undefined) => c == null ? '—' : '$' + (c / 100).toFixed(2).replace(/\.00$/, '')
export const dt = (v: any) => v ? new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const d = (v: any) => v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const uid = () => (globalThis.crypto?.randomUUID?.() ?? 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2))

export const ORDER_ST: Record<string, [string, string]> = {
  paid: ['Оплачен', 'info'], in_work: ['В работе', 'info'], need_info: ['Нужны данные', 'warn'], done: ['Выполнен', 'success'], canceled: ['Отменён', 'secondary'], refunded: ['Возврат', 'secondary'],
}
export const KYC_ST: Record<string, [string, string]> = { none: ['Нет', 'secondary'], pending: ['На проверке', 'warn'], approved: ['Пройдена', 'success'], rejected: ['Отклонена', 'danger'] }
export const REF_ST: Record<string, [string, string]> = { new: ['Новая', 'warn'], approved: ['Одобрена', 'info'], rejected: ['Отклонена', 'danger'], done: ['Выполнена', 'success'] }
export const ROLE: Record<string, string> = { owner: 'Владелец', senior: 'Старший админ', operator: 'Оператор', kyc: 'Модератор KYC' }
export const PERM_LABEL: Record<string, string> = { summary: 'сводка', users: 'пользователи', 'users.write': 'блокировка', orders: 'заказы и выдача', refunds: 'возвраты', kyc: 'верификация', products: 'товары (просмотр)', 'products.write': 'товары и цены (правка)', admins: 'админы', settings: 'настройки', audit: 'журнал админов', analytics: 'аналитика и история пользователей', export: 'выгрузки CSV', chats: 'чаты с клиентами', reviews: 'отзывы (модерация)', 'balance.adjust': 'корректировка баланса и бонусов' }
export const periodQS = (p: { from: string; to: string }) => (p.from ? '&from=' + p.from : '') + (p.to ? '&to=' + p.to : '')
export const LEDGER: Record<string, string> = { topup: 'Пополнение', purchase: 'Покупка', refund: 'Возврат', adjust: 'Корректировка', payout: 'Вывод на карту' }
export const DELIVERY: Record<string, string> = { manual: 'Ручная', auto: 'Автоматическая (пул ключей)', card_topup: 'Виртуальная карта' }

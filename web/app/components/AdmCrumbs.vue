<script setup lang="ts">
// хлебные крошки админки: Сводка › Раздел › Карточка, плюс «Назад» (по истории, если пришли изнутри админки, иначе — на уровень вверх)
const route = useRoute(), router = useRouter()
const label = useCrumb()
const SEC: Record<string, string> = {"orders": "Заказы", "kyc": "KYC", "refunds": "Возвраты", "chats": "Чаты", "users": "Клиенты", "reviews": "Отзывы", "analytics": "Аналитика", "products": "Товары", "export": "Выгрузки CSV", "admins": "Админы", "settings": "Настройки", "audit": "Журнал действий"}
const items = computed(() => {
  const seg = route.path.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  if (!seg.length) return []
  const sec = seg[0]!
  const detail = seg.length > 1 || (sec === 'chats' && !!route.query.id)
  const out: { t: string; to: string | null }[] = [{ t: 'Сводка', to: '/admin' }, { t: SEC[sec] || sec, to: detail ? '/admin/' + sec : null }]
  if (detail) out.push({ t: label.value || (sec === 'chats' ? 'Переписка' : String(seg[1] || '…')), to: null })
  return out
})
const parent = computed(() => [...items.value].reverse().find(i => i.to)?.to || '/admin')
watch(() => route.fullPath, () => { label.value = '' })
function back() {
  if (route.path === '/admin/chats' && route.query.id) return router.replace({ query: {} })
  const prev = String((window.history.state as any)?.back || '')
  if (prev.startsWith('/admin') && !prev.startsWith('/admin/login')) router.back()
  else navigateTo(parent.value)
}
</script>
<template>
  <nav v-if="items.length" class="adm-crumbs" aria-label="Вы здесь">
    <button type="button" class="ac-back" @click="back"><i class="pi pi-arrow-left" aria-hidden="true" /><span>Назад</span></button>
    <ol class="ac-list">
      <li v-for="(it, i) in items" :key="i"><NuxtLink v-if="it.to" :to="it.to">{{ it.t }}</NuxtLink><span v-else aria-current="page">{{ it.t }}</span></li>
    </ol>
  </nav>
</template>

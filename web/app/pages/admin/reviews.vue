<script setup lang="ts">
// отзывы покупателей: скрыть / показать, ответ магазина
const { api, ok } = useAdm()
const rows = ref<any[]>([]), status = ref<string | null>(null), q = ref(''), loading = ref(false)
const rep = reactive({ open: false, r: null as any, text: '', busy: false })
async function load() { loading.value = true; try { rows.value = (await api('GET', `/reviews?q=${encodeURIComponent(q.value)}${status.value ? '&status=' + status.value : ''}`) as any).reviews } finally { loading.value = false } }
watch(status, load); let t: any; watch(q, () => { clearTimeout(t); t = setTimeout(load, 300) }); onMounted(load)
async function setStatus(r: any, s: string) { await api('PATCH', '/reviews/' + r.id, { status: s }); ok(s === 'hidden' ? 'Отзыв скрыт с сайта' : 'Отзыв снова на сайте'); load() }
async function saveReply() { rep.busy = true; try { await api('PATCH', '/reviews/' + rep.r.id, { reply: rep.text }); ok('Ответ опубликован'); rep.open = false; load() } finally { rep.busy = false } }
const stars = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Покупатели</span><h1>Отзывы</h1></div><span class="muted">{{ rows.length }}</span></div>
  <p class="muted" style="margin-top:-8px">Отзыв можно оставить только по исполненному заказу. Он публикуется сразу: на странице товара и в общем блоке на странице виртуальной карты. Скрытый отзыв пропадает с сайта.</p>
  <div class="toolbar">
    <IconField class="grow"><InputIcon class="pi pi-search" /><InputText v-model="q" placeholder="Товар, текст, почта или заказ" fluid /></IconField>
    <Select v-model="status" :options="[{ v: null, l: 'Все' }, { v: 'published', l: 'На сайте' }, { v: 'hidden', l: 'Скрытые' }]" option-label="l" option-value="v" style="min-width:160px" />
  </div>
  <DataTable :value="rows" :loading="loading" size="small" paginator :rows="30">
    <Column header="Оценка"><template #body="{ data }"><span class="stars">{{ stars(data.rating) }}</span><div class="muted" style="font-size:12px">{{ dt(data.created_at) }}</div></template></Column>
    <Column header="Товар"><template #body="{ data }">{{ data.product_name }}<div><NuxtLink :to="'/admin/orders/' + data.order_id" class="mono muted" style="font-size:12px">{{ data.order_id }}</NuxtLink></div></template></Column>
    <Column header="Отзыв" style="min-width:280px"><template #body="{ data }"><div style="white-space:pre-wrap">{{ data.text }}</div>
      <div class="muted" style="font-size:12px">{{ data.author }} · {{ data.email }}</div>
      <div v-if="data.reply" class="reply"><b>Ответ магазина</b> {{ data.reply }}<span class="muted"> · {{ data.reply_by_name }}</span></div></template></Column>
    <Column header="Статус"><template #body="{ data }"><Tag :value="data.status === 'published' ? 'На сайте' : 'Скрыт'" :severity="data.status === 'published' ? 'success' : 'secondary'" /></template></Column>
    <Column><template #body="{ data }"><div class="row-actions" style="flex-wrap:nowrap">
      <Button :label="data.reply ? 'Изменить ответ' : 'Ответить'" size="small" text @click="Object.assign(rep, { open: true, r: data, text: data.reply || '' })" />
      <Button v-if="data.status === 'published'" label="Скрыть" size="small" text severity="danger" @click="setStatus(data, 'hidden')" />
      <Button v-else label="Показать" size="small" text severity="success" @click="setStatus(data, 'published')" />
    </div></template></Column>
    <template #empty><span class="muted">Отзывов пока нет</span></template>
  </DataTable>
  <Dialog v-model:visible="rep.open" modal header="Ответ магазина" :style="{ width: 'min(480px, 94vw)' }">
    <p class="muted" style="margin-top:0">Ответ появится под отзывом на сайте, покупатель получит уведомление. Пустое поле — убрать ответ.</p>
    <Textarea v-model="rep.text" rows="4" auto-resize fluid maxlength="2000" />
    <template #footer><Button label="Отмена" severity="secondary" text @click="rep.open = false" /><Button label="Сохранить" :loading="rep.busy" @click="saveReply" /></template>
  </Dialog>
</template>
<style scoped>
.stars { color:var(--warn); letter-spacing:1px; white-space:nowrap }
.reply { margin-top:6px; padding:6px 10px; border-left:2px solid var(--p-primary-color); font-size:13px; color:var(--text-2) }
</style>

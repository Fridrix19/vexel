<script setup lang="ts">
const { api } = useAdm()
const route = useRoute()
const rows = ref<any[]>([]), total = ref(0), loading = ref(false)
const f = reactive({ q: String(route.query.q || ''), status: String(route.query.status || 'open'), first: 0 })
const period = ref({ from: '', to: '' })
const STATUS = [{ v: 'open', l: 'В очереди и в работе' }, { v: 'need_info', l: 'Нужны данные' }, { v: 'done', l: 'Выполнены' }, { v: 'refunded,canceled', l: 'Возвраты и отмены' }, { v: 'all', l: 'Все' }]
async function load() {
  loading.value = true
  const st = f.status === 'open' ? 'paid,in_work' : f.status === 'all' ? '' : f.status
  const r: any = await api('GET', `/orders?limit=50&offset=${f.first}&q=${encodeURIComponent(f.q)}${st ? '&status=' + st : ''}${periodQS(period.value)}`).finally(() => loading.value = false)
  rows.value = r.orders; total.value = r.total
}
let t: any; watch(() => f.q, () => { clearTimeout(t); t = setTimeout(() => { f.first = 0; load() }, 300) })
watch(() => f.status, () => { f.first = 0; load() })
watch(period, () => { f.first = 0; load() }, { deep: true })
onMounted(load)
watch(() => route.query.q, v => { if (v != null) f.q = String(v) })
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Заказы</span><h1>Заказы</h1></div></div>
  <div class="toolbar">
    <IconField class="grow"><InputIcon class="pi pi-search" /><InputText v-model="f.q" placeholder="Номер VX-…, логин, почта, товар" fluid /></IconField>
    <SelectButton v-model="f.status" :options="STATUS" option-label="l" option-value="v" :allow-empty="false" />
  </div>
  <div class="toolbar"><AdmPeriod v-model="period" allow-all /><span class="muted">{{ total }} заказов</span></div>
  <DataTable :value="rows" :loading="loading" lazy paginator :rows="50" :total-records="total" :first="f.first" @page="e => { f.first = e.first; load() }"
    row-hover :row-class="() => 'clickable'" @row-click="e => navigateTo('/admin/orders/' + e.data.id)" size="small">
    <Column header="Заказ"><template #body="{ data }"><span class="mono">{{ data.id }}</span></template></Column>
    <Column header="Товар"><template #body="{ data }"><b style="color:var(--text)">{{ data.product_name }}</b><div class="muted">{{ data.plan_label }} · {{ DELIVERY[data.delivery] || '—' }}</div></template></Column>
    <Column header="Клиент"><template #body="{ data }">{{ data.username }}<div class="muted">{{ data.email }}</div></template></Column>
    <Column header="Сумма"><template #body="{ data }"><span class="mono">{{ kop(data.amount_kop) }}</span></template></Column>
    <Column header="Статус"><template #body="{ data }"><Tag :value="ORDER_ST[data.status]?.[0]" :severity="ORDER_ST[data.status]?.[1]" /></template></Column>
    <Column header="Создан"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
    <Column field="admin_name" header="Оператор" />
    <template #empty><span class="muted">Заказов нет</span></template>
  </DataTable>
</template>

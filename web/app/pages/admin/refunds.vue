<script setup lang="ts">
const { api, ok } = useAdm()
const emit = defineEmits(['changed'])
const period = ref({ from: '', to: '' })
const rows = ref<any[]>([]), status = ref('new'), dlg = reactive({ open: false, r: null as any, action: '', note: '', busy: false })
async function load() { rows.value = (await api('GET', '/refunds?x=1' + (status.value === 'all' ? '' : '&status=' + status.value) + periodQS(period.value)) as any).refunds }
watch(status, load); watch(period, load, { deep: true }); onMounted(load)
function open(r: any, action: string) { Object.assign(dlg, { open: true, r, action, note: '' }) }
async function run() {
  dlg.busy = true
  try { await api('POST', '/refunds/' + dlg.r.id, { action: dlg.action, note: dlg.note }); ok('Готово'); dlg.open = false; await load(); emit('changed') } finally { dlg.busy = false }
}
const TITLE: Record<string, string> = { approve: 'Одобрить возврат', reject: 'Отклонить заявку', done: 'Деньги отправлены на карту' }
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Деньги</span><h1>Возвраты</h1></div>
    <SelectButton v-model="status" :options="[{ v: 'new', l: 'Новые' }, { v: 'approved', l: 'Одобренные (на карту)' }, { v: 'all', l: 'Все' }]" option-label="l" option-value="v" :allow-empty="false" /></div>
  <div class="toolbar"><AdmPeriod v-model="period" allow-all /><span class="muted">{{ rows.length }} заявок</span></div>
  <p class="muted" style="margin-top:-8px">На баланс — одобрение сразу возвращает деньги. На карту — одобрите, верните через платёжного провайдера и отметьте «Отправлено».</p>
  <DataTable :value="rows" size="small">
    <Column header="Клиент"><template #body="{ data }"><NuxtLink :to="'/admin/users/' + data.user_id">{{ data.email }}</NuxtLink></template></Column>
    <Column header="По чему"><template #body="{ data }"><NuxtLink v-if="data.order_id" :to="'/admin/orders/' + data.order_id" class="mono">{{ data.order_id }}</NuxtLink><span v-else>вывод пополнения</span><div class="muted">{{ data.product_name }}</div></template></Column>
    <Column header="Сумма"><template #body="{ data }"><span class="mono">{{ kop(data.amount_kop) }}</span></template></Column>
    <Column header="Куда"><template #body="{ data }">{{ data.destination === 'card' ? 'На карту' : 'На баланс' }}</template></Column>
    <Column field="reason" header="Причина" />
    <Column header="Статус"><template #body="{ data }"><Tag :value="REF_ST[data.status][0]" :severity="REF_ST[data.status][1]" /><div v-if="data.admin_note" class="muted">{{ data.admin_note }}</div></template></Column>
    <Column header="Создана"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
    <Column><template #body="{ data }"><div class="row-actions">
      <template v-if="data.status === 'new'"><Button size="small" label="Одобрить" @click="open(data, 'approve')" /><Button size="small" label="Отклонить" severity="danger" outlined @click="open(data, 'reject')" /></template>
      <Button v-if="data.status === 'approved' && data.destination === 'card'" size="small" label="Отправлено" severity="success" outlined @click="open(data, 'done')" />
    </div></template></Column>
    <template #empty><span class="muted">Заявок нет</span></template>
  </DataTable>
  <Dialog v-model:visible="dlg.open" modal :header="TITLE[dlg.action]" :style="{ width: 'min(460px, 94vw)' }">
    <p v-if="dlg.r" style="margin-top:0">{{ dlg.r.email }} · {{ kop(dlg.r.amount_kop) }} · {{ dlg.r.destination === 'card' ? 'на карту' : 'на баланс' }}</p>
    <div class="field"><label>{{ dlg.action === 'reject' ? 'Причина отказа (увидит клиент)' : 'Комментарий' }}</label><Textarea v-model="dlg.note" rows="2" auto-resize fluid /></div>
    <template #footer><Button label="Отмена" severity="secondary" text @click="dlg.open = false" /><Button label="Подтвердить" :loading="dlg.busy" :disabled="dlg.action === 'reject' && !dlg.note.trim()" @click="run" /></template>
  </Dialog>
</template>

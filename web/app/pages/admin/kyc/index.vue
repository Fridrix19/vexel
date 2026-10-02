<script setup lang="ts">
const { api } = useAdm()
const rows = ref<any[]>([]), status = ref('pending'), loading = ref(false), period = ref({ from: '', to: '' })
async function load() { loading.value = true; rows.value = (await api('GET', '/kyc?status=' + status.value + periodQS(period.value)).finally(() => loading.value = false) as any).submissions }
watch(status, load); watch(period, load, { deep: true }); onMounted(load)
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Верификация пользователей</span><h1>Проверка документов</h1></div>
    <SelectButton v-model="status" :options="[{ v: 'pending', l: 'На проверке' }, { v: 'approved', l: 'Одобренные' }, { v: 'rejected', l: 'Отклонённые' }, { v: 'all', l: 'Все' }]" option-label="l" option-value="v" :allow-empty="false" /></div>
  <div class="toolbar"><AdmPeriod v-model="period" allow-all /><span class="muted">{{ rows.length }} заявок</span></div>
  <DataTable :value="rows" :loading="loading" row-hover :row-class="() => 'clickable'" @row-click="e => navigateTo('/admin/kyc/' + e.data.id)" size="small">
    <Column field="email" header="Пользователь" />
    <Column header="Файлов"><template #body="{ data }">{{ data.files }}</template></Column>
    <Column header="Отправлено"><template #body="{ data }">{{ dt(data.created_at) }}</template></Column>
    <Column header="Статус"><template #body="{ data }"><Tag :value="KYC_ST[data.status][0]" :severity="KYC_ST[data.status][1]" /><div v-if="data.reason" class="muted">{{ data.reason }}</div></template></Column>
    <Column field="reviewer" header="Проверил" />
    <template #empty><span class="muted">{{ status === 'pending' ? 'Очередь пуста' : 'Нет заявок' }}</span></template>
  </DataTable>
</template>

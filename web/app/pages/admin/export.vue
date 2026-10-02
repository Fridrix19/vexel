<script setup lang="ts">
const from = ref(''), to = ref('')
const KINDS = [{ k: 'orders', l: 'Заказы', d: 'номер, клиент, товар, цена, курс, списано, статус' }, { k: 'payments', l: 'Пополнения', d: 'сумма, провайдер, статус, даты' },
  { k: 'ledger', l: 'Журнал баланса', d: 'все движения денег: пополнения, покупки, возвраты, корректировки' }, { k: 'users', l: 'Пользователи', d: 'почта, KYC, баланс, даты' }]
const href = (k: string) => `/api/admin/export/${k}.csv?from=${from.value}&to=${to.value}`
</script>
<template>
  <div class="adm-head"><div><span class="eyebrow">Отчёты</span><h1>Выгрузки CSV</h1></div></div>
  <div class="toolbar"><div class="field"><label>С</label><InputText v-model="from" type="date" /></div><div class="field"><label>По</label><InputText v-model="to" type="date" /></div><span class="muted" style="align-self:end;padding-bottom:10px">пусто — за всё время</span></div>
  <div class="grid g2">
    <div v-for="x in KINDS" :key="x.k" class="panel" style="display:flex;justify-content:space-between;gap:12px;align-items:center">
      <div><h3>{{ x.l }}</h3><p class="muted" style="margin:4px 0 0">{{ x.d }}</p></div>
      <a :href="href(x.k)" download><Button label="Скачать" icon="pi pi-download" severity="secondary" outlined /></a>
    </div>
  </div>
  <p class="muted">Разделитель — точка с запятой, кодировка UTF-8: файл открывается в Excel без настроек. Суммы в копейках и центах.</p>
</template>

<script setup lang="ts">
// выбор периода: быстрые варианты и даты «с/по»; пустые даты — за всё время
const model = defineModel<{ from: string; to: string }>({ required: true })
const props = defineProps<{ allowAll?: boolean }>()
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
function preset(k: string) {
  const t = new Date(), f = new Date()
  if (k === 'all') { model.value = { from: '', to: '' }; return }
  if (k === '7') f.setDate(t.getDate() - 6)
  else if (k === '30') f.setDate(t.getDate() - 29)
  else if (k === 'month') f.setDate(1)
  else if (k === 'prev') { f.setMonth(t.getMonth() - 1, 1); t.setDate(0) }
  model.value = { from: iso(f), to: iso(t) }
}
const P = computed(() => [['today', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней'], ['month', 'Этот месяц'], ['prev', 'Прошлый месяц'], ...(props.allowAll ? [['all', 'Всё время']] : [])])
</script>
<template>
  <div class="period">
    <div class="period-presets"><Button v-for="[k, l] in P" :key="k" :label="l" size="small" severity="secondary" text @click="preset(k)" /></div>
    <div class="period-dates">
      <InputText type="date" :model-value="model.from" @update:model-value="v => model = { ...model, from: v || '' }" aria-label="С" />
      <span class="muted">—</span>
      <InputText type="date" :model-value="model.to" @update:model-value="v => model = { ...model, to: v || '' }" aria-label="По" />
    </div>
  </div>
</template>
<style scoped>
.period { display:flex; gap:8px; flex-wrap:wrap; align-items:center }
.period-presets { display:flex; flex-wrap:wrap; gap:2px }
.period-dates { display:flex; gap:6px; align-items:center }
.period-dates :deep(input) { width:150px; padding:.45rem .6rem }
@media (max-width: 600px) { .period-dates :deep(input) { width:130px } }
</style>

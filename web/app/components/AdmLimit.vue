<script setup lang="ts">
// шкала лимита расходов: потрачено / лимит, проценты, когда обновится
const p = defineProps<{ limit: number | null; spent: number; resets?: string | null; compact?: boolean }>()
const pct = computed(() => p.limit ? Math.min(100, Math.round(p.spent / p.limit * 100)) : 0)
const tone = computed(() => pct.value >= 90 ? 'hot' : pct.value >= 70 ? 'warn' : '')
const rub = (k: number) => new Intl.NumberFormat('ru-RU').format(Math.round(k / 100)) + ' ₽'
const when = computed(() => p.resets ? new Date(p.resets).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : null)
</script>
<template>
  <div class="lim" :class="{ compact }">
    <template v-if="limit != null">
      <div class="lim-top"><span class="mono">{{ rub(spent) }} <span class="muted">/ {{ rub(limit) }}</span></span><b :class="tone">{{ pct }}%</b></div>
      <div class="lim-bar" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100"><i :class="tone" :style="{ width: pct + '%' }" /></div>
      <div class="lim-sub muted">{{ when ? 'обновится ' + when : 'период начнётся с первой покупки' }}</div>
    </template>
    <template v-else><div class="lim-top"><span class="muted">без лимита</span></div><div v-if="!compact" class="lim-sub muted">потрачено в периоде: {{ rub(spent) }}</div></template>
  </div>
</template>
<style scoped>
.lim { display:grid; gap:4px; min-width:170px }
.lim-top { display:flex; justify-content:space-between; gap:8px; font-size:13px }
.lim-top b { font:600 12px var(--mono) } .lim-top b.warn { color:var(--warn) } .lim-top b.hot { color:var(--err) }
.lim-bar { height:6px; border-radius:6px; background:var(--line); overflow:hidden }
.lim-bar i { display:block; height:100%; border-radius:6px; background:var(--p-primary-color); transition:width .3s }
.lim-bar i.warn { background:var(--warn) } .lim-bar i.hot { background:var(--err) }
.lim-sub { font-size:11.5px }
.compact .lim-sub { font-size:11px }
</style>

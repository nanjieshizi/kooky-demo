<template>
  <!-- 通讯录 B · 员工详情左区「效能」：雇主视角 —— 他干了多少、干成没有、有没有掉链子、花了我多少 -->
  <section class="ef-pane">
    <header class="ef-head">
      <h3 class="ef-title">效能</h3>
      <div class="ef-periods">
        <button
          v-for="p in EFFICIENCY_PERIODS"
          :key="p"
          type="button"
          class="ef-period"
          :class="{ active: period === p }"
          @click="period = p"
        >{{ p }}</button>
      </div>
    </header>

    <p class="ef-note">
      只统计这个员工给你干的活 —— 与市场里「发布者视角」的跨用户数据是两套口径。
    </p>

    <div class="ef-kpis">
      <button
        v-for="k in eff.stats"
        :key="k.key"
        type="button"
        class="ef-kpi"
        :class="{ active: metric === k.key }"
        @click="metric = k.key"
      >
        <span class="ef-kpi-label">
          {{ k.label }}
          <!-- 二级明细挂 hint 上，hover 才出：不值得单占一格，但排查时得看得到 -->
          <i v-if="k.hint" class="ef-kpi-more" :title="k.hint">?</i>
        </span>
        <span class="ef-kpi-value">{{ k.value }}<i v-if="k.unit" class="ef-kpi-unit">{{ k.unit }}</i></span>
        <span class="ef-kpi-delta" :class="{ up: k.up }">{{ k.delta }}</span>
        <span v-if="k.hint" class="ef-kpi-hint">{{ k.hint }}</span>
      </button>
    </div>

    <div class="ef-trend-head">
      {{ activeStat?.label }}趋势
      <span class="ef-trend-hint">{{ period }} · 点上方指标卡切换</span>
    </div>
    <div class="ef-trend">
      <div
        v-for="(v, i) in trend"
        :key="`${metric}-${period}-${i}`"
        class="ef-bar"
        :class="{ 'ef-bar--last': i === trend.length - 1 }"
        :style="{ height: barHeight(v) }"
      >
        <span class="ef-bar-tip">{{ v }}{{ activeStat?.unit }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useContactsStore, EFFICIENCY_PERIODS } from '@/modules/contacts/store'

defineOptions({ name: 'EmployeeEfficiencyPane' })

const props = defineProps({
  employee: { type: Object, required: true },
})

const store = useContactsStore()
const period = ref('近30天')
const metric = ref('calls')

const eff = computed(() => store.efficiencyOf(props.employee.id, period.value))
const activeStat = computed(() => eff.value.stats.find((s) => s.key === metric.value))
const trend = computed(() => eff.value.trendOf(metric.value))

/** 柱高按本组最大值归一，最矮也留 12% 免得看不见 */
function barHeight(v) {
  const max = Math.max(...trend.value, 1)
  return `${Math.max(12, Math.round((v / max) * 100))}%`
}
</script>

<style lang="scss" scoped>
.ef-pane {
  flex: none;
  padding: 14px 16px 16px;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 16px;
}

.ef-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ef-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
}

.ef-periods {
  margin-left: auto;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: #f1f2f6;
  border-radius: 8px;
}

.ef-period {
  padding: 3px 9px;
  font-size: 11.5px;
  color: #6b7183;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.ef-period.active {
  color: #6a5df0;
  background: #fff;
  box-shadow: 0 1px 2px rgba(47, 53, 71, 0.06);
}

.ef-note {
  margin: 8px 0 12px;
  font-size: 11px;
  line-height: 16px;
  color: #a8b0c0;
}

.ef-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.ef-kpi {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 10px;
  text-align: left;
  background: #f8f9fb;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.ef-kpi:hover {
  background: #f4f5f9;
}

.ef-kpi.active {
  background: #fff;
  border-color: #cfc9fb;
}

.ef-kpi-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9aa0ad;
}

.ef-kpi-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  font-style: normal;
  font-size: 9px;
  color: #b9bfcb;
  background: #eceef3;
  border-radius: 50%;
}

/* 明细气泡：hover 卡片才浮出来，压在卡片上方，不占布局 */
.ef-kpi-hint {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: calc(100% + 6px);
  z-index: 3;
  padding: 5px 8px;
  font-size: 11px;
  line-height: 15px;
  color: #fff;
  background: rgba(47, 53, 71, 0.92);
  border-radius: 7px;
  opacity: 0;
  transform: translateY(3px);
  pointer-events: none;
  transition: opacity 0.15s, transform 0.15s;
}

.ef-kpi:hover .ef-kpi-hint {
  opacity: 1;
  transform: translateY(0);
}

.ef-kpi-value {
  font-size: 19px;
  font-weight: 600;
  line-height: 1.1;
  color: #2f3547;
}

.ef-kpi-unit {
  margin-left: 1px;
  font-size: 11px;
  font-weight: 500;
  font-style: normal;
  color: #9aa0ad;
}

.ef-kpi-delta {
  font-size: 10.5px;
  color: #a8b0c0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ef-kpi-delta.up {
  color: #2fa36b;
}

.ef-trend-head {
  margin: 16px 0 8px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7183;
}

.ef-trend-hint {
  margin-left: 6px;
  font-size: 10.5px;
  font-weight: 400;
  color: #a8b0c0;
}

.ef-trend {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 76px;
}

.ef-bar {
  position: relative;
  flex: 1;
  min-width: 0;
  background: linear-gradient(180deg, #b9b2fb, #ded9ff);
  border-radius: 3px 3px 0 0;
  transition: filter 0.15s;
}

.ef-bar--last {
  background: linear-gradient(180deg, #7b6cf6, #a99efb);
}

.ef-bar:hover {
  filter: brightness(0.94);
}

.ef-bar-tip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 6px;
  font-size: 10px;
  white-space: nowrap;
  color: #fff;
  background: rgba(47, 53, 71, 0.88);
  border-radius: 5px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
}

.ef-bar:hover .ef-bar-tip {
  opacity: 1;
}
</style>

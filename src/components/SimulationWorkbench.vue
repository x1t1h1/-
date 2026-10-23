<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Formula from './Formula.vue'
import Icon from './Icon.vue'
import SimulationChart from './SimulationChart.vue'
import type { SimulationModel, SimulationParamValue, SimulationResult } from '../simulations/types'

const props = defineProps<{ model: SimulationModel }>()

const values = reactive<Record<string, SimulationParamValue>>({})
const result = ref<SimulationResult | null>(null)
const error = ref('')
const controlKey = ref(0)
let computeTimer: ReturnType<typeof setTimeout> | undefined

const chartTabs = computed(() => result.value?.charts ?? [])
const activeChartId = ref('')
const primaryChart = computed(() => chartTabs.value.find((chart) => chart.id === activeChartId.value) || chartTabs.value[0])
const stateColumns = computed(() => result.value?.states[0]?.values ?? [])
const isHtml = computed(() => Boolean(props.model.htmlUrl))

interface SliderChangeEvent {
  detail: { value: number }
}

function onSliderChange(key: string, event: SliderChangeEvent): void {
  values[key] = event.detail.value
}

function applyDefaults(): void {
  const parameters = props.model.parameters ?? []
  const allowed = new Set(parameters.map((parameter) => parameter.key))
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) delete values[key]
  }
  for (const parameter of parameters) values[parameter.key] = parameter.default
}

function onNumberInput(key: string, event: Event): void {
  const detail = (event as unknown as { detail?: { value?: string } }).detail
  const target = event.target as HTMLInputElement | null
  const raw = detail?.value ?? target?.value ?? ''
  const parsed = Number(raw)
  values[key] = Number.isFinite(parsed) ? parsed : raw
}

function compute(): void {
  if (computeTimer) {
    clearTimeout(computeTimer)
    computeTimer = undefined
  }
  if (!props.model.compute) {
    result.value = null
    error.value = ''
    return
  }
  try {
    error.value = ''
    result.value = props.model.compute({ ...values })
  } catch (cause) {
    result.value = null
    error.value = cause instanceof Error ? cause.message : '仿真计算失败，请检查输入参数。'
  }
}

function scheduleCompute(): void {
  if (computeTimer) clearTimeout(computeTimer)
  computeTimer = setTimeout(compute, 120)
}

function reset(): void {
  applyDefaults()
  controlKey.value += 1
  compute()
}

function formatMetric(value: number, precision = 2): string {
  return value.toFixed(precision)
}

function formatState(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

watch(() => props.model, () => {
  applyDefaults()
  controlKey.value += 1
  compute()
}, { immediate: true })

watch(values, scheduleCompute, { deep: true })

onBeforeUnmount(() => {
  if (computeTimer) clearTimeout(computeTimer)
})
</script>

<template>
  <div class="sim-layout">
    <section class="sim-main">
      <iframe
        v-if="isHtml"
        class="html-sim-frame"
        :src="model.htmlUrl"
        :title="model.name"
      ></iframe>

      <template v-else>
      <section class="panel parameter-panel">
        <div class="section-title">
          <h2>参数设置 <span class="title-note">修改后自动计算</span></h2>
          <button class="button ghost small" @click="reset"><Icon name="reset" :size="14" />恢复默认值</button>
        </div>
        <div :key="controlKey" class="parameter-grid">
          <label v-for="parameter in model.parameters" :key="parameter.key" class="parameter-field">
            <span class="parameter-label">{{ parameter.label }} <small v-if="parameter.unit">{{ parameter.unit }}</small></span>
            <template v-if="parameter.type === 'select'">
              <select v-model="values[parameter.key]" :aria-label="parameter.label">
                <option v-for="option in parameter.options || []" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </template>
            <template v-else-if="parameter.type === 'range'">
              <div class="range-row">
                <slider
                  class="sim-slider"
                  :value="Number(values[parameter.key])"
                  :min="parameter.min ?? 0"
                  :max="parameter.max ?? 100"
                  :step="parameter.step ?? 1"
                  active-color="#267760"
                  background-color="#e4ece5"
                  block-size="18"
                  :aria-label="parameter.label"
                  @changing="onSliderChange(parameter.key, $event)"
                  @change="onSliderChange(parameter.key, $event)"
                />
                <output>{{ values[parameter.key] }}<small v-if="parameter.unit">{{ parameter.unit }}</small></output>
              </div>
            </template>
            <template v-else>
              <input
                :value="values[parameter.key]"
                type="number"
                :min="parameter.min"
                :max="parameter.max"
                :step="parameter.step"
                :aria-label="parameter.label"
                @input="onNumberInput(parameter.key, $event)"
              />
            </template>
            <small v-if="parameter.help" class="parameter-help">{{ parameter.help }}</small>
          </label>
        </div>
        <div class="divider"></div>
        <Formula :value="model.formula" :note="model.formulaNote" />
      </section>

      <div v-if="error" class="sim-error" role="alert">
        <Icon name="help" :size="16" />
        <span>{{ error }}</span>
      </div>

      <template v-else-if="result">
        <section class="metric-grid" aria-live="polite">
          <div v-for="metric in result.metrics" :key="metric.label" class="metric-card">
            <span>{{ metric.label }}</span>
            <strong>{{ formatMetric(metric.value, metric.precision) }}<small>{{ metric.unit }}</small></strong>
          </div>
        </section>

        <section v-if="primaryChart" class="panel chart-panel">
          <div class="section-title">
            <div v-if="chartTabs.length > 1" class="tabs chart-tabs" role="tablist" aria-label="选择图表">
              <button
                v-for="chart in chartTabs"
                :key="chart.id"
                :class="{ active: primaryChart.id === chart.id }"
                role="tab"
                :aria-selected="primaryChart.id === chart.id"
                @click="activeChartId = chart.id"
              >{{ chart.title }}</button>
            </div>
            <h2 v-else>{{ primaryChart.title }}</h2>
            <span class="title-note">{{ model.shortName || model.name }} · 自动计算</span>
          </div>
          <SimulationChart :chart="primaryChart" />
          <p class="chart-caption">横轴 {{ primaryChart.xLabel }}　纵轴 {{ primaryChart.yLabel }}</p>
        </section>

        <section v-if="result.states.length" class="panel state-panel">
          <div class="section-title">
            <h2>状态点</h2>
            <span class="title-note">理想气体状态方程 pV = nRT</span>
          </div>
          <div class="state-table-wrap">
            <table class="state-table">
              <thead>
                <tr>
                  <th>状态</th>
                  <th v-for="column in stateColumns" :key="column.label">{{ column.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="state in result.states" :key="state.label">
                  <th>{{ state.label }}</th>
                  <td v-for="cell in state.values" :key="cell.label">{{ formatState(cell.value) }} <small>{{ cell.unit }}</small></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
      </template>
    </section>

    <aside class="sim-side">
      <section class="panel side-panel">
        <span class="eyebrow">MODEL NOTES</span>
        <h2>实验说明</h2>
        <p class="muted">{{ model.description }}</p>
        <ul v-if="result?.notes?.length" class="sim-notes">
          <li v-for="note in result.notes" :key="note">{{ note }}</li>
        </ul>
        <div class="soft-note">
          本页模型通过统一接口接入。组员新增模型时，按 <code>docs/SIMULATION_MODEL_GUIDE.md</code> 实现契约并注册，无需修改本页面。
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.sim-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px;align-items:start}
.sim-main{display:flex;flex-direction:column;gap:18px;min-width:0}
.html-sim-frame{width:100%;height:78vh;min-height:560px;border:1px solid var(--border);border-radius:12px;background:#f7faf7}
.parameter-panel{padding:22px}
.parameter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 18px}
.parameter-field{display:flex;flex-direction:column;gap:7px;font-size:11px;color:#5d7164}
.parameter-label{display:flex;gap:6px;align-items:baseline;font-weight:500}
.parameter-label small{font-size:9px;color:#9aa79c;font-weight:400}
.parameter-field input[type="number"],.parameter-field select{width:100%;min-height:36px;border:1px solid #e2e9e2;background:#fff;color:#526e5b;border-radius:6px;padding:8px 10px;font-size:11px}
.range-row{display:flex;align-items:center;gap:10px}
.sim-slider{flex:1;min-width:0;margin:0}
.range-row output{min-width:78px;text-align:right;font-variant-numeric:tabular-nums;color:#3f6d55;font-size:12px}
.range-row output small{font-size:9px;color:#9aa79c;margin-left:2px}
.parameter-help{font-size:9px;line-height:1.7;color:#a0ac9f}
.parameter-panel :deep(.formula-box){margin-top:0;padding:16px 12px}
.parameter-panel :deep(.katex){font-size:1.1em}
.sim-error{display:flex;gap:9px;align-items:flex-start;background:#fff8f4;border:1px solid #ecd8ce;color:#a25d4a;border-radius:8px;padding:13px 15px;font-size:11px;line-height:1.8}
.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.metric-card{background:#fff;border:1px solid var(--border);border-radius:9px;padding:14px 15px;display:flex;flex-direction:column;gap:7px}
.metric-card>span{font-size:10px;color:#93a096}
.metric-card strong{font-size:20px;font-weight:600;color:#386e53;font-variant-numeric:tabular-nums}
.metric-card small{font-size:10px;font-weight:400;color:#9aa79c;margin-left:3px}
.chart-panel{padding:20px 18px 12px}
.chart-caption{font-size:10px;color:#8b9a8e;text-align:center;margin-top:4px}
.chart-tabs{flex-wrap:wrap;background:#f1f5f1}
.state-panel{padding:20px 18px}
.state-table-wrap{overflow-x:auto}
.state-table{width:100%;border-collapse:collapse;font-size:11px}
.state-table th,.state-table td{text-align:left;padding:10px 12px;border-bottom:1px solid #edf1ed;white-space:nowrap}
.state-table thead th{font-size:10px;color:#9aa79c;font-weight:500;background:#f7f9f7}
.state-table tbody th{font-weight:500;color:#5d7164}
.state-table td{color:#3f6d55;font-variant-numeric:tabular-nums}
.state-table td small{color:#9aa79c;font-size:9px}
.sim-side{position:sticky;top:20px}
.side-panel{padding:23px 21px}
.side-panel h2{font-size:18px;font-weight:600;margin:13px 0 9px;line-height:1.5}
.sim-notes{list-style:none;padding:0;margin:18px 0 0;display:flex;flex-direction:column;gap:9px}
.sim-notes li{font-size:10px;line-height:1.8;color:#8b9a8e;padding-left:12px;position:relative}
.sim-notes li::before{content:'';position:absolute;left:0;top:8px;width:4px;height:4px;border-radius:50%;background:#9db89f}
.soft-note{margin-top:18px}
.soft-note code{font-size:9px;background:#edf4ed;padding:2px 4px;border-radius:3px;color:#5e7f65}
@media(max-width:1100px){.sim-layout{grid-template-columns:minmax(0,1fr) 270px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:980px){.sim-layout{grid-template-columns:1fr}.sim-side{position:static}}
@media(max-width:600px){.parameter-grid{grid-template-columns:1fr}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.parameter-panel{padding:18px}.chart-panel,.state-panel{padding:17px 14px}.metric-card strong{font-size:18px}}
</style>

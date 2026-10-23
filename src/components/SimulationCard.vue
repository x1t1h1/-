<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { SimulationModel, SimulationParamValue } from '../simulations/types'

const props = defineProps<{ model: SimulationModel }>()
const emit = defineEmits<{ open: [id: string] }>()

const accent = computed(() => props.model.accent || '#267760')

const preview = computed(() => {
  if (!props.model.compute) return null
  try {
    const values: Record<string, SimulationParamValue> = {}
    for (const parameter of props.model.parameters ?? []) values[parameter.key] = parameter.default
    const chart = props.model.compute(values).charts[0]
    const series = chart?.series[0]
    if (!series || series.points.length < 2) return null

    const xs = series.points.map((point) => point[0])
    const ys = series.points.map((point) => point[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = maxX - minX
    const spanY = maxY - minY
    if (spanX === 0 && spanY === 0) return null

    const points = series.points.map(([x, y]) => {
      const px = spanX === 0 ? 120 : 8 + ((x - minX) / spanX) * 224
      const py = spanY === 0 ? 40 : 70 - ((y - minY) / spanY) * 58
      return `${px.toFixed(1)},${py.toFixed(1)}`
    }).join(' ')

    return { points, color: series.color || '#0f8a5f' }
  } catch {
    return null
  }
})
</script>

<template>
  <button
    class="simulation-card"
    :aria-label="`进入实验：${model.name}`"
    @click="emit('open', model.id)"
  >
    <span class="card-top">
      <span class="card-icon" :style="{ color: accent, background: accent + '18' }">
        <Icon :name="model.icon || 'flask'" :size="20" />
      </span>
      <span class="tag" :class="{ amber: model.category === '经典循环' }">{{ model.category || '仿真模型' }}</span>
    </span>

    <span class="card-title">{{ model.name }}</span>
    <span class="card-description">{{ model.description }}</span>

    <span v-if="preview" class="card-preview" aria-hidden="true">
      <svg viewBox="0 0 240 80" preserveAspectRatio="none">
        <polyline
          :points="preview.points"
          fill="none"
          :stroke="preview.color"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span v-else-if="model.htmlUrl" class="card-preview is-html" aria-hidden="true">
      <strong class="html-preview-title">{{ model.name }}</strong>
      <span class="html-preview-desc">{{ model.description }}</span>
    </span>
    <span v-else class="card-preview is-empty" aria-hidden="true"></span>

    <span class="card-footer">
      <span>{{ model.shortName || model.name }}</span>
      <span class="card-enter">进入实验 <Icon name="arrow" :size="14" /></span>
    </span>
  </button>
</template>

<style scoped>
.simulation-card{display:flex;flex-direction:column;align-items:stretch;gap:9px;width:100%;text-align:left;background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px 18px 15px;transition:transform .2s,border-color .2s,box-shadow .2s;overflow:hidden}
.simulation-card:hover{transform:translateY(-3px);border-color:#c5d9c9;box-shadow:0 8px 26px #284b3810}
.simulation-card:focus-visible{outline:3px solid #91c5b0;outline-offset:3px}
.card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.card-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;flex-shrink:0}
.card-title{font-size:16px;font-weight:600;color:#2f4a3d;line-height:1.5}
.card-description{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px;line-height:1.8;color:#8b9a8e;min-height:40px}
.card-preview{display:block;height:80px;margin:4px -4px 0;background:linear-gradient(180deg,#f7faf7,#fff);border-radius:8px;overflow:hidden}
.card-preview svg{display:block;width:100%;height:100%}
.card-preview.is-empty{background:#f7faf7}
.card-preview.is-html{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 10px;text-align:left}
.html-preview-title{font-size:13px;font-weight:600;color:#2f4a3d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.html-preview-desc{font-size:10px;line-height:1.6;color:#8b9a8e;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.card-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #eff3ef;padding-top:11px;font-size:10px;color:#9aa79c}
.card-enter{display:flex;align-items:center;gap:4px;color:#4f8063;font-weight:500}
</style>

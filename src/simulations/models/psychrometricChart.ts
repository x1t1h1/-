import type { SimulationModel, SimulationParamValue, SimulationResult, SimulationSeries } from '../types'

/**
 * 湿空气 h–d 焓湿图：自包含 HTML 交互实验，通过 iframe 整体嵌入。
 * 同时提供 compute，为列表页渲染 h–d 示意预览曲线（详情页仍走 iframe）。
 */
const P_TOTAL = 101.325 // kPa
const PHI_FAMILY = [0.4, 0.6, 0.8]
const PHI_COLORS: Record<number, string> = { 0.4: '#8fb9c4', 0.6: '#71a283', 0.8: '#0f8a5f' }

function readNumber(values: Record<string, SimulationParamValue>, key: string, label: string): number {
  const value = Number(values[key])
  if (!Number.isFinite(value)) throw new Error(`${label}不是有效数值`)
  return value
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function satPressure(tCelsius: number): number {
  // Magnus 公式（示意）：水饱和蒸气分压力，kPa。
  return 0.6108 * Math.exp((17.27 * tCelsius) / (tCelsius + 237.3))
}

function humidityRatio(phiFrac: number, tCelsius: number): number {
  const ps = satPressure(tCelsius)
  return (0.622 * phiFrac * ps) / (P_TOTAL - phiFrac * ps) // kg/kg 干空气
}

function enthalpy(phiFrac: number, tCelsius: number): number {
  const d = humidityRatio(phiFrac, tCelsius)
  return 1.006 * tCelsius + d * (2501 + 1.86 * tCelsius) // kJ/kg 干空气
}

function computePsychrometric(values: Record<string, SimulationParamValue>): SimulationResult {
  const phi = readNumber(values, 'phi', '相对湿度 φ')
  if (!(phi >= 0 && phi <= 100)) throw new Error('相对湿度 φ 必须在 0–100% 之间')
  const phiFrac = phi / 100

  const buildLine = (fraction: number): SimulationSeries => {
    const points: Array<[number, number]> = []
    const tMin = 5
    const tMax = 40
    const count = 36
    for (let index = 0; index <= count; index++) {
      const t = tMin + (tMax - tMin) * (index / count)
      points.push([round(humidityRatio(fraction, t) * 1000, 2), round(enthalpy(fraction, t), 1)])
    }
    return { name: `φ = ${Math.round(fraction * 100)}%`, points, color: PHI_COLORS[fraction] }
  }

  const tRef = 25
  const dRef = humidityRatio(phiFrac, tRef) * 1000
  const hRef = enthalpy(phiFrac, tRef)

  return {
    charts: [{
      id: 'hd',
      title: 'h–d 焓湿示意图',
      xLabel: 'd / (g/kg)',
      yLabel: 'h / (kJ/kg)',
      series: PHI_FAMILY.map(buildLine),
    }],
    metrics: [
      { label: '含湿量 d', value: round(dRef, 1), unit: 'g/kg', precision: 1 },
      { label: '焓 h', value: round(hRef, 1), unit: 'kJ/kg', precision: 1 },
    ],
    states: [],
    notes: [
      '卡片为示意预览，交互操作请进入实验。',
      'h–d 曲线族按 φ = 40% / 60% / 80% 示意；含湿量与焓按当前相对湿度在 25℃ 参考点取值。',
    ],
  }
}

export const psychrometricChartModel: SimulationModel = {
  id: 'psychrometric-hd',
  name: '湿空气 h–d 焓湿图',
  shortName: '焓湿图',
  description: '在 h–d 焓湿图上交互观察湿空气的状态参数与空气调节过程，理解含湿量、相对湿度与焓的变化。',
  category: '湿空气',
  icon: 'flask',
  accent: '#71a283',
  chapterIds: ['ch12'],
  htmlUrl: '/static/simulations/psychrometric-hd-chart.html',
  parameters: [
    { key: 'phi', label: '相对湿度 φ', unit: '%', type: 'range', min: 20, max: 100, step: 5, default: 60 },
  ],
  compute: computePsychrometric,
}

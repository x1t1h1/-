import type { SimulationModel, SimulationParamValue, SimulationResult, SimulationSeries } from '../types'

/**
 * 理想气体的多变过程：自包含 HTML 交互实验，通过 iframe 整体嵌入。
 * 同时提供 compute，为列表页渲染 p–v 与 T–s 曲线族示意预览（详情页仍走 iframe）。
 */
const R = 8.314462618 // J/(mol·K)
const GAMMA = 1.4
const CV = R / (GAMMA - 1) // J/(mol·K)
const P1 = 100 // kPa
const V1 = 24.94 // L
const T1 = (P1 * V1) / R // K，约 300 K
const V2 = V1 * 2 // L，膨胀到两倍体积
const FAMILY = [1.2, 1.3, 1.4]
const FAMILY_COLORS: Record<number, string> = { 1.2: '#20a896', 1.3: '#c6904f', 1.4: '#0f8a5f' }

function readNumber(values: Record<string, SimulationParamValue>, key: string, label: string): number {
  const value = Number(values[key])
  if (!Number.isFinite(value)) throw new Error(`${label}不是有效数值`)
  return value
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function sample(start: number, end: number, count: number, fn: (x: number) => number): Array<[number, number]> {
  if (Math.abs(end - start) < 1e-9) {
    return [[round(start, 4), round(fn(start), 4)], [round(end, 4), round(fn(end), 4)]]
  }
  const points: Array<[number, number]> = []
  for (let index = 0; index < count; index++) {
    const x = start + (end - start) * (index / (count - 1))
    points.push([round(x, 4), round(fn(x), 4)])
  }
  return points
}

function computePolytropic(values: Record<string, SimulationParamValue>): SimulationResult {
  const n = readNumber(values, 'n', '多变指数 n')
  if (!(n > 0)) throw new Error('多变指数 n 必须大于 0')

  const buildPv = (index: number): SimulationSeries => ({
    name: `n = ${index}`,
    points: sample(V1, V2, 40, (v) => P1 * Math.pow(V1 / v, index)),
    color: FAMILY_COLORS[index],
  })
  const buildTs = (index: number): SimulationSeries => {
    const points: Array<[number, number]> = []
    const count = 40
    for (let i = 0; i <= count; i++) {
      const v = V1 + (V2 - V1) * (i / count)
      const t = T1 * Math.pow(V1 / v, index - 1)
      const s = CV * Math.log(t / T1) + R * Math.log(v / V1)
      points.push([round(s, 3), round(t, 1)])
    }
    return { name: `n = ${index}`, points, color: FAMILY_COLORS[index] }
  }

  const p2 = P1 * Math.pow(V1 / V2, n)
  const work = Math.abs(n - 1) < 1e-9
    ? P1 * V1 * Math.log(V2 / V1)
    : (P1 * V1 - p2 * V2) / (n - 1)

  return {
    charts: [
      {
        id: 'pv',
        title: 'p–V 曲线族',
        xLabel: 'V / L',
        yLabel: 'p / kPa',
        series: FAMILY.map(buildPv),
      },
      {
        id: 'ts',
        title: 'T–s 曲线族',
        xLabel: 'S / (J/(mol·K))',
        yLabel: 'T / K',
        series: FAMILY.map(buildTs),
      },
    ],
    metrics: [
      { label: '多变过程功 W', value: round(work / 1000, 3), unit: 'kJ', precision: 3 },
    ],
    states: [],
    notes: [
      '卡片为示意预览，交互操作请进入实验。',
      `曲线族按 n = 1.2 / 1.3 / 1.4 示意；多变过程功按当前 n 计算（从 V₁ 膨胀到 2V₁）。`,
    ],
  }
}

export const polytropicProcessModel: SimulationModel = {
  id: 'polytropic-pv-ts',
  name: '理想气体的多变过程',
  shortName: '多变过程',
  description: '在 p–v 与 T–s 图上交互比较理想气体多变过程的曲线，调节多变指数观察等温、等压、等容与绝热过程之间的联系。',
  category: '热力过程',
  icon: 'flask',
  accent: '#20a896',
  chapterIds: ['ch4'],
  htmlUrl: '/static/simulations/polytropic-pv-ts.html',
  parameters: [
    { key: 'n', label: '多变指数 n', type: 'range', min: 1.0, max: 1.6, step: 0.05, default: 1.3 },
  ],
  compute: computePolytropic,
}

import type { SimulationModel, SimulationParamValue, SimulationResult, SimulationSeries } from '../types'

/**
 * 水蒸气的定压汽化过程：自包含 HTML 交互实验，通过 iframe 整体嵌入。
 * 同时提供 compute，为列表页渲染 p–v 与 T–s 示意预览图（详情页仍走 iframe）。
 */
const CHART_COLOR = '#35a7bd'
const P_CRITICAL = 22064 // kPa，水的临界压力（示意）
const V_LIQUID = 0.001 // m³/kg，饱和液比容（示意常数）

function readNumber(values: Record<string, SimulationParamValue>, key: string, label: string): number {
  const value = Number(values[key])
  if (!Number.isFinite(value)) throw new Error(`${label}不是有效数值`)
  return value
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function satTemperature(pressure: number): number {
  return 373.15 * Math.pow(pressure / 101.325, 0.11)
}

function latentHeat(pressure: number): number {
  return Math.max(0, 2256 * (1 - pressure / P_CRITICAL))
}

function vaporVolume(pressure: number): number {
  return 190 / pressure
}

function computeWaterSteam(values: Record<string, SimulationParamValue>): SimulationResult {
  const pressure = readNumber(values, 'p', '压力 p')
  if (!(pressure > 0)) throw new Error('压力 p 必须大于 0')

  const pMin = 50
  const pMax = 20000
  const pressureList: number[] = []
  const steps = 48
  for (let index = 0; index <= steps; index++) pressureList.push(pMin + (pMax - pMin) * (index / steps))

  const vaporLine: SimulationSeries = {
    name: '饱和汽线',
    points: pressureList.map((p): [number, number] => [round(vaporVolume(p), 5), round(p, 1)]),
    color: CHART_COLOR,
  }
  const liquidLine: SimulationSeries = {
    name: '饱和液线',
    points: pressureList.map((p): [number, number] => [V_LIQUID, round(p, 1)]),
    color: '#8fb9c4',
  }

  const v1 = V_LIQUID
  const v3 = vaporVolume(pressure)
  const v2 = (v1 + v3) / 2
  const tSat = satTemperature(pressure)
  const isobaricPath: SimulationSeries = {
    name: '定压汽化路径',
    points: [
      [round(v1, 5), round(pressure, 1)],
      [round(v2, 5), round(pressure, 1)],
      [round(v3, 5), round(pressure, 1)],
    ],
    color: '#c6904f',
  }

  const temperatureList = pressureList.map(satTemperature)
  const heatList = pressureList.map(latentHeat)
  const sLiquid = pressureList.map((_, index) => round(4.18 * Math.log(temperatureList[index] / 373.15), 3))
  const sVapor = pressureList.map((_, index) => round(sLiquid[index] + heatList[index] / temperatureList[index], 3))
  const liquidTs: SimulationSeries = {
    name: '饱和液线',
    points: pressureList.map((_, index): [number, number] => [sLiquid[index], round(temperatureList[index], 1)]),
    color: '#8fb9c4',
  }
  const vaporTs: SimulationSeries = {
    name: '饱和汽线',
    points: pressureList.map((_, index): [number, number] => [sVapor[index], round(temperatureList[index], 1)]),
    color: CHART_COLOR,
  }

  const rSat = latentHeat(pressure)
  const s1 = 4.18 * Math.log(tSat / 373.15)
  const s3 = s1 + rSat / tSat
  const s2 = (s1 + s3) / 2
  const tsPath: SimulationSeries = {
    name: '定压汽化路径',
    points: [
      [round(s1, 3), round(tSat, 1)],
      [round(s2, 3), round(tSat, 1)],
      [round(s3, 3), round(tSat, 1)],
    ],
    color: '#c6904f',
  }

  return {
    charts: [
      {
        id: 'pv',
        title: 'p–v 示意图',
        xLabel: 'v / (m³/kg)',
        yLabel: 'p / kPa',
        series: [vaporLine, liquidLine, isobaricPath],
        markPoints: [
          { name: '1 饱和液', x: round(v1, 5), y: round(pressure, 1) },
          { name: '2 湿蒸汽', x: round(v2, 5), y: round(pressure, 1) },
          { name: '3 饱和汽', x: round(v3, 5), y: round(pressure, 1) },
        ],
      },
      {
        id: 'ts',
        title: 'T–s 示意图',
        xLabel: 's / (kJ/(kg·K))',
        yLabel: 'T / K',
        series: [vaporTs, liquidTs, tsPath],
        markPoints: [
          { name: '1 饱和液', x: round(s1, 3), y: round(tSat, 1) },
          { name: '2 湿蒸汽', x: round(s2, 3), y: round(tSat, 1) },
          { name: '3 饱和汽', x: round(s3, 3), y: round(tSat, 1) },
        ],
      },
    ],
    metrics: [
      { label: '汽化潜热 r', value: round(rSat, 1), unit: 'kJ/kg', precision: 1 },
      { label: '饱和温度 T_sat', value: round(tSat, 1), unit: 'K', precision: 1 },
    ],
    states: [],
    notes: [
      '卡片为示意预览，交互操作请进入实验。',
      '饱和液线按 v′ ≈ 0.001 m³/kg 示意；饱和汽线按 v″ ≈ 190/p（kPa）示意，随压力升高向临界点收敛。',
    ],
  }
}

export const waterSteamModel: SimulationModel = {
  id: 'water-steam-pv-ts',
  name: '水蒸气的定压汽化过程',
  shortName: '水蒸气定压汽化',
  description: '在 p–v 与 T–s 相图上交互观察水在定压下的汽化过程，理解饱和区、湿蒸汽与过热蒸汽的状态变化。',
  category: '热力过程',
  icon: 'flask',
  accent: '#35a7bd',
  chapterIds: ['ch3'],
  htmlUrl: '/static/simulations/water-steam-pv-ts.html',
  parameters: [
    { key: 'p', label: '压力 p', unit: 'kPa', type: 'range', min: 50, max: 20000, step: 50, default: 1000 },
  ],
  compute: computeWaterSteam,
}

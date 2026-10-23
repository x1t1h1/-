/**
 * 仿真模型统一接入契约。
 *
 * 组员新增模型时只需实现 SimulationModel 并注册到 registry.ts，
 * 不需要修改仿真页面本身。
 */

export type SimulationParamValue = number | string

export interface SimulationParameter {
  key: string
  label: string
  unit?: string
  type?: 'number' | 'range' | 'select'
  min?: number
  max?: number
  step?: number
  options?: Array<{ label: string; value: string }>
  default: SimulationParamValue
  help?: string
}

export interface SimulationSeries {
  name: string
  points: Array<[number, number]>
  color?: string
}

export interface SimulationChart {
  id: string
  title: string
  xLabel: string
  yLabel: string
  series: SimulationSeries[]
  markPoints?: Array<{ name: string; x: number; y: number }>
}

export interface SimulationMetric {
  label: string
  value: number
  unit: string
  precision?: number
}

export interface SimulationState {
  label: string
  values: Array<{ label: string; value: number; unit: string }>
}

export interface SimulationResult {
  charts: SimulationChart[]
  metrics: SimulationMetric[]
  states: SimulationState[]
  notes?: string[]
}

export interface SimulationModel {
  id: string
  name: string
  shortName?: string
  description: string
  /** 实验分类，例如「经典循环」「基础过程」 */
  category?: string
  /** Icon.vue 中的图标名；默认 flask */
  icon?: string
  /** 实验卡片的强调色（十六进制），用于图标底色 */
  accent?: string
  /** LaTeX 公式，交给 Formula.vue 渲染 */
  formula?: string
  formulaNote?: string
  /** 可选：关联 course.ts 中的章节 id */
  chapterIds?: string[]
  /** 可选：独立 HTML 交互实验的资源路径，如 '/static/simulations/water-steam-pv-ts.html'。提供后以 iframe 整体嵌入展示，不需要 parameters 与 compute。 */
  htmlUrl?: string
  parameters?: SimulationParameter[]
  /**
   * 纯函数：不访问 DOM、不发起网络请求、不依赖时间或随机数。
   * 输入不合法时抛出带中文说明的 Error，由页面统一展示。
   */
  compute?(values: Record<string, SimulationParamValue>): SimulationResult
}

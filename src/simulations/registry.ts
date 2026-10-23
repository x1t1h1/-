import type { SimulationModel } from './types'
import { carnotCycleModel } from './models/carnotCycle'
import { idealGasProcessModels } from './models/idealGasProcesses'
import { waterSteamModel } from './models/waterSteam'
import { polytropicProcessModel } from './models/polytropicProcess'
import { psychrometricChartModel } from './models/psychrometricChart'

/**
 * 仿真模型注册表。
 * 组员新增模型时：在 models/ 下新建文件，并在这里 import、加入数组。
 * 注册后，仿真首页会自动多一张实验卡片，并生成对应的独立详情页。
 */
export const simulationModels: SimulationModel[] = [
  carnotCycleModel,
  ...idealGasProcessModels,
  waterSteamModel,
  polytropicProcessModel,
  psychrometricChartModel,
]

const byId = new Map<string, SimulationModel>()

for (const model of simulationModels) {
  if (byId.has(model.id)) {
    throw new Error(`仿真模型 id 重复：${model.id}`)
  }
  byId.set(model.id, model)

  for (const parameter of model.parameters ?? []) {
    if (parameter.type === 'select') continue
    const value = Number(parameter.default)
    if (!Number.isFinite(value)) {
      throw new Error(`模型 ${model.id} 的参数 ${parameter.key} 默认值不是有效数字`)
    }
    if (parameter.min !== undefined && value < parameter.min) {
      throw new Error(`模型 ${model.id} 的参数 ${parameter.key} 默认值小于最小值`)
    }
    if (parameter.max !== undefined && value > parameter.max) {
      throw new Error(`模型 ${model.id} 的参数 ${parameter.key} 默认值大于最大值`)
    }
  }
}

export function getSimulationModel(id?: string): SimulationModel {
  const fallback = simulationModels[0]
  if (!fallback) throw new Error('尚未注册任何仿真模型')
  return (id && byId.get(id)) || fallback
}

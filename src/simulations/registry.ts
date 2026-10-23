import type { SimulationModel } from './types'

// 1. 导入原有的模型
import { carnotCycleModel } from './models/carnotCycle'
import { idealGasProcessModels } from './models/idealGasProcesses'

// 2. 导入你新增的喷管模型
import { convergentNozzle } from './models/convergentNozzle'
import { lavalNozzle } from './models/lavalNozzle'

// 3. 导入你新增的内燃机循环模型
import { ottoCycle } from './models/ottoCycle'
import { dieselCycle } from './models/dieselCycle'
import { dualCycle } from './models/dualCycle'

/**
 * 仿真模型注册表。
 * 组员新增模型时：在 models/ 下新建文件，并在这里 import、加入数组。
 * 注册后，仿真首页会自动多一张实验卡片，并生成对应的独立详情页。
 */
export const simulationModels: SimulationModel[] = [
  // 原有模型
  carnotCycleModel,
  ...idealGasProcessModels,
  
  // 新增模型（喷管与内燃机循环）
  convergentNozzle,
  lavalNozzle,
  ottoCycle,
  dieselCycle,
  dualCycle
]

const byId = new Map<string, SimulationModel>()

for (const model of simulationModels) {
  // 检查 id 是否重复
  if (byId.has(model.id)) {
    throw new Error(`仿真模型 id 重复：${model.id}`)
  }
  byId.set(model.id, model)

  // 检查参数默认值是否合法
  for (const parameter of model.parameters) {
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
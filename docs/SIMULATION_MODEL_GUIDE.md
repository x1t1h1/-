# 仿真模型接入指南

本指南面向负责制作热力学仿真模型的组员。仿真页面本身只负责渲染参数、图表、指标卡和状态表；模型通过统一契约接入，**新增模型不需要修改页面代码**。

## 1. 目录结构

```
src/simulations/
├─ types.ts                     模型契约（先读）
├─ registry.ts                  模型注册表
└─ models/
   ├─ carnotCycle.ts            卡诺循环（p–V 与 T–s 两张图）
   └─ idealGasProcesses.ts      理想气体四种基本过程
src/components/
├─ SimulationCard.vue           实验卡片（仿真首页）
├─ SimulationWorkbench.vue      通用参数/结果渲染（详情页）
└─ SimulationChart.vue          ECharts 图表包装
src/pages/simulation/
├─ index.vue                    实验卡片列表
└─ detail.vue                   独立实验详情页
```

## 2. 接入步骤

1. 在 `src/simulations/models/` 下新建一个 `.ts` 文件，导出一个 `SimulationModel` 对象。
2. 打开 `src/simulations/registry.ts`，import 新模型并加入 `simulationModels` 数组。
3. 运行 `npm run typecheck`，确认类型通过。
4. 启动 `npm run dev`，打开 `http://127.0.0.1:5173/#/pages/simulation/index` 查看新卡片；点击卡片进入详情页，或直接打开 `http://127.0.0.1:5173/#/pages/simulation/detail?model=<你的模型 id>`。

注册后会自动发生两件事：

- 仿真首页多一张实验卡片，卡片预览会用**默认参数**调用一次 `compute` 并绘制第一张图；
- 点击卡片进入 `pages/simulation/detail`，由 `SimulationWorkbench.vue` 自动生成参数控件、图表、指标卡与状态表。

不需要改动 `src/pages/simulation/index.vue`、`detail.vue`、`SimulationCard.vue`、`SimulationWorkbench.vue` 或 `SimulationChart.vue`。

## 3. 模型契约

完整类型见 `src/simulations/types.ts`。核心字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 全局唯一，建议 kebab-case，例如 `carnot-cycle` |
| `name` | `string` | 完整名称，显示在说明面板 |
| `shortName` | `string?` | 卡片和详情页标签上的短名称 |
| `description` | `string` | 一两句话说明模型用途和适用条件 |
| `category` | `string?` | 卡片上的分类标签，例如「经典循环」「基础过程」 |
| `icon` | `string?` | `Icon.vue` 中的图标名，默认 `flask` |
| `accent` | `string?` | 卡片图标的强调色，十六进制，例如 `#c6904f` |
| `formula` | `string?` | LaTeX 公式，交给 `Formula.vue` 渲染；用 `String.raw` 包裹 |
| `formulaNote` | `string?` | 公式适用条件 |
| `chapterIds` | `string[]?` | 可选，关联 `src/data/course.ts` 中已有的章节 id |
| `parameters` | `SimulationParameter[]` | 页面自动生成参数控件 |
| `compute` | `(values) => SimulationResult` | 纯函数，返回图表、指标卡、状态点 |

### 参数定义

| 字段 | 说明 |
| --- | --- |
| `key` | 参数键，`compute` 中用它读取值 |
| `label` / `unit` | 界面显示的名称与单位 |
| `type` | `number`（数字输入）、`range`（滑块）、`select`（下拉） |
| `min` / `max` / `step` | 数值范围与步长；`select` 不需要 |
| `options` | `select` 的选项：`{ label, value }[]` |
| `default` | 默认值；必须在 `min`/`max` 范围内 |
| `help` | 可选，参数下方的说明文字 |

### 输出定义

| 字段 | 说明 |
| --- | --- |
| `charts` | 图表数组；返回多张时，详情页会自动显示图表切换标签（卡诺循环提供 p–V 与 T–s 两张） |
| `charts[].xLabel` / `yLabel` | 坐标轴名称，**必须带单位**，例如 `V / L`、`p / kPa` |
| `charts[].series[].points` | `[x, y]` 数值点数组 |
| `charts[].markPoints` | 可选，标注状态点，例如状态 1/2 |
| `metrics` | 指标卡；`precision` 控制小数位 |
| `states` | 状态点表；每行一组 label/value/unit |
| `notes` | 可选，说明与限制条件 |

## 4. 单位与符号约定

| 物理量 | 内部单位 | 界面展示 |
| --- | --- | --- |
| 压力 `p` | kPa（绝对压力） | kPa |
| 体积 `V` | L | L |
| 温度 `T` | K（热力学温度） | K |
| 能量 `W` / `Q` / `ΔU` | J | 建议换算为 kJ |
| 熵变 `ΔS` | J/K | J/K |

- 符号约定与现有课程数据一致：`ΔU = Q − W`，`W` 为系统对外做功。
- 理想气体常数 `R = 8.314462618 J/(mol·K)`。
- 压力用绝对压力，不要用表压。

## 5. 最小模型示例

新建 `src/simulations/models/springDemo.ts`：

```ts
import type { SimulationModel } from '../types'

export const springDemo: SimulationModel = {
  id: 'spring-demo',
  name: '示例：线性关系',
  shortName: '示例',
  description: '用于验证接入流程的最小模型，不参与课程计算。',
  category: '示例',
  icon: 'flask',
  formula: String.raw`y = kx`,
  formulaNote: '仅用于演示接入流程。',
  chapterIds: ['ch4'],
  parameters: [
    { key: 'k', label: '斜率 k', type: 'range', min: 0.5, max: 5, step: 0.1, default: 2 },
    { key: 'x', label: '输入 x', type: 'range', min: 0, max: 10, step: 0.1, default: 4 },
  ],
  compute(values) {
    const k = Number(values.k)
    const x = Number(values.x)
    if (!Number.isFinite(k) || !Number.isFinite(x)) {
      throw new Error('k 和 x 必须是有效数值')
    }
    const points: Array<[number, number]> = []
    for (let index = 0; index <= 40; index++) {
      const current = (x * index) / 40
      points.push([current, k * current])
    }
    return {
      charts: [{
        id: 'main',
        title: 'y = kx',
        xLabel: 'x',
        yLabel: 'y',
        series: [{ name: 'y', points, color: '#0f8a5f' }],
      }],
      metrics: [{ label: 'y', value: k * x, unit: '', precision: 2 }],
      states: [],
      notes: ['示例模型，不参与课程计算。'],
    }
  },
}
```

在 `src/simulations/registry.ts` 中注册：

```ts
import { springDemo } from './models/springDemo'

export const simulationModels: SimulationModel[] = [
  ...idealGasProcessModels,
  springDemo,
]
```

## 6. 校验清单

提交前逐项确认：

- [ ] `id` 全局唯一，且未复用已有 id。
- [ ] 所有参数默认值在 `min`/`max` 范围内，且默认参数下 `compute` 能成功返回结果（首页卡片预览会调用一次）。
- [ ] `compute` 保持轻量，不在其中做重计算或异步请求；首页需要为每张卡片计算一次预览。
- [ ] 多图模型的 `charts` 中每张图都有唯一的 `id`、标题和坐标轴单位。
- [ ] `compute` 是纯函数：不访问 DOM、不发网络请求、不读当前时间、不使用随机数。
- [ ] 非法输入（0、负数、非数字）会抛出带中文说明的 `Error`，不会返回 NaN。
- [ ] 输出点均为有限数字，没有 `NaN` / `Infinity`。
- [ ] 坐标轴名称带单位。
- [ ] 公式与适用条件经过课程同学或教师核对。
- [ ] `npm run typecheck` 通过。
- [ ] 在页面上切换模型、拖动参数、恢复默认值均正常。

## 7. 现有示例模型

`src/simulations/models/carnotCycle.ts` 是一个完整的经典循环示例，提供 p–V 与 T–s 两张图和四个状态点，适合参考多图、多状态点的写法。

`src/simulations/models/idealGasProcesses.ts` 包含四个基础过程模型：

| id | 名称 | 主要曲线 |
| --- | --- | --- |
| `ideal-gas-isothermal` | 理想气体定温过程 | p–V 双曲线 |
| `ideal-gas-isobaric` | 理想气体定压过程 | p = 常数的水平线 |
| `ideal-gas-isochoric` | 理想气体定容过程 | V = 常数的竖直线 |
| `ideal-gas-adiabatic` | 理想气体绝热过程 | pV^γ = 常数 |

它们复用同一个结果构造函数，演示了参数、图表、指标卡与状态表的完整写法。

## 8. 纯前端限制

本项目是纯前端 H5 演示，**没有后端**。因此：

- 模型必须能直接在浏览器运行，推荐用 TypeScript/JavaScript 重写计算部分。
- Python/MATLAB 模型不能直接接入；需要先导出为 JS/WASM，或提供可独立运行的 HTML（通过 `htmlUrl` 以 iframe 整体嵌入，详见第 10 节「独立 HTML 实验接入」）。
- 不要在模型里写 API Key、服务器地址或任何密钥。
- 单个模型的参数和采样点不宜过多；当前图表建议 40–120 个点。

## 9. 常见问题

| 现象 | 排查 |
| --- | --- |
| 页面没有出现新模型 | 是否在 `registry.ts` 中注册？id 是否重复？ |
| 参数控件不显示 | `parameters` 是否为空？`key` 是否重复？ |
| 图表空白 | `points` 是否为空或包含 `NaN`？坐标轴名称是否设置？ |
| 页面报中文错误 | 这是 `compute` 抛出的输入校验信息，按提示修正参数 |
| 类型检查失败 | 检查是否从 `../types` 正确导入 `SimulationModel` |

## 10. 独立 HTML 实验接入

对于自带滑块、预设按钮与结果面板的自包含交互页面（内联 CSS + Canvas，零外部依赖），无需拆成 `compute` 数据模型，可直接以 iframe 整体嵌入。

### 接入字段

在模型对象上设置 `htmlUrl`，指向打包后可访问的静态资源路径，例如：

```ts
export const waterSteamModel: SimulationModel = {
  id: 'water-steam-pv-ts',
  name: '水蒸气的定压汽化过程',
  description: '在 p–v 与 T–s 相图上交互观察水在定压下的汽化过程。',
  category: '热力过程',
  accent: '#35a7bd',
  chapterIds: ['ch3'],
  htmlUrl: '/static/simulations/water-steam-pv-ts.html',
}
```

- 设置 `htmlUrl` 后可以省略 `parameters` 与 `compute`（两者均为可选字段）。
- 仿真首页卡片会跳过 `compute` 预览，改为在预览区显示实验标题与一句话说明。
- 详情页会隐藏参数面板、指标卡、ECharts 图表与状态表，改为主区域渲染整页 `<iframe>`；侧栏「实验说明」仍保留。

### 文件位置与访问方式

- 独立 HTML 文件放在 `src/static/simulations/` 下，文件名使用 kebab-case，例如 `water-steam-pv-ts.html`。
- `htmlUrl` 以 `/static/simulations/` 开头；构建后静态资源会复制到发布目录，运行时按同一路径访问。
- 页面必须自包含：不要引用外部 `src`/`href`、CDN 或远程图片；脚本与样式直接内联。

### 注意事项

- 嵌入的 iframe 宽度 100%、高度约 78vh（手机端不低于 560px），带边框圆角与浅背景。
- 请确认 HTML 页面在窄屏下不产生横向溢出，交互（滑块、预设按钮、图表随参数变化）在 iframe 内正常。
- 现有计算模型（卡诺循环、理想气体过程等）不受影响，继续使用 `parameters` + `compute` 方式。

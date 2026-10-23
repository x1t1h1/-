import type { SimulationModel, SimulationResult } from '../types'

// --- 纯数学计算核心（从你提供的 HTML 中提取） ---
const R = 0.287;
const RSI = 287;
const L = 30;
const NPROF = 60;
const c0Of = (T0: number, k: number) => Math.sqrt(k * RSI * T0);
const betaCr = (k: number) => Math.pow(2 / (k + 1), k / (k - 1));
const G1 = (k: number) => Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));
const MachToP = (Ma: number, k: number) => Math.pow(1 + (k - 1) / 2 * Ma * Ma, -k / (k - 1));
const MachToT = (Ma: number, k: number) => 1 / (1 + (k - 1) / 2 * Ma * Ma);
const MachFromPR = (pr: number, k: number) => Math.sqrt(2 / (k - 1) * (Math.pow(pr, -(k - 1) / k) - 1));
const areaMach = (Ma: number, k: number) => 1 / Ma * Math.pow((2 / (k + 1)) * (1 + (k - 1) / 2 * Ma * Ma), (k + 1) / (2 * (k - 1)));
const fluxG = (Ma: number, k: number) => Ma * Math.pow(1 + (k - 1) / 2 * Ma * Ma, -(k + 1) / (2 * (k - 1)));
const geomConv = (x: number, A1: number, A2: number) => A1 - (A1 - A2) * (1 - Math.cos(Math.PI * x / L)) / 2;

function machFromArea(AR: number, k: number, branch: 'sub' | 'sup') {
  let lo = branch === 'sup' ? 1 : 1e-9;
  let hi = branch === 'sup' ? 40 : 1;
  for (let i = 0; i < 90; i++) {
    const m = (lo + hi) / 2;
    if (areaMach(m, k) < AR) { if (branch === 'sup') lo = m; else hi = m; }
    else { if (branch === 'sup') hi = m; else lo = m; }
  }
  return (lo + hi) / 2;
}

function machFromFlux(g: number, k: number) {
  if (g <= 0) return 0;
  if (g >= G1(k)) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 90; i++) {
    const m = (lo + hi) / 2;
    if (fluxG(m, k) < g) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

export const convergentNozzle: SimulationModel = {
  id: 'convergent-nozzle',
  name: '渐缩喷管仿真实验',
  shortName: '渐缩喷管',
  description: '亚音速渐缩通道，临界截面在出口。观察背压变化对压力分布和流量的影响。',
  category: '基础过程',
  icon: 'flask',
  accent: '#2a78d6',
  parameters: [
    { key: 'p0', label: '滞止压力 p₀', unit: 'kPa', type: 'range', min: 200, max: 1200, step: 10, default: 500 },
    { key: 'T0', label: '滞止温度 T₀', unit: 'K', type: 'range', min: 280, max: 600, step: 5, default: 300 },
    { key: 'pb', label: '背压 pb', unit: 'kPa', type: 'range', min: 10, max: 1200, step: 5, default: 400, help: '需小于滞止压力' },
    { key: 'A2', label: '出口面积 A₂', unit: 'cm²', type: 'range', min: 2, max: 20, step: 0.5, default: 8 },
    { key: 'k', label: '比热比 k', type: 'range', min: 1.2, max: 1.67, step: 0.01, default: 1.4 }
  ],
  compute(values): SimulationResult {
    for (const parameter of convergentNozzle.parameters ?? []) {
      const value = values[parameter.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${parameter.label}必须是有效数字`);
      if ((parameter.min !== undefined && value < parameter.min) || (parameter.max !== undefined && value > parameter.max)) {
        throw new Error(`${parameter.label}必须在 ${parameter.min} 至 ${parameter.max} ${parameter.unit ?? ''}之间`);
      }
    }
    const { p0, T0, pb, A2, k } = values as Record<string, number>;
    if (pb >= p0) throw new Error('背压必须小于滞止压力');

    const c0 = c0Of(T0, k);
    const rho0 = p0 / (R * T0);
    const beta = betaCr(k);
    const pcr = p0 * beta;
    
    let regime, pe, Mae, Te, ce, mdot;
    if (pb >= pcr) {
      regime = pb > pcr ? '亚临界工况' : '临界工况';
      pe = pb;
      Mae = MachFromPR(pe / p0, k);
      Te = T0 * MachToT(Mae, k);
      ce = Mae * Math.sqrt(k * RSI * Te);
      mdot = A2 * 1e-4 * (pe / (R * Te)) * ce;
    } else {
      regime = '超临界工况（壅塞）';
      pe = pcr;
      Mae = 1;
      Te = 2 * T0 / (k + 1);
      ce = Math.sqrt(k * RSI * Te);
      mdot = A2 * 1e-4 * (pe / (R * Te)) * ce;
    }
    
    const mdotMax = A2 * 1e-4 * rho0 * c0 * G1(k);
    const choked = pb <= pcr;
    const A1 = 6 * A2;

    const pxPoints: [number, number][] = [];
    const maPoints: [number, number][] = [];
    
    for (let i = 0; i <= NPROF; i++) {
      const x = L * i / NPROF;
      const A = geomConv(x, A1, A2);
      const Ma = choked ? machFromArea(A / A2, k, 'sub') : machFromFlux(mdot / (A * 1e-4 * rho0 * c0), k);
      pxPoints.push([x, MachToP(Ma, k)]);
      maPoints.push([x, Ma]);
    }

    const states = [
      {
        label: '0 滞止状态',
        values: [
          { label: 'p', value: p0, unit: 'kPa' },
          { label: 'T', value: T0, unit: 'K' },
          { label: 'Ma', value: 0, unit: '' },
          { label: 'c', value: 0, unit: 'm/s' }
        ]
      },
      {
        label: '2 出口',
        values: [
          { label: 'p', value: pe, unit: 'kPa' },
          { label: 'T', value: Te, unit: 'K' },
          { label: 'Ma', value: Mae, unit: '' },
          { label: 'c', value: ce, unit: 'm/s' }
        ]
      }
    ];

    return {
      charts: [
        {
          id: 'px', title: '沿程压力分布', xLabel: 'x (cm)', yLabel: 'p/p₀',
          series: [{ name: '压力比', points: pxPoints, color: '#2a78d6' }]
        },
        {
          id: 'ma', title: '沿程马赫数', xLabel: 'x (cm)', yLabel: 'Ma',
          series: [{ name: '马赫数', points: maPoints, color: '#e34948' }]
        }
      ],
      metrics: [
        { label: '出口流速 c₂', value: ce, unit: 'm/s', precision: 1 },
        { label: '出口马赫数 Ma₂', value: Mae, unit: '', precision: 3 },
        { label: '出口压力 p₂', value: pe, unit: 'kPa', precision: 1 },
        { label: '质量流量 ṁ', value: mdot, unit: 'kg/s', precision: 4 }
      ],
      states,
      notes: [`当前工况：${regime}`, `临界压比 β_cr = ${beta.toFixed(3)}`, `最大质量流量 = ${mdotMax.toFixed(4)} kg/s`]
    };
  }
}

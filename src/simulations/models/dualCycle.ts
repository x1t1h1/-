import type { SimulationModel, SimulationResult } from '../types'

const R = 0.287;
const cvOf = (k: number) => R / (k - 1);
const cpOf = (k: number) => k * cvOf(k);
const isen = (Ta: number, Pa: number, va: number, vb: number, k: number) => ({
  T: Ta * Math.pow(va / vb, k - 1),
  P: Pa * Math.pow(va / vb, k)
});

export const dualCycle: SimulationModel = {
  id: 'dual-cycle',
  name: '混合加热循环',
  shortName: '混合循环',
  description: '高速柴油机理想循环（定容+定压加热）。',
  category: '经典循环',
  icon: 'flask',
  accent: '#1baf7a',
  parameters: [
    { key: 'r', label: '压缩比 r', type: 'range', min: 8, max: 25, step: 0.1, default: 15 },
    { key: 'lam', label: '压力升高比 λ', type: 'range', min: 1.2, max: 3, step: 0.05, default: 1.8 },
    { key: 'rho', label: '预胀比 ρ', type: 'range', min: 1.2, max: 3, step: 0.05, default: 1.6 },
    { key: 'k', label: '比热比 k', type: 'range', min: 1.2, max: 1.67, step: 0.01, default: 1.4 },
    { key: 'T1', label: '初温 T₁', unit: 'K', type: 'range', min: 250, max: 400, step: 5, default: 300 }
  ],
  compute(values): SimulationResult {
    for (const parameter of dualCycle.parameters ?? []) {
      const value = values[parameter.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${parameter.label}必须是有效数字`);
      if ((parameter.min !== undefined && value < parameter.min) || (parameter.max !== undefined && value > parameter.max)) {
        throw new Error(`${parameter.label}必须在 ${parameter.min} 至 ${parameter.max} ${parameter.unit ?? ''}之间`);
      }
    }
    const { r, lam, rho, k, T1 } = values as Record<string, number>;
    const P1 = 100;
    const cv = cvOf(k), cp = cpOf(k), v1 = R * T1 / P1, v2 = v1 / r;
    const st2 = isen(T1, P1, v1, v2, k);
    const P3 = lam * st2.P, T3 = st2.T * lam;
    const T4 = T3 * rho, v4 = rho * v2, P4 = P3;
    const st5 = isen(T4, P4, v4, v1, k);
    const qin1 = cv * (T3 - st2.T), qin2 = cp * (T4 - T3);
    const qin = qin1 + qin2;
    const qout = cv * (st5.T - T1);
    const wnet = qin - qout;
    const eta = wnet / qin;
    const s3 = cv * Math.log(lam);
    const s4 = s3 + cp * Math.log(rho);

    const states = [
      { T: T1, P: P1, v: v1, s: 0 },
      { T: st2.T, P: st2.P, v: v2, s: 0 },
      { T: T3, P: P3, v: v2, s: s3 },
      { T: T4, P: P4, v: v4, s: s4 },
      { T: st5.T, P: st5.P, v: v1, s: s4 }
    ];

    const pvPoints: [number, number][][] = [];
    const tsPoints: [number, number][][] = [];
    const N = 30;
    for (let i = 0; i < 5; i++) {
      const a = states[i], b = states[(i + 1) % 5];
      const pvSeg: [number, number][] = [];
      const tsSeg: [number, number][] = [];
      for (let j = 0; j <= N; j++) {
        const t = j / N;
        if (i === 0 || i === 3) { // 等熵
          const v = a.v * Math.pow(b.v / a.v, t);
          pvSeg.push([v, a.P * Math.pow(a.v / v, k)]);
          tsSeg.push([a.s, a.T * Math.pow(b.T / a.T, t)]);
        } else if (i === 2) { // 等压
          const v = a.v + (b.v - a.v) * t;
          const T = a.T + (b.T - a.T) * t;
          pvSeg.push([v, a.P]);
          tsSeg.push([a.s + cp * Math.log(T / a.T), T]);
        } else { // 等容
          const T = a.T + (b.T - a.T) * t;
          pvSeg.push([a.v, a.P + (b.P - a.P) * t]);
          tsSeg.push([a.s + cv * Math.log(T / a.T), T]);
        }
      }
      pvPoints.push(pvSeg);
      tsPoints.push(tsSeg);
    }

    return {
      charts: [
        {
          id: 'pv', title: 'p-v 图', xLabel: 'v (m³/kg)', yLabel: 'p (kPa)',
          series: [
            { name: '等熵压缩', points: pvPoints[0], color: '#2a78d6' },
            { name: '等容加热', points: pvPoints[1], color: '#e34948' },
            { name: '等压加热', points: pvPoints[2], color: '#1baf7a' },
            { name: '等熵膨胀', points: pvPoints[3], color: '#2a78d6' },
            { name: '等容放热', points: pvPoints[4], color: '#e34948' }
          ]
        },
        {
          id: 'ts', title: 'T-s 图', xLabel: 's (kJ/(kg·K))', yLabel: 'T (K)',
          series: [
            { name: '等熵压缩', points: tsPoints[0], color: '#2a78d6' },
            { name: '等容加热', points: tsPoints[1], color: '#e34948' },
            { name: '等压加热', points: tsPoints[2], color: '#1baf7a' },
            { name: '等熵膨胀', points: tsPoints[3], color: '#2a78d6' },
            { name: '等容放热', points: tsPoints[4], color: '#e34948' }
          ]
        }
      ],
      metrics: [
        { label: '热效率 η', value: eta * 100, unit: '%', precision: 1 },
        { label: '净功 W_net', value: wnet, unit: 'kJ/kg', precision: 1 },
        { label: '吸热量 q_in', value: qin, unit: 'kJ/kg', precision: 1 }
      ],
      states: states.map((s, i) => ({
        label: `状态 ${i + 1}`,
        values: [
          { label: 'T', value: s.T, unit: 'K' },
          { label: 'p', value: s.P, unit: 'kPa' },
          { label: 'v', value: s.v, unit: 'm³/kg' }
        ]
      }))
    };
  }
}

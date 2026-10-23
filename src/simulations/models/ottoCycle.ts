import type { SimulationModel, SimulationResult } from '../types'

const R = 0.287;
const cvOf = (k: number) => R / (k - 1);
const isen = (Ta: number, Pa: number, va: number, vb: number, k: number) => ({
  T: Ta * Math.pow(va / vb, k - 1),
  P: Pa * Math.pow(va / vb, k)
});

export const ottoCycle: SimulationModel = {
  id: 'otto-cycle',
  name: '奥托循环（定容加热）',
  shortName: '奥托循环',
  description: '汽油机理想循环。研究压缩比 r、加热量 q_in 对热效率与净功的影响。',
  category: '经典循环',
  icon: 'flask',
  accent: '#2a78d6',
  parameters: [
    { key: 'r', label: '压缩比 r', type: 'range', min: 3, max: 20, step: 0.1, default: 8 },
    { key: 'qin', label: '加热量 q_in', unit: 'kJ/kg', type: 'range', min: 300, max: 2000, step: 10, default: 750 },
    { key: 'k', label: '比热比 k', type: 'range', min: 1.2, max: 1.67, step: 0.01, default: 1.4 },
    { key: 'T1', label: '初温 T₁', unit: 'K', type: 'range', min: 250, max: 400, step: 5, default: 300 }
  ],
  compute(values): SimulationResult {
    const { r, k, T1, qin } = values as Record<string, number>;
    const P1 = 100; // 固定 100 kPa
    const cv = cvOf(k), v1 = R * T1 / P1, v2 = v1 / r;
    const st2 = isen(T1, P1, v1, v2, k);
    const T3 = st2.T + qin / cv;
    const P3 = st2.P * (T3 / st2.T);
    const st4 = isen(T3, P3, v2, v1, k);
    const qout = cv * (st4.T - T1);
    const wnet = qin - qout;
    const eta = wnet / qin;
    const s3 = cv * Math.log(T3 / st2.T);

    const states = [
      { T: T1, P: P1, v: v1, s: 0 },
      { T: st2.T, P: st2.P, v: v2, s: 0 },
      { T: T3, P: P3, v: v2, s: s3 },
      { T: st4.T, P: st4.P, v: v1, s: s3 }
    ];

    // 生成 p-v 和 T-s 曲线点 (细分每个过程以生成平滑曲线)
    const pvPoints: [number, number][][] = [];
    const tsPoints: [number, number][][] = [];
    const N = 30;
    for (let i = 0; i < 4; i++) {
      const a = states[i], b = states[(i + 1) % 4];
      const pvSeg: [number, number][] = [];
      const tsSeg: [number, number][] = [];
      for (let j = 0; j <= N; j++) {
        const t = j / N;
        if (i === 0 || i === 2) { // 等熵
          const v = a.v * Math.pow(b.v / a.v, t);
          const P = a.P * Math.pow(a.v / v, k);
          const T = a.T * Math.pow(b.T / a.T, t);
          pvSeg.push([v, P]);
          tsSeg.push([a.s, T]);
        } else { // 等容
          const P = a.P + (b.P - a.P) * t;
          const T = a.T + (b.T - a.T) * t;
          const s = a.s + (b.s - a.s) * t;
          pvSeg.push([a.v, P]);
          tsSeg.push([s, T]);
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
            { name: '等熵膨胀', points: pvPoints[2], color: '#2a78d6' },
            { name: '等容放热', points: pvPoints[3], color: '#1baf7a' }
          ]
        },
        {
          id: 'ts', title: 'T-s 图', xLabel: 's (kJ/(kg·K))', yLabel: 'T (K)',
          series: [
            { name: '等熵压缩', points: tsPoints[0], color: '#2a78d6' },
            { name: '等容加热', points: tsPoints[1], color: '#e34948' },
            { name: '等熵膨胀', points: tsPoints[2], color: '#2a78d6' },
            { name: '等容放热', points: tsPoints[3], color: '#1baf7a' }
          ]
        }
      ],
      metrics: [
        { label: '热效率 η', value: eta * 100, unit: '%', precision: 1 },
        { label: '净功 W_net', value: wnet, unit: 'kJ/kg', precision: 1 },
        { label: '吸热量 q_in', value: qin, unit: 'kJ/kg', precision: 1 },
        { label: '放热量 q_out', value: qout, unit: 'kJ/kg', precision: 1 }
      ],
      states: states.map((s, i) => ({
        label: `状态 ${i + 1}`,
        values: [
          { label: 'T', value: s.T, unit: 'K' },
          { label: 'p', value: s.P, unit: 'kPa' },
          { label: 'v', value: s.v, unit: 'm³/kg' }
        ]
      })),
      notes: [`理论热效率公式：η = 1 - 1/r^(k-1) = ${(1 - 1/Math.pow(r, k-1)).toFixed(4)}`]
    };
  }
}
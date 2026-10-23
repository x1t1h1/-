import type { SimulationModel, SimulationResult } from '../types'

// --- 核心数学公式 ---
const R = 0.287, RSI = 287, L = 30, NPROF = 60;
const c0Of = (T0: number, k: number) => Math.sqrt(k * RSI * T0);
const betaCr = (k: number) => Math.pow(2 / (k + 1), k / (k - 1));
const G1 = (k: number) => Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));
const MachToP = (Ma: number, k: number) => Math.pow(1 + (k - 1) / 2 * Ma * Ma, -k / (k - 1));
const MachToT = (Ma: number, k: number) => 1 / (1 + (k - 1) / 2 * Ma * Ma);
const MachFromPR = (pr: number, k: number) => Math.sqrt(2 / (k - 1) * (Math.pow(pr, -(k - 1) / k) - 1));
const areaMach = (Ma: number, k: number) => 1 / Ma * Math.pow((2 / (k + 1)) * (1 + (k - 1) / 2 * Ma * Ma), (k + 1) / (2 * (k - 1)));
const fluxG = (Ma: number, k: number) => Ma * Math.pow(1 + (k - 1) / 2 * Ma * Ma, -(k + 1) / (2 * (k - 1)));
const geomLaval = (x: number, A1: number, At: number, A2: number) => {
  if (x <= L / 2) return A1 - (A1 - At) * (1 - Math.cos(Math.PI * x / (L / 2))) / 2;
  return At + (A2 - At) * (1 - Math.cos(Math.PI * (x - L / 2) / (L / 2))) / 2;
};

function machFromArea(AR: number, k: number, branch: 'sub' | 'sup') {
  let lo = branch === 'sup' ? 1 : 1e-9, hi = branch === 'sup' ? 40 : 1;
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

function shock(Ma1: number, k: number) {
  const m2 = (k - 1) * Ma1 * Ma1 + 2, d = 2 * k * Ma1 * Ma1 - (k - 1);
  return { Ma2: Math.sqrt(m2 / d), p2p1: d / (k + 1), T2T1: (1 + (k - 1) / 2 * Ma1 * Ma1) * d / ((k + 1) * (k + 1) / 2 * Ma1 * Ma1), p02p01: Math.pow((k + 1) * Ma1 * Ma1 / (2 + (k - 1) * Ma1 * Ma1), k / (k - 1)) * Math.pow((k + 1) / d, 1 / (k - 1)) };
}

function bisect(f: (x: number) => number, lo: number, hi: number, n: number) {
  let flo = f(lo);
  for (let i = 0; i < n; i++) {
    const m = (lo + hi) / 2, fm = f(m);
    if (!isFinite(fm)) { hi = m; continue; }
    if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; }
  }
  return (lo + hi) / 2;
}

function shockXAt(Ma1: number, At: number, AR: number, k: number) {
  const A1 = 6 * At, A2 = At * AR;
  let lo = L / 2, hi = L;
  for (let i = 0; i < 80; i++) {
    const xm = (lo + hi) / 2;
    const Ma = machFromArea(geomLaval(xm, A1, At, A2) / At, k, 'sup');
    if (Ma < Ma1) lo = xm; else hi = xm;
  }
  return (lo + hi) / 2;
}

export const lavalNozzle: SimulationModel = {
  id: 'laval-nozzle',
  name: '拉伐尔喷管仿真实验',
  shortName: '拉伐尔喷管',
  description: '渐缩渐扩通道。观察喉部壅塞后超音速膨胀、管内正激波位置随背压的移动。',
  category: '基础过程',
  icon: 'flask',
  accent: '#e34948',
  parameters: [
    { key: 'p0', label: '滞止压力 p₀', unit: 'kPa', type: 'range', min: 200, max: 1200, step: 10, default: 500 },
    { key: 'T0', label: '滞止温度 T₀', unit: 'K', type: 'range', min: 280, max: 600, step: 5, default: 300 },
    { key: 'pb', label: '背压 pb', unit: 'kPa', type: 'range', min: 10, max: 1200, step: 5, default: 350, help: '需小于滞止压力' },
    { key: 'At', label: '喉部面积 Aₜ', unit: 'cm²', type: 'range', min: 1, max: 10, step: 0.5, default: 4 },
    { key: 'AR', label: '面积比 A₂/Aₜ', type: 'range', min: 1.5, max: 4, step: 0.05, default: 2.5 },
    { key: 'k', label: '比热比 k', type: 'range', min: 1.2, max: 1.67, step: 0.01, default: 1.4 }
  ],
  compute(values): SimulationResult {
    for (const parameter of lavalNozzle.parameters ?? []) {
      const value = values[parameter.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${parameter.label}必须是有效数字`);
      if ((parameter.min !== undefined && value < parameter.min) || (parameter.max !== undefined && value > parameter.max)) {
        throw new Error(`${parameter.label}必须在 ${parameter.min} 至 ${parameter.max} ${parameter.unit ?? ''}之间`);
      }
    }
    const { p0, T0, pb, At, AR, k } = values as Record<string, number>;
    if (pb >= p0) throw new Error('背压必须小于滞止压力');

    const A2 = At * AR;
    const c0 = c0Of(T0, k);
    const rho0 = p0 / (R * T0);
    const beta = betaCr(k);
    const pcr = p0 * beta;
    
    const MaDes = machFromArea(AR, k, 'sup');
    const MaII = machFromArea(AR, k, 'sub');
    const pDes = p0 * MachToP(MaDes, k);
    const pII = p0 * MachToP(MaII, k);
    const pShockExit = pDes * shock(MaDes, k).p2p1;
    const mdotMax = At * 1e-4 * rho0 * c0 * G1(k);
    
    let regime = '', pe = 0, Mae = 0, Te = 0, ce = 0, mdot = 0;
    let shockX: number | null = null, Ma1: number | null = null, p02p01: number | null = null;
    let shockPre = null, shockPost = null;

    if (pb >= pII) {
      regime = pb > pII ? '亚临界工况' : '临界工况';
      pe = pb;
      Mae = MachFromPR(pe / p0, k);
      Te = T0 * MachToT(Mae, k);
      ce = Mae * Math.sqrt(k * RSI * Te);
      mdot = A2 * 1e-4 * (pe / (R * Te)) * ce;
    } else if (pb > pDes) {
      pe = pb;
      mdot = mdotMax;
      if (pb >= pShockExit) {
        regime = '管内正激波工况';
        const f = (m1: number) => {
          const q = shock(m1, k).p02p01;
          const pr = pb / (p0 * q);
          if (pr >= 1) return Infinity;
          return areaMach(MachFromPR(pr, k), k) - AR * q;
        };
        const lo = 1 + 1e-9, hi = MaDes - 1e-12;
        Ma1 = f(lo) * f(hi) <= 0 ? bisect(f, lo, hi, 140) : MaDes;
        const sh = shock(Ma1, k);
        p02p01 = sh.p02p01;
        Mae = MachFromPR(pb / (p0 * p02p01), k);
        Te = T0 * MachToT(Mae, k);
        ce = Mae * Math.sqrt(k * RSI * Te);
        shockX = shockXAt(Ma1, At, AR, k);
        const As = geomLaval(shockX, 6 * At, At, A2);
        const pBefore = p0 * MachToP(Ma1, k);
        const TBefore = T0 * MachToT(Ma1, k);
        shockPre = { p: pBefore, T: TBefore, Ma: Ma1 };
        shockPost = { p: pBefore * sh.p2p1, T: TBefore * sh.T2T1, Ma: sh.Ma2 };
      } else {
        regime = '过度膨胀工况';
        Mae = MaDes;
        Te = T0 * MachToT(Mae, k);
        ce = Mae * Math.sqrt(k * RSI * Te);
        pe = pDes;
      }
    } else {
      regime = pb < pDes ? '欠膨胀工况' : '设计工况';
      pe = pDes;
      Mae = MaDes;
      Te = T0 * MachToT(Mae, k);
      ce = Mae * Math.sqrt(k * RSI * Te);
      mdot = mdotMax;
    }

    const choked = pb < pII;
    const A1 = 6 * At;
    const pxPoints: [number, number][] = [];
    const maPoints: [number, number][] = [];
    
    for (let i = 0; i <= NPROF; i++) {
      const x = L * i / NPROF;
      const A = geomLaval(x, A1, At, A2);
      let Ma, pEff = p0;
      
      if (choked) {
        if (x <= L / 2) Ma = machFromArea(A / At, k, 'sub');
        else if (shockX === null || x < shockX) Ma = machFromArea(A / At, k, 'sup');
        else {
          Ma = machFromFlux(mdot / (A * 1e-4 * rho0 * c0 * (p02p01 || 1)), k);
          pEff = p0 * (p02p01 || 1);
        }
      } else {
        Ma = machFromFlux(mdot / (A * 1e-4 * rho0 * c0), k);
      }
      
      if (choked && shockX !== null && i > 0 && pxPoints[pxPoints.length-1][0] < shockX && x >= shockX) {
        // 激波前静压由上游总压求得，跳变后再应用正激波静压比。
        const pBeforeRatio = MachToP(Ma1!, k);
        pxPoints.push([shockX, pBeforeRatio]);
        pxPoints.push([shockX, pBeforeRatio * shock(Ma1!, k).p2p1]);
        maPoints.push([shockX, Ma1!]);
        maPoints.push([shockX, shock(Ma1!, k).Ma2]);
      }
      
      pxPoints.push([x, (pEff * MachToP(Ma, k)) / p0]);
      maPoints.push([x, Ma]);
    }

    const states = [
      {
        label: '0 滞止状态',
        values: [{ label: 'p', value: p0, unit: 'kPa' }, { label: 'T', value: T0, unit: 'K' }, { label: 'Ma', value: 0, unit: '' }]
      }
    ];
    if (shockPre && shockPost) {
      states.push({
        label: 's₁ 激波前',
        values: [{ label: 'p', value: shockPre.p, unit: 'kPa' }, { label: 'T', value: shockPre.T, unit: 'K' }, { label: 'Ma', value: shockPre.Ma, unit: '' }]
      });
      states.push({
        label: 's₂ 激波后',
        values: [{ label: 'p', value: shockPost.p, unit: 'kPa' }, { label: 'T', value: shockPost.T, unit: 'K' }, { label: 'Ma', value: shockPost.Ma, unit: '' }]
      });
    }
    states.push({
      label: '2 出口',
      values: [{ label: 'p', value: pe, unit: 'kPa' }, { label: 'T', value: Te, unit: 'K' }, { label: 'Ma', value: Mae, unit: '' }]
    });

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
      notes: [`当前工况：${regime}`, `设计压比 p_d/p₀ = ${(pDes / p0).toFixed(3)}`, `激波出管压比 p_s/p₀ = ${(pShockExit / p0).toFixed(3)}`]
    };
  }
}

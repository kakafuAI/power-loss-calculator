import { useState, useMemo } from 'react';
import { Slider, Typography, Row, Col, Statistic } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', purple: '#6C5CE7', red: '#D63031', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

export default function PowerFactorDiagram() {
  const [pf, setPf] = useState(0.85);
  const [vdc, setVdc] = useState(600);
  const [pOut, setPOut] = useState(30);

  const phi = Math.acos(pf);
  const efficiency = 0.96;
  const P_in = pOut / efficiency;
  const I_fund = (P_in * 1000) / (Math.sqrt(3) * vdc * pf);
  const I_pf1 = (P_in * 1000) / (Math.sqrt(3) * vdc * 1.0);
  const stressPct = ((I_fund / I_pf1 - 1) * 100);
  const S_app = (P_in * 1000) / pf;

  // Waveforms
  const n = 200;
  const vPts = useMemo(() => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 4 * Math.PI; return `${40 + (i / n) * 360},${110 - Math.sin(t) * 70}`;
  }).join(' '), []);
  const iPts = useMemo(() => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 4 * Math.PI; return `${40 + (i / n) * 360},${110 - Math.sin(t - phi) * 70}`;
  }).join(' '), [phi]);

  // Triangle: scale P (active), Q (reactive), S (apparent) to pixels
  const P_kw = pOut; // active output in kW
  const Q_kvar = P_kw * Math.tan(phi);
  const S_kva = P_kw / pf;
  const maxDim = Math.max(P_kw, Q_kvar, S_kva, 1);
  const sc = 160 / maxDim;
  const px = P_kw * sc, qy = Q_kvar * sc;
  const tx = 80, ty = 210;

  // S label position: midpoint of hypotenuse + perpendicular offset
  const sx_mid = tx + px / 2;
  const sy_mid = ty - qy / 2;
  const sLabelX = sx_mid - 10;
  const sLabelY = sy_mid - 14;

  return (
    <div>
      {/* Configurable parameters */}
      <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Text strong>功率因数 cos φ: {pf.toFixed(2)}</Text>
          <Slider min={0.1} max={1.0} step={0.05} value={pf} onChange={setPf} style={{ margin: 0 }} />
        </Col>
        <Col span={8}>
          <Text strong>直流母线 Vdc: {vdc}V</Text>
          <Slider min={200} max={1200} step={50} value={vdc} onChange={setVdc} style={{ margin: 0 }} />
        </Col>
        <Col span={8}>
          <Text strong>输出功率 P_out: {pOut}kW</Text>
          <Slider min={5} max={200} step={5} value={pOut} onChange={setPOut} style={{ margin: 0 }} />
        </Col>
      </Row>

      {/* Derived values */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Statistic title="I_fund (pf={pf.toFixed(2)})" value={`${I_fund.toFixed(1)}A`} valueStyle={{ fontSize: 18, color: C.red }} /></Col>
        <Col span={6}><Statistic title="I (pf=1.0)" value={`${I_pf1.toFixed(1)}A`} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={6}><Statistic title="电流增加" value={`+${stressPct.toFixed(0)}%`} valueStyle={{ fontSize: 18, color: C.red }} /></Col>
        <Col span={6}><Statistic title="视在功率" value={`${(S_app/1000).toFixed(1)}kVA`} valueStyle={{ fontSize: 18 }} /></Col>
      </Row>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Waveforms */}
        <div style={{ flex: '1 1 380px', minWidth: 340, background: 'rgba(9,132,227,0.04)', borderRadius: 10, padding: 12 }}>
          <Text strong style={{ color: C.blue, fontSize: 14 }}>电压 · 电流波形</Text>
          <Text style={{ fontSize: 12, color: C.medium, marginLeft: 12 }}>φ = {(phi * 180 / Math.PI).toFixed(1)}°</Text>
          <svg viewBox="0 0 440 200" width="100%" style={{ maxWidth: 480 }}>
            <line x1={40} y1={110} x2={400} y2={110} stroke={C.light} strokeWidth={1} />
            <polyline points={vPts} fill="none" stroke={C.blue} strokeWidth={2.5} />
            <polyline points={iPts} fill="none" stroke={C.red} strokeWidth={2.5} strokeDasharray="6,3" />
            {phi > 0.15 && (
              <line x1={80} y1={35} x2={80 + phi / (4 * Math.PI) * 360} y2={35} stroke={C.medium} strokeWidth={1.5} markerEnd="url(#ar)" />
            )}
            <defs><marker id="ar" viewBox="0 0 10 10" refX={10} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill={C.medium} /></marker></defs>
            <text x={90 + phi / (4 * Math.PI) * 360} y={30} fontSize={12} fill={C.medium} fontWeight="bold">φ</text>
            <circle cx={380} cy={75} r={5} fill={C.blue} /><text x={390} y={79} fontSize={12} fill={C.blue} fontWeight="bold">v</text>
            <circle cx={380} cy={155} r={5} fill={C.red} /><text x={390} y={159} fontSize={12} fill={C.red} fontWeight="bold">i</text>
          </svg>
          <div style={{ fontSize: 11, color: C.medium }}>v(t) 与 i(t) 的相位差 φ 产生无功功率。pf 越低，电流越大。</div>
        </div>

        {/* Power triangle */}
        <div style={{ flex: '0 1 340px', minWidth: 300, background: 'rgba(108,92,231,0.04)', borderRadius: 10, padding: 12 }}>
          <Text strong style={{ color: C.purple, fontSize: 14 }}>功率三角形</Text>
          <Text style={{ fontSize: 11, color: C.medium, marginLeft: 8 }}>
            P={P_kw.toFixed(1)}kW &nbsp; Q={Q_kvar.toFixed(1)}kvar &nbsp; S={S_kva.toFixed(1)}kVA
          </Text>
          <svg viewBox="0 0 340 250" width="100%" style={{ maxWidth: 360 }}>
            {/* P (horizontal) */}
            <line x1={tx} y1={ty} x2={tx + px} y2={ty} stroke={C.blue} strokeWidth={5} strokeLinecap="round" />
            <text x={tx + px / 2} y={ty + 22} textAnchor="middle" fontSize={15} fontWeight="bold" fill={C.blue}>P={P_kw.toFixed(1)}kW</text>
            {/* Q (vertical up) */}
            <line x1={tx + px} y1={ty} x2={tx + px} y2={ty - qy} stroke={C.red} strokeWidth={5} strokeLinecap="round" />
            <text x={tx + px + 12} y={ty - qy / 2 + 4} fontSize={15} fontWeight="bold" fill={C.red}>Q={Q_kvar.toFixed(1)}</text>
            {/* S (hypotenuse) — label at midpoint with offset */}
            <line x1={tx} y1={ty} x2={tx + px} y2={ty - qy} stroke={C.orange} strokeWidth={5} strokeLinecap="round" />
            <text x={sLabelX} y={sLabelY} fontSize={15} fontWeight="bold" fill={C.orange} textAnchor="end">S={S_kva.toFixed(1)}kVA</text>
            {/* Right angle */}
            <path d={`M${tx + px - 10},${ty} L${tx + px - 10},${ty - 10} L${tx + px},${ty - 10}`}
              fill="none" stroke={C.medium} strokeWidth={1.5} />
            {/* φ arc */}
            <path d={`M${tx + 30},${ty} A30,30 0 0,0 ${tx + 30 * Math.cos(-phi)},${ty + 30 * Math.sin(-phi)}`}
              stroke={C.purple} strokeWidth={2.5} fill="none" />
            <text x={tx + 22} y={ty - 26} fontSize={13} fontWeight="bold" fill={C.purple}>φ</text>
          </svg>
          {/* Formula */}
          <div style={{ background: 'rgba(225,112,85,0.07)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(225,112,85,0.2)' }}>
            <Text style={{ fontSize: 12, color: C.orange, fontWeight: 'bold' }}>
              S² = P² + Q² &nbsp; | &nbsp; cos φ = P/S = {pf.toFixed(2)}
            </Text>
            <br /><Text style={{ fontSize: 11, color: C.red }}>
              I_fund = P / (√3·Vdc·cos φ) = {P_in.toFixed(1)}kW / (√3×{vdc}V×{pf.toFixed(2)}) = {I_fund.toFixed(1)}A
            </Text>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(108,92,231,0.05)', borderRadius: 8, padding: '10px 16px', marginTop: 12, border: '1px solid rgba(108,92,231,0.12)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Text strong style={{ color: C.purple, whiteSpace: 'nowrap', fontSize: 13 }}>关键结论</Text>
        <Text style={{ fontSize: 12, color: C.medium, lineHeight: 1.7 }}>
          cos φ 越低 → 无功功率 Q 越大 → 视在功率 S 增加 → 电流增大 (I ∝ 1/cos φ)。
          pf={pf.toFixed(2)} 时，I_fund = {I_fund.toFixed(1)}A，
          比 pf=1.0 时的 {I_pf1.toFixed(1)}A 增加 <strong style={{ color: C.red }}>+{stressPct.toFixed(0)}%</strong>，
          导通损耗增加约 <strong style={{ color: C.red }}>+{(stressPct*2).toFixed(0)}%</strong> (P ∝ I²)。
          提高功率因数可有效减小器件电流和导通损耗。
        </Text>
      </div>
    </div>
  );
}

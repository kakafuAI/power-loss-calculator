import { useState, useMemo } from 'react';
import { Slider, Typography, Table, Row, Col, Statistic, Tag } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', red: '#D63031', purple: '#6C5CE7', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

// ── Iteration solver ──────────────────────────────────────────────────
function vceAt(tj: number) { return 1.70 + (2.05 - 1.70) * (Math.max(25, Math.min(200, tj)) - 25) / 100; }
function solveIteration(tInit: number, tAmb: number, totalRth: number, baseLoss: number, th: number) {
  const r: any[] = []; let tjG = tInit;
  for (let i = 1; i <= 30; i++) {
    const vs = vceAt(tjG), pL = baseLoss * (vs / 1.70), tJ = tAmb + pL * totalRth, d = Math.abs(tJ - tjG);
    r.push({ iter: i, tjGuess: tjG, vceSat: vs, pLoss: pL, tJ, delta: d });
    if (d < th && i > 2) break;
    tjG = tjG * 0.7 + tJ * 0.3;
  } return r;
}

export default function ThermalNetworkDiagram() {
  const [pLoss, setPLoss] = useState(120);
  const [rthJc, setRthJc] = useState(0.24);
  const [rthCh, setRthCh] = useState(0.04);
  const [rthHa, setRthHa] = useState(0.30);
  const [tAmb] = useState(40);
  const [showIter, setShowIter] = useState(true);

  const totalRth = rthJc + rthCh + rthHa;
  // Cauer temperatures (bottom-up calculation)
  const dT_ha = pLoss * rthHa, dT_ch = pLoss * rthCh, dT_jc = pLoss * rthJc;
  const tAir = tAmb;
  const tHs = tAir + dT_ha;
  const tCase = tHs + dT_ch;
  const tJ = tCase + dT_jc;

  // Iteration
  const baseLossTotal = pLoss * 6;
  const iterations = useMemo(
    () => solveIteration(80, tAmb, totalRth, baseLossTotal, 0.5),
    [tAmb, totalRth, baseLossTotal]
  );
  const iterCount = iterations.length;
  const finalTj = iterCount > 0 ? iterations[iterCount - 1].tJ : tJ;
  const finalLoss = iterCount > 0 ? iterations[iterCount - 1].pLoss : baseLossTotal;
  const noIterTj = tAmb + baseLossTotal * totalRth;
  const iterDeviation = ((Math.abs(finalTj - noIterTj) / noIterTj) * 100);

  const convPts = iterations.map((it, i) =>
    `${45 + (i / Math.max(iterCount - 1, 1)) * 320},${200 - (it.delta / Math.max(it.delta, 5)) * 110}`
  ).join(' ');

  // Foster 4th-order parameters
  const fosterData = [
    { i: 1, r: (rthJc * 0.056).toFixed(4), tau: (rthJc * 0.056 * 1.5 * 0.001).toFixed(5), zone: '芯片' },
    { i: 2, r: (rthJc * 0.078).toFixed(4), tau: (rthJc * 0.078 * 6 * 0.001).toFixed(5), zone: '焊料+DBC' },
    { i: 3, r: (rthJc * 0.068).toFixed(4), tau: (rthJc * 0.068 * 40 * 0.001).toFixed(5), zone: '基板' },
    { i: 4, r: ((rthJc * 0.038 + rthCh + rthHa)).toFixed(4), tau: ((rthJc * 0.038 + rthCh + rthHa) * 2.0).toFixed(5), zone: '散热系统' },
  ];

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ marginBottom: 14, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><Text strong>P_loss: {pLoss}W</Text><Slider min={10} max={500} value={pLoss} onChange={setPLoss} style={{ width: 150 }} /></div>
        <div><Text strong>Rth_jc: {rthJc.toFixed(2)}</Text><Slider min={0.05} max={0.8} step={0.01} value={rthJc} onChange={setRthJc} style={{ width: 110 }} /></div>
        <div><Text strong>Rth_ch: {rthCh.toFixed(2)}</Text><Slider min={0.01} max={0.2} step={0.01} value={rthCh} onChange={setRthCh} style={{ width: 110 }} /></div>
        <div><Text strong>Rth_ha: {rthHa.toFixed(2)}</Text><Slider min={0.05} max={1.0} step={0.01} value={rthHa} onChange={setRthHa} style={{ width: 110 }} /></div>
        <Text style={{ fontSize: 13, color: C.red, fontWeight: 'bold' }}>
          ΣRth={totalRth.toFixed(2)} · Tj={tAmb}+{pLoss}×{totalRth.toFixed(2)}={tJ.toFixed(1)}°C
        </Text>
      </div>

      {/* ── Physical stack diagram ── */}
      <div style={{ background: '#F8F9FA', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <Text strong style={{ fontSize: 14 }}>热传导物理路径</Text>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { name: '芯片\nJunction', h: 60, t: tJ, color: C.red },
            { name: '焊料+DBC\n(Rth_jc)', h: 48, t: tCase + dT_jc * 0.35, color: '#E17055' },
            { name: '基板\nCase', h: 42, t: tCase, color: '#FAB1A0' },
            { name: '硅脂\n(Rth_ch)', h: 32, t: tCase - dT_ch * 0.5, color: C.green },
            { name: '散热器\n(Rth_ha)', h: 52, t: tHs, color: C.blue },
            { name: '空气\nAmbient', h: 30, t: tAir, color: C.light },
          ].map((l, i) => {
            const ratio = (l.t - tAir) / Math.max(tJ - tAir, 1);
            const r = Math.round(255), g = Math.round(255 * (1 - ratio) * 0.7 + 50), b = Math.round(255 * (1 - ratio) + 50 * ratio);
            return (
              <div key={i} style={{ flex: '1 1 60px', minWidth: 70, textAlign: 'center' }}>
                <div style={{ height: l.h, background: `rgb(${r},${g},${b})`, borderRadius: 6,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(0,0,0,0.1)', minWidth: 60 }}>
                  <Text style={{ fontSize: 11, color: ratio > 0.5 ? '#fff' : C.dark, fontWeight: 'bold', whiteSpace: 'pre-line', textAlign: 'center' }}>
                    {l.name}
                  </Text>
                </div>
                <Text style={{ fontSize: 12, color: C.dark, fontWeight: 'bold', marginTop: 4 }}>{l.t.toFixed(0)}°C</Text>
                {i < 5 && <Text style={{ fontSize: 9, color: C.medium }}>↓ P×Rth</Text>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 20, fontSize: 12, color: C.medium }}>
          <span><strong style={{ color: C.red }}>ΔT_jc</strong> = {pLoss}×{rthJc.toFixed(2)} = {dT_jc.toFixed(1)}°C</span>
          <span><strong style={{ color: C.green }}>ΔT_ch</strong> = {pLoss}×{rthCh.toFixed(2)} = {dT_ch.toFixed(1)}°C</span>
          <span><strong style={{ color: C.blue }}>ΔT_ha</strong> = {pLoss}×{rthHa.toFixed(2)} = {dT_ha.toFixed(1)}°C</span>
          <span>→ <strong>Tj = {tJ.toFixed(1)}°C</strong></span>
        </div>
      </div>

      {/* ── Cauer vs Foster comparison ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        {/* Cauer */}
        <div style={{ flex: '1 1 0', minWidth: 300, background: '#F8F9FA', borderRadius: 10, padding: 14 }}>
          <Text strong style={{ fontSize: 14, color: C.purple }}>Cauer 网络 (T型)</Text>
          <Text style={{ fontSize: 10, color: C.medium, marginLeft: 8 }}>节点=物理层温度</Text>
          <svg viewBox="0 0 500 260" width="100%" style={{ maxWidth: 500 }}>
            <circle cx={25} cy={25} r={10} fill="none" stroke={C.red} strokeWidth={2.5} />
            <text x={25} y={30} textAnchor="middle" fontSize={10} fill={C.red} fontWeight="bold">P</text>
            <line x1={35} y1={25} x2={55} y2={25} stroke={C.red} strokeWidth={2.5} />
            {[
              { r: rthJc * 0.4,  c: '0.01', t: {tj: tJ, label: '芯片'}, color: C.red },
              { r: rthJc * 0.35, c: '0.05', t: {tj: tCase + dT_jc * 0.35, label: '焊料+DBC'}, color: '#E17055' },
              { r: rthJc * 0.25, c: '0.2',  t: {tj: tCase, label: '基板(Case)'}, color: '#FAB1A0' },
              { r: rthCh,        c: '0.5',  t: {tj: tCase - dT_ch * 0.5, label: '硅脂'}, color: C.green },
              { r: rthHa,        c: '2.0',  t: {tj: tHs, label: '散热器'}, color: C.blue },
            ].map((l, i) => {
              const y = 20 + i * 44;
              const nx = 55 + i * 75 + 60; // node center x
              return (
                <g key={i}>
                  <line x1={55 + i * 75} y1={y} x2={55 + i * 75 + 60} y2={y} stroke={C.dark} strokeWidth={2} />
                  <text x={55 + i * 75 + 30} y={y - 8} textAnchor="middle" fontSize={10} fill={C.blue} fontWeight="bold">R={l.r.toFixed(2)}</text>
                  <line x1={nx} y1={y} x2={nx} y2={y + 30} stroke={C.medium} strokeWidth={1.5} />
                  <rect x={nx - 9} y={y + 30} width={18} height={20} rx={3} fill="rgba(225,112,85,0.08)" stroke={C.orange} strokeWidth={1.5} />
                  <text x={nx} y={y + 44} textAnchor="middle" fontSize={8} fill={C.orange} fontWeight="bold">C{i + 1}</text>
                  <line x1={nx} y1={y + 50} x2={nx} y2={y + 56} stroke={C.medium} strokeWidth={1.5} />
                  <line x1={nx - 10} y1={y + 56} x2={nx + 10} y2={y + 56} stroke={C.medium} strokeWidth={1.5} />
                  <circle cx={nx} cy={y} r={7} fill={l.color} />
                  <text x={nx + 16} y={y + 4} fontSize={11} fill={C.dark} fontWeight="bold">{l.t.label}: {l.t.tj.toFixed(0)}°C</text>
                </g>
              );
            })}
            {/* Ambient at end */}
            <line x1={55 + 4 * 75 + 60} y1={240} x2={55 + 4 * 75 + 60} y2={252} stroke={C.medium} strokeWidth={2} />
            <line x1={55 + 4 * 75 + 50} y1={252} x2={55 + 4 * 75 + 70} y2={252} stroke={C.medium} strokeWidth={2} />
            <text x={55 + 4 * 75 + 60 + 16} y={254} fontSize={11} fill={C.dark}>空气: {tAir}°C</text>
          </svg>
        </div>

        {/* Foster */}
        <div style={{ flex: '1 1 0', minWidth: 300, background: '#F8F9FA', borderRadius: 10, padding: 14 }}>
          <Text strong style={{ fontSize: 14, color: C.blue }}>Foster 网络 (π型)</Text>
          <Text style={{ fontSize: 10, color: C.medium, marginLeft: 8 }}>节点无物理含义，数据手册标准</Text>
          <svg viewBox="0 0 440 120" width="100%" style={{ maxWidth: 440 }}>
            <circle cx={20} cy={25} r={9} fill="none" stroke={C.red} strokeWidth={2.5} />
            <text x={20} y={30} textAnchor="middle" fontSize={10} fill={C.red} fontWeight="bold">P</text>
            <line x1={29} y1={25} x2={50} y2={25} stroke={C.red} strokeWidth={2.5} />
            {fosterData.map((f, i) => {
              const x = 50 + i * 85;
              return (
                <g key={i}>
                  <line x1={x} y1={25} x2={x + 32} y2={25} stroke={C.dark} strokeWidth={2} />
                  <rect x={x + 9} y={10} width={14} height={30} rx={3} fill="rgba(9,132,227,0.08)" stroke={C.blue} strokeWidth={1.5} />
                  <text x={x + 16} y={28} textAnchor="middle" fontSize={9} fill={C.blue} fontWeight="bold">R{i + 1}</text>
                  <line x1={x + 32} y1={25} x2={x + 32} y2={70} stroke={C.medium} strokeWidth={1.5} />
                  <rect x={x + 23} y={60} width={18} height={22} rx={3} fill="rgba(225,112,85,0.06)" stroke={C.orange} strokeWidth={1.5} />
                  <text x={x + 32} y={74} textAnchor="middle" fontSize={9} fill={C.orange} fontWeight="bold">C{i + 1}</text>
                  <line x1={x + 32} y1={82} x2={x + 32} y2={92} stroke={C.medium} strokeWidth={1.5} />
                  <line x1={x + 22} y1={92} x2={x + 42} y2={92} stroke={C.medium} strokeWidth={1.5} />
                </g>
              );
            })}
            <line x1={45} y1={92} x2={420} y2={92} stroke={C.medium} strokeWidth={1.5} />
            <text x={424} y={97} fontSize={9} fill={C.medium}>GND(Tamb)</text>
            <circle cx={50} cy={25} r={5} fill={C.red} />
          </svg>
          <Table dataSource={fosterData.map((f, i) => ({ ...f, key: i }))} size="small" pagination={false}
            columns={[{ title: '#', dataIndex: 'i', width: 28 }, { title: 'rᵢ(K/W)', dataIndex: 'r', width: 80 }, { title: 'τᵢ(s)', dataIndex: 'tau', width: 80 }, { title: '对应层', dataIndex: 'zone', width: 80 }]}
            style={{ marginTop: 6 }} />
          <Text style={{ fontSize: 11, color: C.red }}>Σ rᵢ = {fosterData.reduce((s, f) => s + parseFloat(f.r), 0).toFixed(4)} K/W ≈ Rth_jc+Rth_ch+Rth_ha = {totalRth.toFixed(2)}</Text>
        </div>
      </div>


      {/* ── Iteration Section ── */}
      <div style={{ background: '#F8F9FA', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setShowIter(!showIter)}>
          <div>
            <Text strong style={{ fontSize: 14, color: C.orange }}>{showIter ? '▼' : '▶'} 迭代求解—求解上述热网络的稳态工作点</Text>
            <Text style={{ fontSize: 11, color: C.medium, marginLeft: 12 }}>
              使用参数: Rth_jc={rthJc.toFixed(2)} + Rth_ch={rthCh.toFixed(2)} + Rth_ha={rthHa.toFixed(2)} = {totalRth.toFixed(2)} K/W
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: C.medium }}>收敛于 {iterCount} 次</Text>
            <Tag color={finalTj > 150 ? 'red' : 'green'}>{finalTj.toFixed(1)}°C</Tag>
          </div>
        </div>

        {showIter && (
          <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 280px', minWidth: 240 }}>
              {/* Feedback loop */}
              <div style={{ background: 'rgba(225,112,85,0.06)', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid rgba(225,112,85,0.15)' }}>
                <Text strong style={{ color: C.orange, fontSize: 13 }}>求解 Cauer/Foster 网络的迭代过程</Text>
                <div style={{ fontSize: 12, color: C.medium, lineHeight: 1.8, marginTop: 4 }}>
                  <div>1. 猜测 Tj → 查 Vce(sat)@Tj <span style={{ color: C.orange }}>(Vce随Tj↑)</span></div>
                  <div>2. 计算 P = f(Vce(sat)) <span style={{ color: C.red }}>(Vce↑→P↑)</span></div>
                  <div>3. Tj_new = Tamb + P × <strong style={{ color: C.blue }}>ΣRth</strong> <span style={{ color: C.orange }}>(P↑→Tj↑)</span></div>
                  <div>4. Δ = |Tj_new—Tj_old|，若 Δ&gt;阈值→回1</div>
                  <div style={{ marginTop: 4, fontWeight: 'bold', color: C.orange }}>
                    迭代公式: Tj = Tamb + P_total × ({rthJc.toFixed(2)}+{rthCh.toFixed(2)}+{rthHa.toFixed(2)})
                  </div>
                </div>
              </div>

              {/* Before/after */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#FFF2E8', borderRadius: 8, padding: 10, border: '1px solid #FFBB96' }}>
                  <Text strong style={{ color: '#D4380D', fontSize: 12 }}>❌ 不迭代 (25°C参数)</Text>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    <div>Tj ≈ {noIterTj.toFixed(0)}°C</div>
                    <div>P ≈ {baseLossTotal.toFixed(0)}W</div>
                    <div style={{ fontSize: 10, color: '#D4380D', marginTop: 2 }}>▲ 未考虑Vce(sat)温升</div>
                  </div>
                </div>
                <div style={{ background: '#F6FFED', borderRadius: 8, padding: 10, border: '1px solid #B7EB8F' }}>
                  <Text strong style={{ color: '#389E0D', fontSize: 12 }}>✅ 迭代收敛</Text>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    <div>Tj = {finalTj.toFixed(1)}°C</div>
                    <div>P = {finalLoss.toFixed(0)}W (修正+{((finalLoss/baseLossTotal-1)*100).toFixed(1)}%)</div>
                    <div style={{ fontSize: 10, color: '#389E0D', marginTop: 2 }}>✓ {iterCount}次</div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: C.medium, marginTop: 8, background: '#FFFBE6', borderRadius: 6, padding: 8 }}>
                偏差 = {iterDeviation.toFixed(1)}% {iterDeviation > 5 ? <Text style={{ color: C.red }}>不迭代严重低估!</Text> : <Text style={{ color: C.green }}>SiC温漂小，偏差可接受</Text>}
              </div>
            </div>

            {/* Convergence curve */}
            <div style={{ flex: '1 1 300px', minWidth: 300 }}>
              <Text strong style={{ fontSize: 12, color: C.green }}>
                ΔTj 收敛曲线 (Rth_total={totalRth.toFixed(2)}K/W)
              </Text>
              <svg viewBox="0 0 400 240" width="100%" style={{ maxWidth: 440 }}>
                <line x1={45} y1={208} x2={380} y2={208} stroke={C.dark} strokeWidth={1} />
                <line x1={45} y1={30} x2={45} y2={208} stroke={C.dark} strokeWidth={1} />
                <text x={210} y={230} textAnchor="middle" fontSize={10} fill={C.medium}>迭代次数</text>
                <text x={18} y={120} textAnchor="middle" fontSize={10} fill={C.medium} transform="rotate(-90,18,120)">ΔTj(°C)</text>
                {convPts && <polyline points={convPts} fill="none" stroke={C.green} strokeWidth={2.5} />}
                {iterations.map((it, i) => {
                  const x = 45 + (i / Math.max(iterCount - 1, 1)) * 320;
                  const y = 208 - (it.delta / Math.max(it.delta, 5)) * 110;
                  const ok = it.delta < 0.5;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={5} fill={ok ? C.green : C.orange} stroke={ok ? C.green : C.orange} strokeWidth={1.5} />
                      {i === 0 && <text x={x - 14} y={y - 10} fontSize={9} fill={C.orange}>初始</text>}
                      {i === iterCount - 1 && <text x={x + 8} y={y - 10} fontSize={10} fill={C.green} fontWeight="bold">✓收敛</text>}
                    </g>
                  );
                })}
              </svg>
              <Row gutter={8} style={{ marginTop: 4 }}>
                <Col span={6}><Statistic title="迭代" value={iterCount} valueStyle={{ fontSize: 14 }} /></Col>
                <Col span={6}><Statistic title="收敛Tj" value={`${finalTj.toFixed(1)}°C`} valueStyle={{ fontSize: 14, color: C.green }} /></Col>
                <Col span={6}><Statistic title="Vce(sat)" value={`${iterations[iterCount-1]?.vceSat.toFixed(2) || '-'}V`} valueStyle={{ fontSize: 14 }} /></Col>
                <Col span={6}><Statistic title="修正" value={`+${((finalLoss/baseLossTotal-1)*100).toFixed(1)}%`} valueStyle={{ fontSize: 14, color: C.orange }} /></Col>
              </Row>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: 'rgba(108,92,231,0.05)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(108,92,231,0.12)' }}>
        <Text style={{ fontSize: 12, color: C.medium }}>
          Cauer 网络的每个节点对应真实物理层温度，而 Foster 网络的参数来自数据手册的 Zth 曲线拟合（节点没有物理含义）。
          但在稳态 (t→∞) 下两者都退化为 Tj = Tamb + P × ({rthJc.toFixed(2)} + {rthCh.toFixed(2)} + {rthHa.toFixed(2)}) = <strong style={{ color: C.red }}>{tJ.toFixed(1)}°C</strong>。
          {iterDeviation > 3 && <span> &nbsp; 考虑 Vce(sat) 温漂后迭代修正 <strong style={{ color: C.orange }}>{iterDeviation.toFixed(1)}%</strong>。</span>}
        </Text>
      </div>
    </div>
  );
}

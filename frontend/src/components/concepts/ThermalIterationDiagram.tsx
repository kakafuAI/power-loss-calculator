import { useState, useMemo, useEffect } from 'react';
import { Typography, Table, Tag, Slider, Row, Col, Statistic, Progress } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', purple: '#6C5CE7', red: '#D63031', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

function vceAt(tj: number) { return 1.70 + (2.05 - 1.70) * (Math.max(25, Math.min(200, tj)) - 25) / 100; }
function compute(tInit: number, tAmb: number, rth: number, base: number, th: number) {
  const r: any[] = []; let tjG = tInit;
  for (let i = 1; i <= 30; i++) {
    const vs = vceAt(tjG), pL = base * (vs / 1.70);
    const tH = tAmb + pL * rth * 0.65, tC = tH + pL * rth * 0.15, tJ = tC + pL * rth * 0.2;
    const d = Math.abs(tJ - tjG);
    r.push({ iter: i, tjGuess: tjG, vceSat: vs, pLoss: pL, tHeatsink: tH, tCase: tC, tjNew: tJ, delta: d });
    if (d < th && i > 2) break; tjG = tjG * 0.7 + tJ * 0.3;
  } return r;
}

export default function ThermalIterationDiagram() {
  const [tg, setTg] = useState(80); const [th, setTh] = useState(0.5);
  const [bl, setBl] = useState(750); const [rth, setRth] = useState(0.58);
  const [tAmb] = useState(40); const [anim, setAnim] = useState(0);
  const iters = useMemo(() => compute(tg, tAmb, rth, bl, th), [tg, tAmb, rth, bl, th]);
  const ic = iters.length; const ftj = ic > 0 ? iters[ic - 1].tjNew : tg;
  const fl = ic > 0 ? iters[ic - 1].pLoss : bl;

  useEffect(() => { if (ic === 0) return; let s = 0; const id = setInterval(() => { s++; if (s >= ic) clearInterval(id); else setAnim(s); }, 1200); setAnim(0); return () => clearInterval(id); }, [ic]);
  const disp = iters.slice(0, anim + 1);
  const pts = disp.map((it, i) => `${50 + (i / Math.max(ic - 1, 1)) * 320},${230 - (it.delta / Math.max(it.delta, th * 10)) * 130}`).join(' ');

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>热反馈循环：</Text>
        <Text style={{ fontSize: 13, color: C.medium }}>损耗 → 发热 → 升温 → 参数变化 → 损耗变化 → 温度变化... 闭环正反馈，必须迭代求解至收敛。</Text>
      </div>

      <Row gutter={10} style={{ marginBottom: 12 }}>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>初始Tj: {tg}°C</Text><Slider min={30} max={120} value={tg} onChange={setTg} style={{ margin: 0 }} /></Col>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>精度: {th.toFixed(2)}°C</Text><Slider min={0.01} max={3.0} step={0.01} value={th} onChange={setTh} style={{ margin: 0 }} /></Col>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>基准损耗: {bl}W</Text><Slider min={200} max={1500} value={bl} onChange={setBl} style={{ margin: 0 }} /></Col>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>总Rth: {rth}K/W</Text><Slider min={0.1} max={1.2} step={0.01} value={rth} onChange={setRth} style={{ margin: 0 }} /></Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={4}><Statistic title="迭代" value={`${ic}次`} valueStyle={{ fontSize: 16 }} /></Col>
        <Col span={4}><Statistic title="收敛Tj" value={`${ftj.toFixed(1)}°C`} valueStyle={{ fontSize: 16, color: ftj > 150 ? C.red : C.green }} /></Col>
        <Col span={4}><Statistic title="最终损耗" value={`${fl.toFixed(0)}W`} valueStyle={{ fontSize: 16 }} /></Col>
        <Col span={4}><Statistic title="修正" value={`${fl > bl ? '+' : ''}${((fl/bl-1)*100).toFixed(1)}%`} valueStyle={{ fontSize: 16, color: fl > bl * 1.05 ? C.red : C.blue }} /></Col>
        <Col span={4}><Progress type="circle" percent={Math.min(100, Math.round(anim / Math.max(ic - 1, 1) * 100))} size={44} format={() => `${anim + 1}/${ic}`} /></Col>
        <Col span={4}><Statistic title="无迭代Tj" value={`${(tAmb+bl*rth).toFixed(0)}°C`} valueStyle={{ fontSize: 14, color: C.orange }} /></Col>
      </Row>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Convergence SVG */}
        <div style={{ flex: '1 1 0', minWidth: 300, background: '#F8F9FA', borderRadius: 10, padding: 10 }}>
          <Text strong style={{ color: C.green, fontSize: 13 }}>ΔTj 收敛曲线 (动画: {anim + 1}/{ic})</Text>
          <svg viewBox="0 0 420 270" width="100%" style={{ maxWidth: 500, display: 'block', margin: '0 auto' }}>
            <line x1={50} y1={235} x2={390} y2={235} stroke={C.dark} strokeWidth={1} />
            <line x1={50} y1={45} x2={50} y2={235} stroke={C.dark} strokeWidth={1} />
            <text x={220} y={258} textAnchor="middle" fontSize={11} fill={C.medium}>迭代次数</text>
            <text x={18} y={140} textAnchor="middle" fontSize={11} fill={C.medium} transform="rotate(-90,18,140)">ΔTj (°C)</text>
            <line x1={50} y1={235 - th * 130 / (th * 10)} x2={390} y2={235 - th * 130 / (th * 10)} stroke={C.red} strokeWidth={1} strokeDasharray="5,3" />
            <text x={54} y={233 - th * 130 / (th * 10)} fontSize={9} fill={C.red}>阈值={th}°C</text>
            {pts && <polyline points={pts} fill="none" stroke={C.green} strokeWidth={2.5} />}
            {disp.map((it, i) => {
              const x = 50 + (i / Math.max(ic - 1, 1)) * 320;
              const y = 235 - (it.delta / Math.max(it.delta, th * 10)) * 130;
              const ok = it.delta < th;
              return <g key={i}><circle cx={x} cy={y} r={6} fill={ok ? C.green : C.orange} stroke={ok ? C.green : C.orange} strokeWidth={1.5} />{i === ic - 1 && <text x={x + 8} y={y - 10} fontSize={10} fill={C.green} fontWeight="bold">✓收敛</text>}</g>;
            })}
          </svg>
        </div>

        {/* Compare card */}
        <div style={{ flex: '1 1 0', minWidth: 230, background: 'rgba(0,184,148,0.05)', borderRadius: 10, padding: 14, border: '1px solid rgba(0,184,148,0.15)' }}>
          <Text strong style={{ color: C.green, fontSize: 13 }}>迭代重要性对比</Text>
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <div style={{ color: C.medium, marginBottom: 8 }}>
              <Text type="secondary">❌ 不迭代 (仅用25°C参数)</Text>
              <div style={{ fontWeight: 'bold', color: C.orange, fontSize: 14, marginTop: 2 }}>Tj ≈ {(tAmb + bl * rth).toFixed(0)}°C</div>
              <div style={{ fontSize: 11 }}>损耗 ≈ {bl}W</div>
              <div style={{ color: C.orange, fontSize: 10, marginTop: 2 }}>▲ 未考虑温度反馈→低估!</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(0,184,148,0.2)', paddingTop: 8 }}>
              <Text type="secondary">✅ 有迭代 (收敛)</Text>
              <div style={{ fontWeight: 'bold', color: C.green, fontSize: 14, marginTop: 2 }}>Tj ≈ {ftj.toFixed(1)}°C</div>
              <div style={{ fontSize: 11, color: C.green }}>损耗 ≈ {fl.toFixed(0)}W</div>
              <div style={{ color: C.green, fontSize: 10, marginTop: 2 }}>✓ {ic}次迭代后收敛</div>
            </div>
          </div>
        </div>
      </div>

      <Table dataSource={[...disp].reverse().map((r, i) => ({ ...r, key: i }))} size="small" pagination={false} scroll={{ y: 150 }}
        columns={[
          { title: '迭代', dataIndex: 'iter', width: 44 }, { title: 'Tj猜测', dataIndex: 'tjGuess', width: 60, render: (v: number) => `${v.toFixed(1)}°C` },
          { title: 'Vce(sat)', dataIndex: 'vceSat', width: 54, render: (v: number) => v.toFixed(2) },
          { title: '损耗', dataIndex: 'pLoss', width: 50, render: (v: number) => `${v.toFixed(0)}W` },
          { title: '壳温', dataIndex: 'tCase', width: 50, render: (v: number) => `${v.toFixed(0)}°C` },
          { title: '新Tj', dataIndex: 'tjNew', width: 60, render: (v: number) => `${v.toFixed(1)}°C` },
          { title: 'ΔTj', dataIndex: 'delta', width: 70, render: (v: number) => <Tag color={v < th ? 'green' : v < 5 ? 'orange' : 'red'}>{v < th ? '✓收敛' : `${v.toFixed(1)}°C`}</Tag> },
        ]} />

      <div style={{ background: 'rgba(108,92,231,0.05)', borderRadius: 8, padding: '10px 16px', marginTop: 10, border: '1px solid rgba(108,92,231,0.12)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Text strong style={{ color: C.purple, whiteSpace: 'nowrap', fontSize: 13 }}>热迭代要点</Text>
        <Text style={{ fontSize: 12, color: C.medium, lineHeight: 1.7 }}>
          Vce(sat)随温度升高而增大（正温度系数），形成<strong style={{ color: C.red }}>热正反馈</strong>。
          每次迭代用当前Tj重新计算损耗和结温，直至ΔTj {'<'} 阈值。
          不迭代（仅用25°C参数）会<strong style={{ color: C.red }}>严重低估结温和损耗</strong>（可能偏差10-20%）。
          <strong>SiC MOSFET 的 Rds(on) 温度系数远小于 IGBT 的 Vce(sat)</strong>。
        </Text>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import { Typography, Slider, Row, Col, Card, Tag, Statistic } from 'antd';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

// Layer definitions
const LAYERS = [
  { name: 'IGBT芯片', rth: 0, zone: 'Junction' },
  { name: '焊料', rth: 0.04, zone: 'Rth_jc' },
  { name: 'DBC陶瓷', rth: 0.08, zone: 'Rth_jc' },
  { name: '焊料', rth: 0.04, zone: 'Rth_jc' },
  { name: '基板', rth: 0.02, zone: 'Case' },
  { name: '硅脂', rth: 0.04, zone: 'Rth_ch' },
  { name: '散热器', rth: 0.30, zone: 'Rth_ha' },
  { name: '环境', rth: 0, zone: 'Ambient' },
];

// ═══════════════════════════════════════════════════════════════════════
export default function ThermalNetworkCompare() {
  const [pLoss, setPLoss] = useState(120);
  const [tAmb] = useState(40);

  // Calculate temperatures
  let t = tAmb;
  const layerTemps: number[] = [];
  for (const l of LAYERS) { t += pLoss * l.rth; layerTemps.push(t); }
  const tJ = layerTemps[0];
  const totalRth = LAYERS.reduce((s, l) => s + l.rth, 0);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: 8 }}>
      <Title level={4} style={{ marginBottom: 8 }}>热阻网络 — 四种方案对比</Title>

      <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
        <Col span={3}><Text strong style={{ fontSize: 12 }}>P_loss: {pLoss}W</Text></Col>
        <Col span={5}><Slider min={10} max={500} value={pLoss} onChange={setPLoss} /></Col>
        <Col span={3}><Statistic title="Tj" value={`${tJ.toFixed(1)}°C`} valueStyle={{ fontSize: 14, color: tJ > 150 ? '#D63031' : '#00B894' }} /></Col>
        <Col span={3}><Statistic title="ΔT" value={`${(tJ - tAmb).toFixed(1)}°C`} valueStyle={{ fontSize: 14 }} /></Col>
        <Col span={3}><Statistic title="ΣRth" value={`${totalRth.toFixed(2)} K/W`} valueStyle={{ fontSize: 14 }} /></Col>
        <Col span={3}><Statistic title="Tamb" value={`${tAmb}°C`} valueStyle={{ fontSize: 14 }} /></Col>
        <Col span={4}><Text style={{ fontSize: 11, color: '#999' }}>Tj = Tamb + P × ΣRth</Text></Col>
      </Row>

      <Row gutter={[8, 8]}>
        <Col span={12}><ApproachA pLoss={pLoss} tAmb={tAmb} layerTemps={layerTemps} totalRth={totalRth} tJ={tJ} /></Col>
        <Col span={12}><ApproachB pLoss={pLoss} tAmb={tAmb} layerTemps={layerTemps} totalRth={totalRth} tJ={tJ} /></Col>
        <Col span={12}><ApproachC pLoss={pLoss} tAmb={tAmb} layerTemps={layerTemps} totalRth={totalRth} tJ={tJ} /></Col>
        <Col span={12}><ApproachD pLoss={pLoss} tAmb={tAmb} layerTemps={layerTemps} totalRth={totalRth} tJ={tJ} /></Col>
      </Row>
    </div>
  );
}

interface ThProps { pLoss: number; tAmb: number; layerTemps: number[]; totalRth: number; tJ: number; }

// ═══════════ A: ECharts — heatmap + bar ═══════════
function ApproachA({ pLoss, tAmb, layerTemps, totalRth, tJ }: ThProps) {
  const tempMax = Math.max(...layerTemps);
  const opt = useMemo(() => ({
    title: { text: '热阻栈图', left: 'center', top: 2, textStyle: { fontSize: 12 } },
    grid: { left: 10, right: 10, top: 30, bottom: 30, height: 140 },
    xAxis: { type: 'value', name: '温度 (°C)', axisLabel: { fontSize: 9 }, nameTextStyle: { fontSize: 9 } },
    yAxis: { type: 'category', data: LAYERS.map(l => l.name).reverse(), axisLabel: { fontSize: 9 } },
    series: [{
      type: 'bar', data: LAYERS.map((l, i) => layerTemps[i]).reverse(),
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
        colorStops: [
          { offset: 0, color: '#0984E3' }, { offset: 0.4, color: '#6C5CE7' }, { offset: 0.7, color: '#E17055' }, { offset: 1, color: '#D63031' },
        ],
      }, borderRadius: [0, 4, 4, 0] },
      label: { show: true, formatter: (p: any) => `${p.value.toFixed(0)}°C`, fontSize: 9, position: 'right' },
    }],
    graphic: [
      { type: 'text', left: 'center', bottom: 4, style: { text: `Tj = ${tAmb} + ${pLoss}×${totalRth.toFixed(2)} = ${tJ.toFixed(1)}°C`, fill: '#D63031', fontSize: 11, fontWeight: 'bold' }, textAlign: 'center' },
    ],
  }), [pLoss, tAmb, layerTemps, totalRth, tJ]);

  return (
    <Card size="small" title={<><Tag color="blue">方案 A</Tag> ECharts 水平柱状图</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999' }}>柱状图 + 渐变色温度条 | 配置驱动</div>
      <ReactECharts option={opt} style={{ height: 220 }} />
    </Card>
  );
}

// ═══════════ B: React + small SVGs ═══════════
function ApproachB({ pLoss, tAmb, layerTemps, totalRth, tJ }: ThProps) {
  const maxT = Math.max(...layerTemps);
  return (
    <Card size="small" title={<><Tag color="green">方案 B</Tag> React + 独立 SVG + Grid</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>CSS Grid 布局，左侧堆栈图+右侧Foster网络</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Thermal stack */}
        <svg viewBox="0 0 180 220" width="50%">
          {LAYERS.map((l, i) => {
            const y = 8 + i * 26;
            const h = l.rth > 0 ? 22 : 14;
            const ratio = (layerTemps[i] - tAmb) / (maxT - tAmb);
            const r = Math.round(100 + ratio * 155);
            const g = Math.round(200 - ratio * 160);
            const b = Math.round(255 - ratio * 200);
            return (
              <g key={i}>
                <rect x={30} y={y} width={100} height={h} rx={3} fill={`rgb(${r},${g},${b})`} stroke="#ccc" strokeWidth={1} />
                <text x={80} y={y + h / 2 + 4} textAnchor="middle" fontSize={9} fill={ratio > 0.5 ? '#fff' : '#333'} fontWeight="bold">{l.name}</text>
                {l.rth > 0 && <text x={135} y={y + h / 2 + 4} fontSize={9} fill="#0984E3">{l.rth.toFixed(2)}</text>}
                <text x={160} y={y + h / 2 + 4} fontSize={9} fill="#333" fontWeight="bold">{layerTemps[i].toFixed(0)}°</text>
              </g>
            );
          })}
          <text x={10} y={216} fontSize={8} fill="#999">Rth (K/W) </text>
        </svg>

        {/* Foster + formula */}
        <div style={{ flex: 1 }}>
          <svg viewBox="0 0 200 100" width="100%">
            <text x={100} y={12} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#333">Foster RC</text>
            {[{ r: 0.06, c: 0.005 }, { r: 0.08, c: 0.02 }, { r: 0.06, c: 0.15 }, { r: 0.34, c: 0.8 }].map((p, i) => {
              const x = 15 + i * 45;
              return (
                <g key={i}>
                  <rect x={x} y={22} width={16} height={p.r * 80} rx={2} fill="#E6F4FF" stroke="#0984E3" strokeWidth={1} />
                  <text x={x + 8} y={18} textAnchor="middle" fontSize={7} fill="#0984E3">R{i+1}</text>
                  <line x1={x + 8} y1={22 + p.r * 80} x2={x + 8} y2={80} stroke="#ddd" strokeWidth={1} />
                  <rect x={x - 1} y={72} width={18} height={12} rx={2} fill="#FFF7E6" stroke="#E17055" strokeWidth={1} />
                  <text x={x + 8} y={81} textAnchor="middle" fontSize={6}>C{i+1}</text>
                </g>
              );
            })}
            <line x1={10} y1={80} x2={195} y2={80} stroke="#999" strokeWidth={1} />
            <text x={200} y={85} fontSize={8} fill="#666">Tamb</text>
          </svg>
          <div style={{ background: '#F6FFED', borderRadius: 6, padding: 6, marginTop: 4, border: '1px solid #B7EB8F' }}>
            <Text style={{ fontSize: 10, color: '#237804' }}>Tj = {tAmb} + {pLoss}×{totalRth.toFixed(2)} = <strong>{tJ.toFixed(1)}°C</strong></Text>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ═══════════ C: Canvas ═══════════
function ApproachC({ pLoss, tAmb, layerTemps, totalRth, tJ }: ThProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rc = c.getBoundingClientRect();
    c.width = rc.width * dpr; c.height = rc.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rc.width, H = rc.height;
    const maxT = Math.max(...layerTemps);
    const barX = 30, barW = W * 0.45, startY = 15;

    ctx.clearRect(0, 0, W, H);
    LAYERS.forEach((l, i) => {
      const y = startY + i * 24;
      const h = l.rth > 0 ? 20 : 12;
      const ratio = (layerTemps[i] - tAmb) / (maxT - tAmb);
      const r = Math.round(100 + ratio * 155);
      const g = Math.round(200 - ratio * 160);
      const b = Math.round(255 - ratio * 200);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(barX, y, barW, h);
      ctx.fillStyle = ratio > 0.5 ? '#fff' : '#333';
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(l.name, barX + barW / 2, y + h / 2 + 4);
      if (l.rth > 0) {
        ctx.fillStyle = '#0984E3'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`${l.rth.toFixed(2)}`, barX + barW + 6, y + h / 2 + 4);
      }
      ctx.fillStyle = '#333'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`${layerTemps[i].toFixed(0)}°C`, W - 6, y + h / 2 + 4);
    });

    // Formula
    ctx.fillStyle = '#D63031'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`Tj = ${tAmb} + ${pLoss}×${totalRth.toFixed(2)} = ${tJ.toFixed(1)}°C`, W / 2, H - 6);

    // Foster mini on right
    const fx = barX + barW + 60;
    [0.06, 0.08, 0.06, 0.34].forEach((rv, i) => {
      const x = fx + i * 22;
      ctx.fillStyle = '#E6F4FF'; ctx.strokeStyle = '#0984E3'; ctx.lineWidth = 1;
      ctx.fillRect(x, startY + 20 - rv * 40, 12, rv * 40);
      ctx.strokeRect(x, startY + 20 - rv * 40, 12, rv * 40);
      ctx.fillStyle = '#0984E3'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`R${i+1}`, x + 6, startY + 14 - rv * 40);
    });
  }, [pLoss, tAmb, layerTemps, totalRth, tJ]);

  return (
    <Card size="small" title={<><Tag color="orange">方案 C</Tag> 原生 Canvas</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999' }}>命令式逐层绘制 | 颜色渐变 + Foster 网络</div>
      <canvas ref={ref} style={{ width: '100%', height: 210, borderRadius: 6, background: '#F8F9FA' }} />
    </Card>
  );
}

// ═══════════ D: ECharts all-in-one ═══════════
function ApproachD({ pLoss, tAmb, layerTemps, totalRth, tJ }: ThProps) {
  const opt = useMemo(() => ({
    title: { text: '热阻全景', left: 'center', top: 2, textStyle: { fontSize: 12 } },
    series: [
      // Sankey-like bar for temperature rise
      { name: '温升', type: 'bar', data: LAYERS.map((l, i) => layerTemps[i] - tAmb).reverse(),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: '#0984E3' }, { offset: 0.5, color: '#6C5CE7' }, { offset: 1, color: '#D63031' }],
        }, borderRadius: [0, 4, 4, 0] },
        label: { show: true, formatter: (p: any) => `+${p.value.toFixed(1)}°C`, fontSize: 9 },
      },
      // Rth pie
      { name: '热阻占比', type: 'pie', center: ['75%', '65%'], radius: ['35%', '50%'],
        label: { formatter: '{b}', fontSize: 9 },
        data: [
          { value: LAYERS.slice(1, 5).reduce((s, l) => s + l.rth, 0), name: 'Rth_jc', itemStyle: { color: '#0984E3' } },
          { value: LAYERS[5].rth, name: 'Rth_ch', itemStyle: { color: '#6C5CE7' } },
          { value: LAYERS[6].rth, name: 'Rth_ha', itemStyle: { color: '#E17055' } },
        ],
      },
    ],
    xAxis: { type: 'value', name: '温升 (°C)', axisLabel: { fontSize: 9 } },
    yAxis: { type: 'category', data: LAYERS.map(l => l.name).reverse(), axisLabel: { fontSize: 9 } },
    grid: { left: 60, right: 110, top: 30, bottom: 40, height: 140 },
    graphic: [
      { type: 'text', left: 'center', bottom: 4, style: { text: `Tj = ${tAmb} + ${pLoss}×${totalRth.toFixed(2)} = ${tJ.toFixed(1)}°C`, fill: '#D63031', fontSize: 11, fontWeight: 'bold' }, textAlign: 'center' },
    ],
  }), [pLoss, tAmb, layerTemps, totalRth, tJ]);

  return (
    <Card size="small" title={<><Tag color="purple">方案 D</Tag> 全 ECharts (柱状+饼图)</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999' }}>柱状图温升 + 饼图热阻占比 | 全部数据驱动</div>
      <ReactECharts option={opt} style={{ height: 220 }} />
    </Card>
  );
}

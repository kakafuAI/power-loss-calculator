import { useState, useRef, useEffect, useMemo } from 'react';
import { Typography, Slider, Row, Col, Card, Tag, Statistic, Divider } from 'antd';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

// ═══════════════════════════════════════════════════════════════════════
// Shared state: all 4 approaches use the same data model
// ═══════════════════════════════════════════════════════════════════════

export default function ConceptDemoCompare() {
  const [pf, setPf] = useState(0.85);
  const phi = Math.acos(pf);
  const P = 85, S = 100, Q = S * Math.sin(phi);
  const stressPct = ((1 / pf - 1) * 100);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 16 }}>
      <Title level={3}>四种概念图解方案对比 Demo — 功率因数</Title>
      <Row gutter={12} align="middle" style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Text strong>功率因数 cos φ: {pf.toFixed(2)}</Text>
          <Slider min={0.1} max={1.0} step={0.05} value={pf} onChange={setPf} style={{ width: 200, display: 'inline-block', marginLeft: 12 }} />
        </Col>
        <Col span={4}><Statistic title="P" value={`${P}kW`} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={4}><Statistic title="Q" value={`${Q.toFixed(1)}kvar`} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={4}><Statistic title="S" value={`${S}kVA`} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={4}><Statistic title="I↑" value={`+${stressPct.toFixed(0)}%`} valueStyle={{ fontSize: 18, color: '#D63031' }} /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}><ApproachA pf={pf} phi={phi} P={P} Q={Q} S={S} /></Col>
        <Col span={12}><ApproachB pf={pf} phi={phi} P={P} Q={Q} S={S} /></Col>
        <Col span={12}><ApproachC pf={pf} phi={phi} P={P} Q={Q} S={S} /></Col>
        <Col span={12}><ApproachD pf={pf} phi={phi} P={P} Q={Q} S={S} /></Col>
      </Row>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// A: ECharts (line chart + custom graphic triangle)
// ═══════════════════════════════════════════════════════════════════════

function ApproachA({ pf, phi, P, Q, S }: { pf: number; phi: number; P: number; Q: number; S: number }) {
  const n = 200;
  const tData = Array.from({ length: n }, (_, i) => i / n * 4 * Math.PI);
  const vData = tData.map(t => Math.sin(t));
  const iData = tData.map(t => Math.sin(t - phi));

  const option = {
    title: { text: '电压·电流波形 + 功率三角形', left: 'center', top: 0, textStyle: { fontSize: 13 } },
    grid: { left: 50, right: 20, top: 40, bottom: 100, height: 140 },
    xAxis: { type: 'value', show: false, min: 0, max: 4 * Math.PI },
    yAxis: { type: 'value', show: false, min: -1.2, max: 1.2 },
    series: [
      { name: 'v(t)', type: 'line', data: tData.map((t, i) => [t, vData[i]]), smooth: true, lineStyle: { color: '#0984E3', width: 2.5 }, showSymbol: false },
      { name: 'i(t)', type: 'line', data: tData.map((t, i) => [t, iData[i]]), smooth: true, lineStyle: { color: '#D63031', width: 2.5, type: 'dashed' }, showSymbol: false },
    ],
    graphic: [
      // Power triangle — positioned below the chart
      { type: 'group', left: 180, top: 216,
        children: [
          { type: 'line', shape: { x1: 0, y1: 70, x2: P * 0.55, y2: 70 }, style: { stroke: '#0984E3', lineWidth: 4 } },
          { type: 'text', left: P * 0.275, top: 76, style: { text: `P=${P.toFixed(0)}kW`, fill: '#0984E3', fontSize: 13, fontWeight: 'bold' }, textAlign: 'center' },
          { type: 'line', shape: { x1: P * 0.55, y1: 70, x2: P * 0.55, y2: 70 - Q * 0.55 }, style: { stroke: '#D63031', lineWidth: 4 } },
          { type: 'text', left: P * 0.55 + 8, top: 70 - Q * 0.275, style: { text: `Q=${Q.toFixed(0)}`, fill: '#D63031', fontSize: 13, fontWeight: 'bold' } },
          { type: 'line', shape: { x1: 0, y1: 70, x2: P * 0.55, y2: 70 - Q * 0.55 }, style: { stroke: '#E17055', lineWidth: 4 } },
          { type: 'text', left: -40, top: 70 - Q * 0.275, style: { text: `S=${S.toFixed(0)}`, fill: '#E17055', fontSize: 13, fontWeight: 'bold' }, textAlign: 'right' },
        ],
      },
      // Formula
      { type: 'text', left: 'center', top: 290, style: { text: `S² = P² + Q² | cosφ = ${pf.toFixed(2)} | I↑ = ${((1/pf-1)*100).toFixed(0)}%`, fill: '#636E72', fontSize: 11 }, textAlign: 'center' },
    ],
  };

  return (
    <Card title={<><Tag color="blue">方案 A</Tag> ECharts 数据驱动</>} size="small" style={{ height: '100%' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>波形用 line series，三角形用 graphic 元素，tooltip 和动画内置 | 约 40 行配置</div>
      <ReactECharts option={option} style={{ height: 340 }} />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// B: React 组件 + 小 SVG (Flexbox 布局)
// ═══════════════════════════════════════════════════════════════════════

function ApproachB({ pf, phi, P, Q, S }: { pf: number; phi: number; P: number; Q: number; S: number }) {
  return (
    <Card title={<><Tag color="green">方案 B</Tag> React + 小 SVG + Flexbox</>} size="small" style={{ height: '100%' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>布局用 CSS，各部分独立小 SVG，修改互不影响 | 约 60 行 JSX</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* Waveform card */}
        <div style={{ flex: '1 1 180px', background: 'rgba(9,132,227,0.06)', borderRadius: 8, padding: 8 }}>
          <Text strong style={{ fontSize: 12, color: '#0984E3' }}>电压·电流波形</Text>
          <svg viewBox="0 0 200 100" width="100%">
            <line x1={10} y1={50} x2={190} y2={50} stroke="#ddd" strokeWidth={1} />
            <path d={WaveformPath(1, 50, 30)} stroke="#0984E3" strokeWidth={2} fill="none" />
            <path d={WaveformPath(1 - pf * 0.3, 50, 30, phi)} stroke="#D63031" strokeWidth={2} strokeDasharray="5,3" fill="none" />
            <text x={180} y={28} fontSize={9} fill="#0984E3" fontWeight="bold">v</text>
            <text x={180} y={78} fontSize={9} fill="#D63031" fontWeight="bold">i</text>
          </svg>
          <div style={{ fontSize: 10, color: '#999' }}>φ = {(phi * 180 / Math.PI).toFixed(1)}°</div>
        </div>

        {/* Triangle card */}
        <div style={{ flex: '1 1 150px', background: 'rgba(108,92,231,0.06)', borderRadius: 8, padding: 8 }}>
          <Text strong style={{ fontSize: 12, color: '#6C5CE7' }}>功率三角形</Text>
          <svg viewBox="0 0 160 120" width="100%">
            <line x1={15} y1={100} x2={130} y2={100} stroke="#0984E3" strokeWidth={4} strokeLinecap="round" />
            <text x={70} y={115} textAnchor="middle" fontSize={12} fill="#0984E3" fontWeight="bold">P={P.toFixed(0)}</text>
            <line x1={130} y1={100} x2={130} y2={45} stroke="#D63031" strokeWidth={4} strokeLinecap="round" />
            <text x={136} y={72} fontSize={12} fill="#D63031" fontWeight="bold">Q={Q.toFixed(0)}</text>
            <line x1={15} y1={100} x2={130} y2={45} stroke="#E17055" strokeWidth={4} strokeLinecap="round" />
            <text x={5} y={72} fontSize={12} fill="#E17055" fontWeight="bold" textAnchor="end">S</text>
            <rect x={122} y={92} width={8} height={8} fill="none" stroke="#999" strokeWidth={1} />
          </svg>
        </div>

        {/* Formula card */}
        <div style={{ flex: '1 1 130px', background: 'rgba(225,112,85,0.06)', borderRadius: 8, padding: 8, border: '1px solid rgba(225,112,85,0.2)' }}>
          <Text strong style={{ fontSize: 12, color: '#E17055' }}>公式</Text>
          <div style={{ fontSize: 11, lineHeight: 1.8, marginTop: 4 }}>
            <div>S² = P² + Q²</div>
            <div>cos φ = P/S = <Text strong style={{ color: '#D63031' }}>{pf.toFixed(2)}</Text></div>
            <div>I_rms = I/cos φ = <Text strong style={{ color: '#D63031' }}>+{((1/pf-1)*100).toFixed(0)}%</Text></div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WaveformPath(amp: number, mid: number, h: number, shift = 0) {
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * 4 * Math.PI;
    pts.push(`${10 + i * 1.8},${mid - Math.sin(t - shift) * h * amp}`);
  }
  return 'M' + pts.join(' L');
}

// ═══════════════════════════════════════════════════════════════════════
// C: 原生 Canvas (useRef + useEffect)
// ═══════════════════════════════════════════════════════════════════════

function ApproachC({ pf, phi, P, Q, S }: { pf: number; phi: number; P: number; Q: number; S: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    let phase = 0;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // Waveform area
      const wMid = H * 0.38, wH = H * 0.20;
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, wMid); ctx.lineTo(W * 0.55, wMid); ctx.stroke();

      // v(t)
      ctx.strokeStyle = '#0984E3'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * 4 * Math.PI;
        const y = wMid - Math.sin(t + phase * 0.02) * wH;
        ctx.lineTo(10 + (i / 200) * (W * 0.55 - 10), y);
      }
      ctx.stroke();

      // i(t) dashed
      ctx.strokeStyle = '#D63031'; ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * 4 * Math.PI;
        ctx.lineTo(10 + (i / 200) * (W * 0.55 - 10), wMid - Math.sin(t - phi + phase * 0.02) * wH);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Power triangle
      const tx = W * 0.58, ty = H * 0.5, sc = 0.6;
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.strokeStyle = '#0984E3'; ctx.beginPath(); ctx.moveTo(tx, ty + 55); ctx.lineTo(tx + P * sc, ty + 55); ctx.stroke();
      ctx.strokeStyle = '#D63031'; ctx.beginPath(); ctx.moveTo(tx + P * sc, ty + 55); ctx.lineTo(tx + P * sc, ty + 55 - Q * sc); ctx.stroke();
      ctx.strokeStyle = '#E17055'; ctx.beginPath(); ctx.moveTo(tx, ty + 55); ctx.lineTo(tx + P * sc, ty + 55 - Q * sc); ctx.stroke();

      ctx.fillStyle = '#0984E3'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`P=${P.toFixed(0)}kW`, tx + P * sc / 2, ty + 72);
      ctx.fillStyle = '#D63031'; ctx.fillText(`Q=${Q.toFixed(0)}kvar`, tx + P * sc + 18, ty + 55 - Q * sc / 2 + 4);
      ctx.fillStyle = '#E17055'; ctx.textAlign = 'right'; ctx.fillText(`S=${S.toFixed(0)}kVA`, tx - 6, ty + 55 - Q * sc / 2 + 4);

      // Formula
      ctx.fillStyle = '#636E72'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`cos φ = ${pf.toFixed(2)}  |  I↑ = ${((1/pf-1)*100).toFixed(0)}%`, W / 2, H - 6);

      phase++;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [pf, phi, P, Q, S]);

  return (
    <Card title={<><Tag color="orange">方案 C</Tag> 原生 Canvas API</>} size="small" style={{ height: '100%' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>单个 canvas，JS 命令式绘制，自带动画循环 | 约 45 行 JS</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 300, borderRadius: 8, background: '#F8F9FA' }} />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// D: 纯 ECharts (graph + line + graphic 全驱动)
// ═══════════════════════════════════════════════════════════════════════

function ApproachD({ pf, phi, P, Q, S }: { pf: number; phi: number; P: number; Q: number; S: number }) {
  const n = 200;
  const tData = Array.from({ length: n }, (_, i) => i / n * 4 * Math.PI);
  const vData = tData.map(t => Math.sin(t));
  const iData = tData.map(t => Math.sin(t - phi));

  const option = useMemo(() => ({
    title: { text: '全 ECharts: 波形 + 三角 + 指标', left: 'center', top: 0, textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 160, top: 40, bottom: 60, height: 120 },
    xAxis: { type: 'value', show: false, min: 0, max: 4 * Math.PI },
    yAxis: { type: 'value', show: false, min: -1.2, max: 1.2 },
    series: [
      { name: 'v(t)', type: 'line', data: tData.map((t, i) => [t, vData[i]]), smooth: true, lineStyle: { color: '#0984E3', width: 2.5 }, showSymbol: false },
      { name: 'i(t)', type: 'line', data: tData.map((t, i) => [t, iData[i]]), smooth: true, lineStyle: { color: '#D63031', width: 2.5, type: 'dashed' }, showSymbol: false },
      // Radar chart as power triangle alternative
      { name: '功率分布', type: 'radar', center: ['80%', '65%'], radius: '25%',
        radarIndicator: [{ name: 'P', max: 100 }, { name: 'Q', max: 100 }, { name: 'S', max: 100 }],
        data: [{ value: [P, Q, S], name: `cosφ=${pf.toFixed(2)}`, areaStyle: { color: 'rgba(108,92,231,0.2)' }, lineStyle: { color: '#6C5CE7' } }],
      },
      // Gauge for current stress
      { name: '电流应力', type: 'gauge', center: ['80%', '25%'], radius: '20%', min: 0, max: 50,
        detail: { formatter: `+${((1/pf-1)*100).toFixed(0)}%`, fontSize: 16, color: '#D63031' },
        data: [{ value: (1/pf - 1) * 100 }],
        axisLine: { lineStyle: { color: [[0.3, '#00B894'], [0.6, '#E17055'], [1, '#D63031']] } },
      },
    ],
  }), [pf, phi, P, Q, S]);

  return (
    <Card title={<><Tag color="purple">方案 D</Tag> 全 ECharts 混合图表</>} size="small" style={{ height: '100%' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>同一 option 中用 line + radar + gauge 三种图表类型组合 | 约 25 行配置</div>
      <ReactECharts option={option} style={{ height: 340 }} />
    </Card>
  );
}

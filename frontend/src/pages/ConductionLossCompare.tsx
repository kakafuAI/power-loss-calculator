import { useState, useRef, useEffect, useMemo } from 'react';
import { Typography, Slider, Row, Col, Card, Tag, Statistic } from 'antd';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

// ═══════════════════════════════════════════════════════════════════════
export default function ConductionLossCompare() {
  const [ic, setIc] = useState(80);
  const [vceSat, setVceSat] = useState(2.0);
  const [duty, setDuty] = useState(0.7);
  const [vf, setVf] = useState(1.7);

  const pIgbt = vceSat * ic * duty;
  const pDiode = vf * ic * (1 - duty);
  const pTotal = pIgbt + pDiode;
  const tJ = 40 + pTotal * 0.15;

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: 8 }}>
      <Title level={4} style={{ marginBottom: 8 }}>导通损耗 — 四种方案对比</Title>

      {/* Shared controls */}
      <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
        <Col span={3}><Text strong style={{ fontSize: 12 }}>Ic: {ic}A</Text></Col>
        <Col span={3}><Slider min={10} max={200} value={ic} onChange={setIc} /></Col>
        <Col span={3}><Text strong style={{ fontSize: 12 }}>Vce(sat): {vceSat.toFixed(1)}V</Text></Col>
        <Col span={3}><Slider min={0.5} max={4.0} step={0.1} value={vceSat} onChange={setVceSat} /></Col>
        <Col span={3}><Text strong style={{ fontSize: 12 }}>D: {duty.toFixed(2)}</Text></Col>
        <Col span={3}><Slider min={0.1} max={0.9} step={0.05} value={duty} onChange={setDuty} /></Col>
        <Col span={2}><Statistic title="P_IGBT" value={`${pIgbt.toFixed(0)}W`} valueStyle={{ fontSize: 14, color: '#D63031' }} /></Col>
        <Col span={2}><Statistic title="P_Diode" value={`${pDiode.toFixed(0)}W`} valueStyle={{ fontSize: 14, color: '#E17055' }} /></Col>
        <Col span={2}><Statistic title="Tj" value={`${tJ.toFixed(0)}°C`} valueStyle={{ fontSize: 14 }} /></Col>
      </Row>

      {/* 4 approaches in a 2x2 grid — all visible at once */}
      <Row gutter={[8, 8]}>
        <Col span={12}><ApproachA ic={ic} vceSat={vceSat} duty={duty} vf={vf} pIgbt={pIgbt} pDiode={pDiode} tJ={tJ} /></Col>
        <Col span={12}><ApproachB ic={ic} vceSat={vceSat} duty={duty} vf={vf} pIgbt={pIgbt} pDiode={pDiode} tJ={tJ} /></Col>
        <Col span={12}><ApproachC ic={ic} vceSat={vceSat} duty={duty} vf={vf} pIgbt={pIgbt} pDiode={pDiode} tJ={tJ} /></Col>
        <Col span={12}><ApproachD ic={ic} vceSat={vceSat} duty={duty} vf={vf} pIgbt={pIgbt} pDiode={pDiode} tJ={tJ} /></Col>
      </Row>
    </div>
  );
}

interface Props { ic: number; vceSat: number; duty: number; vf: number; pIgbt: number; pDiode: number; tJ: number; }

// ═══════════ A: ECharts — stacked bar + gauge ═══════════
function ApproachA({ ic, vceSat, duty, vf, pIgbt, pDiode, tJ }: Props) {
  const opt = useMemo(() => ({
    title: { text: '导通损耗', left: 'center', top: 2, textStyle: { fontSize: 12 } },
    graphic: [
      { type: 'text', left: 10, top: 148, style: { text: `P = Vce×Ic×D = ${vceSat.toFixed(1)}×${ic}×${duty.toFixed(2)} = ${pIgbt.toFixed(0)}W`, fill: '#636E72', fontSize: 10 } },
      { type: 'text', left: 10, top: 164, style: { text: `P = Vf×Ic×(1-D) = ${vf.toFixed(1)}×${ic}×${(1-duty).toFixed(2)} = ${pDiode.toFixed(0)}W`, fill: '#636E72', fontSize: 10 } },
    ],
    grid: [
      { left: 40, right: 10, top: 36, bottom: 80, height: 60 },
      { left: 40, right: 10, top: 120, bottom: 36, height: 40 },
    ],
    xAxis: [{ gridIndex: 0, type: 'value', show: false, min: 0, max: 1 }, { gridIndex: 1, type: 'value', show: false, min: 0, max: 1 }],
    yAxis: [{ gridIndex: 0, type: 'category', data: [''], show: false }, { gridIndex: 1, type: 'category', data: [''], show: false }],
    series: [
      { name: 'IGBT导通', type: 'bar', stack: 'total', xAxisIndex: 0, yAxisIndex: 0, data: [pIgbt], itemStyle: { color: '#D63031', borderRadius: [4, 0, 0, 4] }, label: { show: true, formatter: `${pIgbt.toFixed(0)}W`, fontSize: 10 } },
      { name: 'Diode导通', type: 'bar', stack: 'total', xAxisIndex: 0, yAxisIndex: 0, data: [pDiode], itemStyle: { color: '#E17055' }, label: { show: true, formatter: `${pDiode.toFixed(0)}W`, fontSize: 10 } },
      { name: 'IGBT', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: [duty], itemStyle: { color: '#0984E3', borderRadius: 4 }, label: { show: true, formatter: `IGBT ${(duty*100).toFixed(0)}%`, fontSize: 10 }, barWidth: 16 },
      { name: 'Diode', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: [1-duty], stack: 'duty', itemStyle: { color: '#E17055' }, label: { show: true, formatter: `Diode ${((1-duty)*100).toFixed(0)}%`, fontSize: 10 }, barWidth: 16 },
    ],
  }), [ic, vceSat, duty, vf, pIgbt, pDiode]);

  return (
    <Card size="small" title={<><Tag color="blue">方案 A</Tag> ECharts 堆叠柱状图</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999' }}>堆叠柱状图 + 占空比条 | 纯配置驱动</div>
      <ReactECharts option={opt} style={{ height: 200 }} />
    </Card>
  );
}

// ═══════════ B: React + small SVGs ═══════════
function ApproachB({ ic, vceSat, duty, vf, pIgbt, pDiode, tJ }: Props) {
  return (
    <Card size="small" title={<><Tag color="green">方案 B</Tag> React 组件 + 独立小 SVG</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>CSS Grid 布局 + 4 个独立 SVG | 各部件互不影响</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {/* Circuit SVG */}
        <div style={{ background: '#F8F9FA', borderRadius: 6, padding: 6, gridRow: 'span 2' }}>
          <Text style={{ fontSize: 10, color: '#666' }}>半桥电路</Text>
          <svg viewBox="0 0 140 170" width="100%">
            <line x1={20} y1={10} x2={120} y2={10} stroke="#333" strokeWidth={2} />
            <text x={70} y={6} textAnchor="middle" fontSize={9}>DC+</text>
            <line x1={20} y1={160} x2={120} y2={160} stroke="#333" strokeWidth={2} />
            <text x={70} y={168} textAnchor="middle" fontSize={9}>DC−</text>
            {/* IGBT T1 */}
            <rect x={40} y={25} width={30} height={30} rx={3} fill={duty > 0.5 ? '#D63031' : '#ccc'} opacity={0.7} />
            <text x={55} y={44} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">T1</text>
            <rect x={75} y={32} width={14} height={18} rx={2} fill={duty < 0.5 ? '#E17055' : '#ddd'} opacity={0.7} />
            <text x={82} y={45} textAnchor="middle" fontSize={7}>D1</text>
            <circle cx={70} cy={85} r={5} fill="#D63031" />
            <text x={70} y={78} textAnchor="middle" fontSize={8} fill="#D63031">out</text>
            {/* IGBT T2 */}
            <rect x={40} y={105} width={30} height={30} rx={3} fill={duty < 0.5 ? '#D63031' : '#ccc'} opacity={0.7} />
            <text x={55} y={124} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">T2</text>
            <rect x={75} y={112} width={14} height={18} rx={2} fill={duty > 0.5 ? '#E17055' : '#ddd'} opacity={0.7} />
            <text x={82} y={125} textAnchor="middle" fontSize={7}>D2</text>
            <line x1={20} y1={10} x2={55} y2={25} stroke="#666" strokeWidth={1} />
            <line x1={20} y1={160} x2={55} y2={135} stroke="#666" strokeWidth={1} />
          </svg>
        </div>

        {/* Loss bars */}
        <div style={{ background: '#FFF5F5', borderRadius: 6, padding: 6 }}>
          <Text style={{ fontSize: 10, color: '#D63031' }}>损耗分布</Text>
          <svg viewBox="0 0 200 60" width="100%">
            <rect x={0} y={5} width={pIgbt / (pIgbt + pDiode) * 190} height={18} rx={3} fill="#D63031" opacity={0.8} />
            <text x={5} y={18} fontSize={11} fill="#fff" fontWeight="bold">IGBT {pIgbt.toFixed(0)}W</text>
            <rect x={0} y={28} width={pDiode / (pIgbt + pDiode) * 190} height={18} rx={3} fill="#E17055" opacity={0.8} />
            <text x={5} y={41} fontSize={11} fill="#fff" fontWeight="bold">Diode {pDiode.toFixed(0)}W</text>
          </svg>
        </div>

        {/* Formula */}
        <div style={{ background: '#FFFBE6', borderRadius: 6, padding: 6, border: '1px solid #FFE58F' }}>
          <Text style={{ fontSize: 10, color: '#AD6800' }}>P = Vce×Ic×D = {vceSat.toFixed(1)}×{ic}×{duty.toFixed(2)} = <strong>{pIgbt.toFixed(0)}W</strong></Text>
        </div>

        {/* Tj card */}
        <div style={{ background: tJ > 150 ? '#FFF2F0' : '#F6FFED', borderRadius: 6, padding: 6 }}>
          <Text style={{ fontSize: 12, color: tJ > 150 ? '#D63031' : '#00B894' }}>Tj ≈ {tJ.toFixed(0)}°C</Text>
        </div>
      </div>
    </Card>
  );
}

// ═══════════ C: Canvas ═══════════
function ApproachC({ ic, vceSat, duty, vf, pIgbt, pDiode, tJ }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rc = c.getBoundingClientRect();
    c.width = rc.width * dpr; c.height = rc.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rc.width, H = rc.height;
    let off = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const m = W * 0.3, tY = H * 0.15;
      // Circuit
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(m, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, H - 10); ctx.lineTo(m, H - 10); ctx.stroke();
      ctx.fillStyle = duty > 0.5 ? '#D63031' : '#ccc'; ctx.globalAlpha = 0.8;
      ctx.fillRect(m - 5, 20, 25, 30);
      ctx.fillStyle = duty < 0.5 ? '#E17055' : '#ddd';
      ctx.fillRect(m + 25, 25, 14, 20);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('T1', m + 8, 40);
      // Lower
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = duty < 0.5 ? '#D63031' : '#ccc';
      ctx.fillRect(m - 5, H - 50, 25, 30);
      ctx.fillStyle = duty > 0.5 ? '#E17055' : '#ddd';
      ctx.fillRect(m + 25, H - 48, 14, 20);
      ctx.globalAlpha = 1;
      ctx.fillText('T2', m + 8, H - 32);
      // Phase
      ctx.fillStyle = '#D63031'; ctx.beginPath(); ctx.arc(m + 8, tY + 50, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('out', m + 25, tY + 53);
      // Lines
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m + 8, 10); ctx.lineTo(m + 8, 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m + 8, 50); ctx.lineTo(m + 8, tY + 45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m + 8, tY + 55); ctx.lineTo(m + 8, H - 50); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m + 8, H - 20); ctx.lineTo(m + 8, H - 10); ctx.stroke();

      // Bars right side
      const bx = m + 55;
      ctx.fillStyle = '#D63031'; ctx.globalAlpha = 0.8;
      ctx.fillRect(bx, 30, pIgbt * 0.6, 22);
      ctx.fillStyle = '#E17055';
      ctx.fillRect(bx, 56, pDiode * 0.6, 22);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`IGBT ${pIgbt.toFixed(0)}W`, bx + 4, 47);
      ctx.fillText(`Diode ${pDiode.toFixed(0)}W`, bx + 4, 72);

      // Formula
      ctx.fillStyle = '#636E72'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`P = ${vceSat.toFixed(1)}×${ic}×${duty.toFixed(2)} = ${pIgbt.toFixed(0)}W`, bx, 100);
      ctx.fillText(`P = ${vf.toFixed(1)}×${ic}×${(1-duty).toFixed(2)} = ${pDiode.toFixed(0)}W`, bx, 116);
      ctx.fillText(`Tj ≈ ${tJ.toFixed(0)}°C`, bx, 136);

      // Animated current pulse
      off = (off + 0.5) % 30;
      ctx.strokeStyle = '#00B894'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 4]); ctx.lineDashOffset = -off;
      if (duty > 0.3) {
        ctx.beginPath(); ctx.moveTo(10, H - 10); ctx.lineTo(m + 8, H - 10); ctx.stroke();
      }
      ctx.setLineDash([]);
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [ic, vceSat, duty, vf, pIgbt, pDiode, tJ]);

  return (
    <Card size="small" title={<><Tag color="orange">方案 C</Tag> 原生 Canvas</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999' }}>命令式绘制 + requestAnimationFrame | 精细像素控制</div>
      <canvas ref={ref} style={{ width: '100%', height: 170, borderRadius: 6, background: '#F8F9FA' }} />
    </Card>
  );
}

// ═══════════ D: ECharts all-in-one ═══════════
function ApproachD({ ic, vceSat, duty, vf, pIgbt, pDiode, tJ }: Props) {
  const opt = useMemo(() => ({
    title: { text: '混合图表', left: 'center', top: 2, textStyle: { fontSize: 12 } },
    series: [
      // Pie for loss distribution
      { name: '损耗分布', type: 'pie', center: ['25%', '55%'], radius: ['35%', '55%'],
        label: { formatter: '{b}\n{d}%', fontSize: 10 },
        data: [
          { value: pIgbt, name: 'IGBT', itemStyle: { color: '#D63031' } },
          { value: pDiode, name: 'Diode', itemStyle: { color: '#E17055' } },
        ],
      },
      // Gauge for Tj
      { name: 'Tj', type: 'gauge', center: ['60%', '40%'], radius: '30%', min: 20, max: 200,
        detail: { formatter: `${tJ.toFixed(0)}°C`, fontSize: 14, color: tJ > 150 ? '#D63031' : '#00B894' },
        data: [{ value: tJ }],
        axisLine: { lineStyle: { color: [[0.5, '#00B894'], [0.75, '#E17055'], [1, '#D63031']] } },
      },
      // Bar for duty
      { name: '占空比', type: 'bar', xAxisIndex: 0, yAxisIndex: 0, data: [{ value: duty, itemStyle: { color: '#0984E3' } }],
        label: { show: true, formatter: `IGBT ${(duty*100).toFixed(0)}%`, fontSize: 10, position: 'inside' } },
      { name: '占空比', type: 'bar', xAxisIndex: 0, yAxisIndex: 0, data: [{ value: 1-duty, itemStyle: { color: '#E17055' } }],
        label: { show: true, formatter: `Diode ${((1-duty)*100).toFixed(0)}%`, fontSize: 10 }, stack: 'd' },
    ],
    xAxis: { show: false, min: 0, max: 1 },
    yAxis: { type: 'category', data: [''], show: false },
    grid: { left: '60%', right: 10, top: '75%', bottom: 5, height: 20 },
    graphic: [
      { type: 'text', left: 'center', bottom: 8, style: { text: `P总=${pIgbt.toFixed(0)}+${pDiode.toFixed(0)}=${(pIgbt+pDiode).toFixed(0)}W`, fill: '#636E72', fontSize: 11 }, textAlign: 'center' },
    ],
  }), [ic, vceSat, duty, vf, pIgbt, pDiode, tJ]);

  return (
    <Card size="small" title={<><Tag color="purple">方案 D</Tag> 全 ECharts (饼图+仪表+条形)</>} bodyStyle={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: '#999' }}>饼图(pie) + 仪表(gauge) + 条形 | 全部数据驱动</div>
      <ReactECharts option={opt} style={{ height: 200 }} />
    </Card>
  );
}

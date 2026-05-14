import { useState } from 'react';
import { Slider, Typography } from 'antd';

const { Text, Paragraph } = Typography;

export default function ThermalNetworkDiagram() {
  const [pLoss, setPLoss] = useState(100);
  const [rthJc, setRthJc] = useState(0.24);
  const [rthCh, setRthCh] = useState(0.04);
  const [rthHa, setRthHa] = useState(0.3);
  const [tAmb] = useState(40);

  const dT_jc = pLoss * rthJc;
  const dT_ch = pLoss * rthCh;
  const dT_ha = pLoss * rthHa;
  const tHeatsink = tAmb + dT_ha;
  const tCase = tHeatsink + dT_ch;
  const tJ = tCase + dT_jc;

  const W = 200, H = 400, cx = W / 2;

  // Color gradient from red (hot) to blue (cold)
  const tempToColor = (t: number) => {
    const ratio = Math.max(0, Math.min(1, (t - tAmb) / (Math.max(tJ, tAmb + 1) - tAmb)));
    const r = Math.round(255);
    const g = Math.round(255 * (1 - ratio) * 0.7 + 50);
    const b = Math.round(255 * (1 - ratio) + 50 * ratio);
    return `rgb(${r},${g},${b})`;
  };

  const layers = [
    { y: 50, h: 70, label: '芯片 (Junction)', temp: tJ, rth: '—' },
    { y: 130, h: 35, label: '焊料 / DBC', temp: tCase + dT_jc * 0.3, rth: '(含在 Rth_jc)' },
    { y: 175, h: 40, label: '基板 (Case)', temp: tCase, rth: `Rth_jc = ${rthJc}` },
    { y: 225, h: 30, label: '导热脂', temp: tCase - dT_ch * 0.5, rth: `Rth_ch = ${rthCh}` },
    { y: 265, h: 50, label: '散热器 (Heatsink)', temp: tHeatsink, rth: `Rth_ha = ${rthHa}` },
    { y: 325, h: 25, label: '环境空气 (Ambient)', temp: tAmb, rth: '—' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <Text strong>P_loss: {pLoss} W</Text>
          <Slider min={10} max={500} value={pLoss} onChange={setPLoss} style={{ width: 200 }} />
        </div>
        <div>
          <Text strong>Rth_jc: {rthJc} K/W</Text>
          <Slider min={0.05} max={1.0} step={0.01} value={rthJc} onChange={setRthJc} style={{ width: 150 }} />
        </div>
        <div>
          <Text strong>Rth_ch: {rthCh} K/W</Text>
          <Slider min={0.01} max={0.2} step={0.01} value={rthCh} onChange={setRthCh} style={{ width: 150 }} />
        </div>
        <div>
          <Text strong>Rth_ha: {rthHa} K/W</Text>
          <Slider min={0.05} max={1.0} step={0.01} value={rthHa} onChange={setRthHa} style={{ width: 150 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={200} height={400} style={{ background: '#fafbfc', borderRadius: 8 }}>
          {layers.map((l, i) => (
            <g key={i}>
              <rect x={cx - 70} y={l.y} width={140} height={l.h} rx={4}
                fill={tempToColor(l.temp)} stroke="#999" strokeWidth={1} />
              <text x={cx} y={l.y + l.h / 2 + 3} textAnchor="middle" fontSize={10} fill={l.temp > 100 ? '#fff' : '#333'}>
                {l.label}
              </text>
              <text x={cx} y={l.y + l.h / 2 + 17} textAnchor="middle" fontSize={9} fill={l.temp > 100 ? '#ddd' : '#666'}>
                {l.temp.toFixed(1)}°C
              </text>
            </g>
          ))}
          {/* Rth labels */}
          <text x={cx + 75} y={200} fontSize={9} fill="#666">← Rth_jc</text>
          <text x={cx + 75} y={250} fontSize={9} fill="#666">← Rth_ch</text>
          <text x={cx + 75} y={310} fontSize={9} fill="#666">← Rth_ha</text>
        </svg>

        <div style={{ flex: 1, maxWidth: 300 }}>
          <div style={{ background: '#fffbe6', padding: 12, borderRadius: 8, border: '1px solid #ffe58f' }}>
            <Text strong>热计算公式:</Text>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 2 }}>
              <div>T_heatsink = {tAmb} + {pLoss} × {rthHa} = <Text type="danger">{tHeatsink.toFixed(1)}°C</Text></div>
              <div>T_case = {tHeatsink.toFixed(1)} + {pLoss} × {rthCh} = <Text type="danger">{tCase.toFixed(1)}°C</Text></div>
              <div>T_junction = {tCase.toFixed(1)} + {pLoss} × {rthJc} = <Text type="danger" strong>{tJ.toFixed(1)}°C</Text></div>
              <div style={{ marginTop: 8, borderTop: '1px solid #ffe58f', paddingTop: 4 }}>
                ΔT_total = {dT_jc.toFixed(1)} + {dT_ch.toFixed(1)} + {dT_ha.toFixed(1)} = {(dT_jc + dT_ch + dT_ha).toFixed(1)}°C
              </div>
            </div>
          </div>
        </div>
      </div>

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          热从芯片逐层传导至环境，每层热阻产生温升 ΔT = P × Rth。
          Rth_jc 通常最小但最关键，Rth_ha 取决于散热器设计和风冷条件。
        </Text>
      </Paragraph>
    </div>
  );
}

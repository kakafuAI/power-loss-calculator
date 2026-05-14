import { useState } from 'react';
import { Slider, Typography } from 'antd';

const { Text, Paragraph } = Typography;

export default function SwitchingLossDiagram() {
  const [fsw, setFsw] = useState(4);

  const W = 520, H = 280, ml = 55, mt = 30, pw = W - ml - 20, ph = H - mt - 40;

  // Simulated Vce and Ic during turn-on
  const n = 60;
  const vPts = Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const v = 1 - Math.exp(-t * 8); // Vce falling
    return { x: ml + (i / n) * pw * 0.3, y: mt + ph * 0.1 + (1 - v) * ph * 0.7 };
  });
  const iPts = Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const ic = 1 - Math.exp(-t * 6); // Ic rising
    return { x: ml + (i / n) * pw * 0.3, y: mt + ph * 0.1 + (1 - ic) * ph * 0.7 };
  });
  // Crossover area (loss)
  const crossPts = Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const v = 1 - Math.exp(-t * 8);
    const ic = 1 - Math.exp(-t * 6);
    return { x: ml + (t) * pw * 0.3, y: mt + ph * 0.1 + (1 - v * ic) * ph * 0.7 };
  });

  // Power loss per event vs fsw
  const ePerEvent = 25; // mJ at reference
  const pLoss = fsw * 1000 * ePerEvent / 1000; // W for 6 IGBTs

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong>开关频率 f_sw: {fsw}.0 kHz </Text>
        <Slider min={1} max={20} step={0.5} value={fsw} onChange={setFsw} style={{ width: 250, display: 'inline-block', marginLeft: 12 }} />
        <Text style={{ marginLeft: 16 }}>估算 IGBT 开关损耗: <Text strong type="danger">{pLoss.toFixed(0)} W</Text></Text>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 600, background: '#fafbfc', borderRadius: 8 }}>
        {/* Axes */}
        <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke="#333" strokeWidth={1} />
        <line x1={ml} y1={mt + ph} x2={ml + pw} y2={mt + ph} stroke="#333" strokeWidth={1} />
        {/* Vce falling */}
        <polyline points={vPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1677ff" strokeWidth={2} />
        <text x={ml + pw * 0.15} y={mt - 5} fontSize={11} fill="#1677ff">Vce 下降</text>
        {/* Ic rising */}
        <polyline points={iPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#cf1322" strokeWidth={2} />
        <text x={ml + pw * 0.05} y={mt + ph - 5} fontSize={11} fill="#cf1322">Ic 上升</text>
        {/* Crossover = loss area */}
        <polygon points={crossPts.map(p => `${p.x},${p.y}`).join(' ') + ` ${ml + pw * 0.3},${mt + ph} ${ml},${mt + ph}`}
          fill="#ff7875" opacity={0.25} stroke="#ff4d4f" strokeWidth={1} strokeDasharray="3" />
        <text x={ml + pw * 0.08} y={mt + ph * 0.55} fontSize={12} fill="#cf1322" fontWeight="bold">
          Eon = ∫ v×i dt
        </text>
        {/* Labels */}
        <text x={ml - 45} y={mt + ph / 2} textAnchor="middle" fontSize={10} transform={`rotate(-90,${ml-45},${mt+ph/2})`}>
          归一化 V, I
        </text>

        {/* Bar chart: fsw vs loss */}
        <rect x={ml + pw * 0.45} y={mt + ph - pLoss / 3000 * ph} width={30} height={pLoss / 3000 * ph}
          fill="#ff4d4f" rx={2} />
        <text x={ml + pw * 0.45 + 15} y={mt + ph - pLoss / 3000 * ph - 5} textAnchor="middle" fontSize={10} fill="#cf1322">
          {pLoss.toFixed(0)}W
        </text>
        <text x={ml + pw * 0.45 + 15} y={mt + ph + 15} textAnchor="middle" fontSize={10}>@{fsw}kHz</text>
        {/* Compare */}
        <rect x={ml + pw * 0.62} y={mt + ph - (fsw * 2 * ePerEvent / 3) / 3000 * ph} width={30}
          height={(fsw * 2 * ePerEvent / 3) / 3000 * ph} fill="#ffa39e" rx={2} />
        <text x={ml + pw * 0.62 + 15} y={mt + ph - (fsw * 2 * ePerEvent / 3) / 3000 * ph - 5}
          textAnchor="middle" fontSize={10} fill="#ff7875">
          {((fsw * 2 * ePerEvent / 3) / 1000 * 6000).toFixed(0)}W
        </text>
        <text x={ml + pw * 0.62 + 15} y={mt + ph + 15} textAnchor="middle" fontSize={10}>@{fsw * 2}kHz</text>
      </svg>

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          开关过程中 Vce 和 Ic 的交叠产生瞬时功率峰值，积分得到开关能量 Eon/Eoff。
          开关损耗 P_sw = f_sw × (Eon + Eoff)，与开关频率成正比。
        </Text>
      </Paragraph>
    </div>
  );
}

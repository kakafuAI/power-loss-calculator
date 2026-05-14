import { useState } from 'react';
import { Slider, Typography } from 'antd';

const { Text, Paragraph } = Typography;

export default function PowerFactorDiagram({ conditions }: { conditions?: { power_factor?: number } }) {
  const [pf, setPf] = useState(conditions?.power_factor ?? 0.85);
  const phi = Math.acos(pf);
  const W = 500, H = 250, ml = 55, mt = 30, pw = W - ml - 20, ph = H - mt - 40;

  const n = 200;
  const vPts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 4 * Math.PI;
    return { x: ml + (i / n) * pw, y: mt + ph / 2 - Math.sin(t) * ph * 0.35 };
  });
  const iPts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 4 * Math.PI;
    return { x: ml + (i / n) * pw, y: mt + ph / 2 - Math.sin(t - phi) * ph * 0.35 };
  });

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong>功率因数 cos φ: {pf.toFixed(2)} </Text>
        <Slider min={0.1} max={1.0} step={0.05} value={pf} onChange={setPf} style={{ width: 250, display: 'inline-block', marginLeft: 12 }} />
        <Text type="secondary" style={{ marginLeft: 12 }}>φ = {(phi * 180 / Math.PI).toFixed(1)}°</Text>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 550, background: '#fafbfc', borderRadius: 8 }}>
        <line x1={ml} y1={mt + ph / 2} x2={ml + pw} y2={mt + ph / 2} stroke="#e8e8e8" strokeWidth={1} />
        <polyline points={vPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1677ff" strokeWidth={2} />
        <polyline points={iPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#cf1322" strokeWidth={2} strokeDasharray="6,3" />
        {/* Phase shift arrow */}
        {phi > 0.05 && (
          <line x1={ml + pw * 0.25} y1={mt + ph / 2} x2={ml + pw * 0.25 + phi / Math.PI * pw * 0.5} y2={mt + ph / 2}
            stroke="#faad14" strokeWidth={2} markerEnd="url(#arrow)" />
        )}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#faad14" />
          </marker>
        </defs>
        <text x={ml} y={mt - 10} fontSize={12} fill="#1677ff">电压 v(t)</text>
        <text x={ml} y={mt + ph + 15} fontSize={12} fill="#cf1322">电流 i(t)</text>
        {phi > 0.05 && (
          <text x={ml + pw * 0.25 + 5} y={mt + ph / 2 - 8} fontSize={11} fill="#faad14">
            φ={(phi * 180 / Math.PI).toFixed(0)}°
          </text>
        )}
      </svg>

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          功率因数 cos φ 表示有功功率与视在功率之比。φ 为电压超前电流的相位角（感性负载）。
          cos φ 越低，无功分量越大，器件电流应力增加。
        </Text>
      </Paragraph>
    </div>
  );
}

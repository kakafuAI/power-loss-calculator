import { useState, useMemo, useEffect } from 'react';
import { Slider, Typography, Row, Col, Tag } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

interface Props { conditions?: { modulation_index?: number; modulation?: string }; }
export default function ModulationDiagram({ conditions }: Props) {
  const [m, setM] = useState(conditions?.modulation_index ?? 1.0);
  const [mod, setMod] = useState(conditions?.modulation ?? 'spwm');
  const [ph, setPh] = useState(0);
  useEffect(() => { const id = setInterval(() => setPh(p => p + 1), 50); return () => clearInterval(id); }, []);

  const maxM = mod === 'spwm' ? 1.0 : 1.15;
  const vUtil = mod === 'spwm' ? 78.5 : 90.7;
  const isOver = m > maxM;

  // 500×200 SVG, waveforms centered at y=120 with ±90 amplitude
  const gen = (fn: (t: number) => number) =>
    Array.from({ length: 300 }, (_, i) => { const t = (i / 300) * 4 * Math.PI; return `${40 + (i / 300) * 440},${120 - fn(t) * 85}`; }).join(' ');
  const sine = useMemo(() => gen(t => m * Math.sin(t + ph * 0.03)), [m, ph]);
  const svpwm = useMemo(() => gen(t => Math.min(m, 1.15) * (Math.sin(t + ph * 0.03) + 1 / 6 * Math.sin(3 * (t + ph * 0.03)))), [m, ph]);
  const carrier = useMemo(() => gen(t => 2 * Math.abs(2 * ((t / (4 * Math.PI) + ph * 0.005) % 1) - 1) - 1), [ph]);
  const wave = mod === 'spwm' ? sine : svpwm;

  return (
    <div>
      <Row gutter={12} align="middle" style={{ marginBottom: 10 }}>
        <Col span={8}>
          <Text strong>调制比 m: {m.toFixed(2)}</Text>
          <Slider min={0.1} max={1.3} step={0.02} value={m} onChange={setM} style={{ width: 150, marginLeft: 8, display: 'inline-block' }} />
          {isOver && <Tag color="red" style={{ marginLeft: 6 }}>过调制!</Tag>}
        </Col>
        <Col span={8}>
          <Text strong>方式: </Text>
          <Tag color={mod === 'spwm' ? 'blue' : 'green'} style={{ cursor: 'pointer', padding: '3px 12px' }}
            onClick={() => setMod(mod === 'spwm' ? 'svpwm' : 'spwm')}>{mod === 'spwm' ? 'SPWM' : 'SVPWM'}</Tag>
        </Col>
        <Col span={8}>
          <Text strong style={{ color: C.green }}>
            电压利用率: {(vUtil * Math.min(m, maxM) / maxM).toFixed(1)}%
            {mod === 'spwm' ? ' (最大78.5%)' : ' (最大90.7%)'}
          </Text>
        </Col>
      </Row>

      {/* Waveform SVG - proper aspect ratio */}
      <div style={{ background: '#F8F9FA', borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <svg viewBox="0 0 560 220" width="100%" style={{ maxWidth: 760 }}>
          <line x1={40} y1={120} x2={520} y2={120} stroke={C.light} strokeWidth={1} strokeDasharray="6" />
          <line x1={40} y1={30} x2={40} y2={205} stroke={C.light} strokeWidth={1} />
          <polyline points={carrier} fill="none" stroke={C.orange} strokeWidth={1.4} opacity={0.3} />
          <polyline points={wave} fill="none" stroke={C.blue} strokeWidth={3} />
          {mod === 'svpwm' && <polyline points={sine} fill="none" stroke={C.blue} strokeWidth={1} strokeDasharray="6,4" opacity={0.2} />}
          <text x={160} y={24} fontSize={14} fontWeight="bold" fill={C.blue}>
            {mod === 'spwm' ? '调制波 m·sin(ωt)' : 'SVPWM 调制波 (3次谐波注入)'}
          </text>
          <text x={400} y={65} fontSize={12} fill={C.orange} fontWeight="bold">三角载波</text>
          <text x={40} y={208} fontSize={12} fill={C.green} fontWeight="bold">
            Vout_peak = m × Vdc/2 = {(m * 0.5 * 100).toFixed(0)}% Vdc &nbsp;
            {isOver ? '⚠ 非线性区!' : (mod === 'spwm' ? '(m≤1.0 线性)' : '(m≤1.15 线性)')}
          </text>
        </svg>
      </div>

      {/* Info cards */}
      <Row gutter={12}>
        <Col span={12}>
          <div style={{ background: 'rgba(9,132,227,0.05)', borderRadius: 8, padding: 12, border: '1px solid rgba(9,132,227,0.2)' }}>
            <Text strong style={{ color: C.blue, fontSize: 14 }}>SPWM 正弦脉宽调制</Text>
            <div style={{ fontSize: 12, color: C.medium, marginTop: 4, lineHeight: 1.6 }}>
              调制波 = 纯正弦波 m·sin(ωt)，线性区 <strong>m ≤ 1.0</strong>，电压利用率 <strong>78.5%</strong>（相电压/直流母线）。
              过调制 (m &gt; 1.0) 时输出电压畸变，需避免。
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div style={{ background: 'rgba(0,184,148,0.05)', borderRadius: 8, padding: 12, border: '1px solid rgba(0,184,148,0.2)' }}>
            <Text strong style={{ color: C.green, fontSize: 14 }}>SVPWM 空间矢量调制</Text>
            <div style={{ fontSize: 12, color: C.medium, marginTop: 4, lineHeight: 1.6 }}>
              注入 1/6 三次谐波形成马鞍波形，线性区扩展至 <strong>m ≤ 1.15</strong>，
              电压利用率约 <strong>90.7%</strong>，比 SPWM 高约 15.5%。工业变频器主流方案。
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}

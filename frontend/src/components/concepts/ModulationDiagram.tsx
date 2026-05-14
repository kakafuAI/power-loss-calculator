import { useState, useMemo } from 'react';
import { Slider, Typography, Space, Row, Col } from 'antd';

const { Text, Paragraph } = Typography;

interface Props {
  conditions?: { modulation_index?: number; modulation?: string };
}

export default function ModulationDiagram({ conditions }: Props) {
  const [m, setM] = useState(conditions?.modulation_index ?? 1.0);
  const [modulation, setModulation] = useState(conditions?.modulation ?? 'spwm');
  const [animPhase, setAnimPhase] = useState(0);

  // SVG parameters
  const W = 600, H = 280, margin = { left: 50, top: 30, right: 20, bottom: 40 };
  const pw = W - margin.left - margin.right;
  const ph = H - margin.top - margin.bottom;

  const carrier = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const n = 200;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 + animPhase * 0.02;
      const tri = 2 * Math.abs(2 * (t % 1) - 1) - 1;
      pts.push({ x: margin.left + (i / n) * pw, y: margin.top + ph / 2 - (tri * ph * 0.4) });
    }
    return pts;
  }, [animPhase, pw, ph]);

  const sine = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const n = 200;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 4 * Math.PI;
      const s = m * Math.sin(t + animPhase * 0.05);
      pts.push({ x: margin.left + (i / n) * pw, y: margin.top + ph / 2 - (s * ph * 0.4) });
    }
    return pts;
  }, [m, animPhase, pw, ph]);

  const pwm = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const n = 200;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 + animPhase * 0.02;
      const ref = m * Math.sin(t * 2 * Math.PI);
      const tri = 2 * Math.abs(2 * (t % 1) - 1) - 1;
      const out = ref > tri ? 1 : 0;
      pts.push({ x: margin.left + (i / n) * pw, y: margin.top + ph / 2 + ph * 0.3 - out * ph * 0.2 });
    }
    return pts;
  }, [m, animPhase, pw, ph]);

  // Start/stop animation
  useState(() => {
    const id = setInterval(() => setAnimPhase(p => p + 1), 50);
    return () => clearInterval(id);
  });

  return (
    <div>
      <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Space>
            <Text strong>调制比 m: {m.toFixed(2)}</Text>
            <Slider min={0.1} max={1.15} step={0.05} value={m} onChange={setM}
              style={{ width: 200 }} />
          </Space>
        </Col>
        <Col span={12}>
          <Space>
            <Text strong>调制方式:</Text>
            <Tag color={modulation === 'spwm' ? 'blue' : 'green'}
              style={{ cursor: 'pointer' }}
              onClick={() => setModulation(modulation === 'spwm' ? 'svpwm' : 'spwm')}>
              {modulation === 'spwm' ? 'SPWM 正弦调制' : 'SVPWM 空间矢量'}
            </Tag>
          </Space>
        </Col>
      </Row>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 700, background: '#fafbfc', borderRadius: 8 }}>
        {/* Grid */}
        <line x1={margin.left} y1={margin.top + ph / 2} x2={margin.left + pw} y2={margin.top + ph / 2}
          stroke="#e8e8e8" strokeWidth={1} strokeDasharray="4" />
        {/* Carrier wave */}
        <polyline points={carrier.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="#faad14" strokeWidth={1.5} opacity={0.7} />
        {/* Sine reference */}
        <polyline points={sine.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="#1677ff" strokeWidth={2} />
        {/* PWM output */}
        <polyline points={pwm.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="#52c41a" strokeWidth={2.5} />
        {/* Labels */}
        <text x={margin.left} y={margin.top - 10} fontSize={12} fill="#1677ff">调制波 (m×sin)</text>
        <text x={margin.left} y={margin.top + ph / 2 - ph * 0.45} fontSize={12} fill="#faad14">三角载波</text>
        <text x={margin.left} y={margin.top + ph + 15} fontSize={12} fill="#52c41a">PWM 输出</text>
        <text x={margin.left + pw + 5} y={margin.top + ph / 2 + 4} fontSize={11} fill="#999">t</text>
      </svg>

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          调制比 m = V_ref / V_carrier 决定输出电压幅值。当 m ≥ 1 时进入过调制区。
          三角载波与正弦调制波的交截产生 PWM 脉冲，脉冲宽度随调制波幅值变化。
          SVPWM 比 SPWM 电压利用率高约 15%。
        </Text>
      </Paragraph>
    </div>
  );
}

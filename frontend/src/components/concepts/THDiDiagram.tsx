import { useState } from 'react';
import { Slider, Typography, Row, Col, Statistic, Tag } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', purple: '#6C5CE7', red: '#D63031', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

export default function THDiDiagram() {
  const [dev, setDev] = useState<'igbt' | 'sic'>('igbt');
  const [fsw, setFsw] = useState(4); const [m, setM] = useState(0.9); const [dt, setDt] = useState(3);
  const fOut = 50; const N = fsw * 1000 / fOut;
  const base = dev === 'igbt' ? 5.5 : 3.5;
  const fFact = Math.max(0.5, 25 / N); const mFact = 1 + (1 - m) * 1.8; const dtFact = 1 + (dt - 1) * 0.08;
  const thdi = Math.min(15, Math.max(1, base * fFact * mFact * dtFact));
  const extraPct = (thdi / 100) * (thdi / 100) * 100;

  const orders = [1, 5, 7, 11, 13, 17, 19, 23, 25, 29, 31, 35];
  const spec = orders.map((h, i) => {
    const amp = h === 1 ? 100 : 100 / (h * 0.8 + i * 0.3);
    const shift = dev === 'sic' ? (h < 11 ? 0.6 : 1.3) : (h < 11 ? 1.0 : 0.8);
    return { order: h, amp: Math.max(0.1, amp * shift * mFact * dtFact) };
  });

  return (
    <div>
      <Row gutter={10} style={{ marginBottom: 12 }}>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>器件:</Text>
          <div><Tag color={dev === 'igbt' ? 'blue' : 'green'} style={{ cursor: 'pointer', padding: '3px 10px' }} onClick={() => setDev('igbt')}>IGBT</Tag>
          <Tag color={dev === 'sic' ? 'green' : 'blue'} style={{ cursor: 'pointer', padding: '3px 10px' }} onClick={() => setDev('sic')}>SiC</Tag></div></Col>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>f_sw: {fsw.toFixed(1)}kHz</Text><Slider min={1} max={30} step={0.5} value={fsw} onChange={setFsw} style={{ margin: 0 }} /></Col>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>调制比: {m.toFixed(2)}</Text><Slider min={0.2} max={1.15} step={0.05} value={m} onChange={setM} style={{ margin: 0 }} /></Col>
        <Col span={6}><Text strong style={{ fontSize: 11 }}>死区: {dt.toFixed(0)}μs</Text><Slider min={1} max={8} step={1} value={dt} onChange={setDt} style={{ margin: 0 }} /></Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={4}><Statistic title="THDi" value={`${thdi.toFixed(2)}%`} valueStyle={{ fontSize: 24, color: thdi > 8 ? C.red : thdi > 5 ? C.orange : C.green }} /></Col>
        <Col span={4}><Statistic title="脉冲比N" value={`${N.toFixed(0)}`} valueStyle={{ fontSize: 20 }} /></Col>
        <Col span={4}><Statistic title="谐波损耗" value={`+${extraPct.toFixed(1)}%`} valueStyle={{ fontSize: 18, color: C.red }} /></Col>
        <Col span={4}><Statistic title="标准符合" value={thdi <= 5 ? '✓ IEEE+IEC' : thdi <= 8 ? '✓ IEC(⚠IEEE)' : '✗双超标'} valueStyle={{ fontSize: 13, color: thdi <= 5 ? C.green : thdi <= 8 ? C.orange : C.red }} /></Col>
        <Col span={8}><Text style={{ fontSize: 10, color: C.medium }}>THDi ∝ 1/N(脉冲比) × 调制因子 × 死区因子。N = f_sw/f_out = {N.toFixed(0)}</Text></Col>
      </Row>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Spectrum chart */}
        <div style={{ flex: '1 1 0', minWidth: 320, background: '#F8F9FA', borderRadius: 10, padding: 12 }}>
          <Text strong style={{ fontSize: 13 }}>
            谐波频谱 ({dev === 'igbt' ? 'IGBT' : 'SiC'} 当前，
            <span style={{ color: C.orange }}>橙色参考 = {dev === 'igbt' ? 'SiC' : 'IGBT'}</span>)
          </Text>
          <svg viewBox="0 0 720 220" width="100%" style={{ maxWidth: 740 }}>
            <line x1={42} y1={198} x2={700} y2={198} stroke={C.dark} strokeWidth={1.5} />
            <line x1={42} y1={30} x2={42} y2={198} stroke={C.dark} strokeWidth={1.5} />
            <text x={320} y={218} textAnchor="middle" fontSize={11} fill={C.dark}>谐波次数 h</text>
            <text x={14} y={115} textAnchor="middle" fontSize={11} fill={C.dark} transform="rotate(-90,14,115)">幅值 (%基波)</text>
            {[20, 40, 60, 80, 100].map(pct => (
              <line key={pct} x1={42} y1={198 - pct / 100 * 160} x2={700} y2={198 - pct / 100 * 160} stroke={C.light} strokeWidth={1} strokeDasharray="4,3" />
            ))}
            {spec.map((s, i) => {
              const x = 42 + i * 45; const h = Math.max(2, s.amp / 100 * 160);
              const altAmp = s.amp * (dev === 'igbt' ? 0.55 : 1.8); const h2 = Math.max(2, altAmp / 100 * 160);
              return (
                <g key={i}>
                  <rect x={x} y={198 - h} width={16} height={h} rx={3} fill={dev === 'sic' ? C.purple : C.blue} opacity={0.8} />
                  <rect x={x + 11} y={198 - h2} width={8} height={h2} rx={1} fill={C.orange} opacity={0.35} />
                  <text x={x + 8} y={214} textAnchor="middle" fontSize={10} fill={C.medium}>{s.order}</text>
                  {i === 0 ? <text x={x + 6} y={195 - h} fontSize={10} fontWeight="bold" fill={C.dark}>100%</text>
                   : s.amp > 3 && <text x={x + 8} y={195 - h} textAnchor="middle" fontSize={8} fill={C.medium}>{s.amp.toFixed(1)}%</text>}
                </g>
              );
            })}
            {/* Standards limits */}
            <line x1={42} y1={198 - (5 / 20) * 160} x2={700} y2={198 - (5 / 20) * 160} stroke={C.red} strokeWidth={1.5} strokeDasharray="6,3" />
            <text x={650} y={200 - (5 / 20) * 160 - 1} fontSize={10} fill={C.red} fontWeight="bold">IEEE 519-2022 ≤5%</text>
            <line x1={42} y1={198 - (8 / 20) * 160} x2={700} y2={198 - (8 / 20) * 160} stroke={C.red} strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />
            <text x={650} y={200 - (8 / 20) * 160 - 1} fontSize={10} fill={C.red} opacity={0.8}>IEC 61000-3-2 ≤8%</text>
            {/* Legend */}
            <rect x={48} y={28} width={12} height={12} rx={2} fill={dev === 'sic' ? C.purple : C.blue} opacity={0.8} />
            <text x={64} y={38} fontSize={10} fill={C.dark}>{dev === 'igbt' ? 'IGBT' : 'SiC'}</text>
            <rect x={140} y={28} width={12} height={12} rx={2} fill={C.orange} opacity={0.35} />
            <text x={156} y={38} fontSize={10} fill={C.medium}>{dev === 'igbt' ? 'SiC参考' : 'IGBT参考'}</text>
          </svg>
        </div>

        {/* Factors */}
        <div style={{ flex: '1 1 0', minWidth: 220, background: 'rgba(0,184,148,0.05)', borderRadius: 10, padding: 14, border: '1px solid rgba(0,184,148,0.15)' }}>
          <Text strong style={{ color: C.green, fontSize: 13 }}>THDi 影响因素</Text>
          <div style={{ fontSize: 11, color: C.medium, lineHeight: 2.2, marginTop: 6 }}>
            <div>• f_sw↑→N↑→ <strong style={{ color: C.green }}>THDi↓</strong></div>
            <div>• 调制比m↓ → 谐波含量↑</div>
            <div>• 死区时间↑ → 低次谐波↑</div>
            <div>• SiC可高频运行 → THDi↓</div>
            <div>• IGBT低次(5,7,11,13次)为主</div>
            <div>• SiC向高次迁移但幅值低</div>
            <div style={{ color: C.red, fontWeight: 'bold', marginTop: 8, fontSize: 12 }}>
              P_extra ∝ THDi² ≈ +{extraPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(0,184,148,0.05)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(0,184,148,0.12)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Text strong style={{ color: C.green, whiteSpace: 'nowrap', fontSize: 13 }}>THDi 要点</Text>
        <Text style={{ fontSize: 12, color: C.medium, lineHeight: 1.7 }}>
          THDi 主要由<strong>开关频率与输出频率之比 (脉冲数 N)</strong>决定：N 越大 THDi 越低。
          <strong style={{ color: C.blue }}>IGBT</strong> 通常 2~8kHz，低次谐波 (5,7,11,13次) 占主导；
          <strong style={{ color: C.purple }}>SiC MOSFET</strong> 可在 16~30kHz 运行，低次谐波大幅降低。
          调制比降低和死区增大均恶化 THDi。谐波导致<strong style={{ color: C.red }}>额外铜损和铁损</strong>（∝ THDi²）。
          <strong>IEEE 519-2022</strong> 要求 THDi≤5%，<strong>IEC 61000-3-2</strong> 要求 ≤8%。
        </Text>
      </div>
    </div>
  );
}

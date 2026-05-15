import { useState, useMemo } from 'react';
import { Slider, Typography, Statistic, Row, Col, Tag, Select, Tooltip } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', purple: '#6C5CE7', red: '#D63031', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

// Device presets — characteristic switching parameters
const DEVICE_PRESETS: Record<string, { label: string; eonBase: number; eoffBase: number; rg: number; color: string; desc: string }> = {
  igbt_m:  { label: 'IGBT 模块 1200V/100A', eonBase: 15, eoffBase: 10, rg: 10, color: '#1677ff', desc: 'Eon=15mJ Eoff=10mJ @100A' },
  igbt_d:  { label: 'IGBT 单管 600V/40A',  eonBase: 0.5, eoffBase: 0.3, rg: 10, color: '#0958d9', desc: 'Eon=0.5mJ Eoff=0.3mJ @40A' },
  ipm:     { label: 'IPM 模块 600V/50A',    eonBase: 3.5, eoffBase: 2.5, rg: 10, color: '#597ef7', desc: 'Eon=3.5mJ Eoff=2.5mJ @50A' },
  sic_m:   { label: 'SiC 模块 1200V/100A',  eonBase: 1.8, eoffBase: 1.2, rg: 5,  color: '#00B894', desc: 'Eon=1.8mJ Eoff=1.2mJ @100A' },
  sic_d:   { label: 'SiC 单管 1200V/50A',   eonBase: 0.9, eoffBase: 0.6, rg: 5,  color: '#55EFC4', desc: 'Eon=0.9mJ Eoff=0.6mJ @50A' },
};

export default function SwitchingLossDiagram() {
  const [device, setDevice] = useState('igbt_m');
  const preset = DEVICE_PRESETS[device];
  const [ic, setIc] = useState(100);
  const [fsw, setFsw] = useState(4);
  const [rg, setRg] = useState(preset.rg);
  const [vdc, setVdc] = useState(600);

  const handleDeviceChange = (key: string) => {
    setDevice(key);
    const p = DEVICE_PRESETS[key];
    setRg(p.rg);
    // Reset Ic to a reasonable value for the device
    if (key.includes('sic_d') || key.includes('igbt_d')) setIc(40);
    else if (key === 'ipm') setIc(50);
    else setIc(100);
  };

  const isSiC = device.startsWith('sic');
  const p = DEVICE_PRESETS[device];
  const eon = p.eonBase * (ic / 100) * (rg / p.rg) * (vdc / 600);
  const eoff = p.eoffBase * (ic / 100) * (rg / p.rg) * (vdc / 600) * 0.85;
  const pSw = fsw * 1000 * (eon + eoff) / 1000;
  const pSw6 = pSw * 6;
  const sf = 10 / rg, n = 100;

  const vPts = useMemo(() => Array.from({ length: n }, (_, i) => {
    const t = i / n; const v = 1 - (1 - Math.exp(-t * 5 * sf)) * (1 + 0.15 * Math.sin(t * 12));
    return `${40 + t * 240},${45 + (1 - Math.max(0, Math.min(1, v))) * 100}`;
  }).join(' '), [sf]);
  const iPts = useMemo(() => Array.from({ length: n }, (_, i) => {
    const t = i / n; const iv = 1 - Math.exp(-t * 4 * sf * 0.8);
    return `${40 + t * 240},${145 - Math.max(0, Math.min(1, iv)) * 85}`;
  }).join(' '), [sf]);

  const freqs = [fsw, fsw * 1.5, fsw * 2].map((f, i) => {
    const loss = f * 1000 * (eon + eoff) / 1000;
    return { f, loss, color: [C.red, '#FF7675', '#FAB1A0'][i] };
  });

  return (
    <div>
      {/* Device selector */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 13 }}>器件选择:</Text>
        <Select value={device} onChange={handleDeviceChange} style={{ width: 260 }} size="small"
          options={Object.entries(DEVICE_PRESETS).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Tag color={isSiC ? 'green' : 'blue'} style={{ fontSize: 12 }}>{p.desc}</Tag>
        <Tag color="purple">Rg={rg}Ω</Tag>
      </div>

      {/* Controls */}
      <Row gutter={10} style={{ marginBottom: 10 }}>
        <Col span={6}>
          <Tooltip title="集电极/漏极电流（Collector/Drain Current）。开关过程中的电流幅值。电流越大，开关能量 Eon/Eoff 越大（近似正比关系）。">
            <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>Ic: {ic}A</Text>
          </Tooltip>
          <Slider min={5} max={300} value={ic} onChange={setIc} style={{ margin: 0 }} /></Col>
        <Col span={6}>
          <Tooltip title="开关频率（Switching Frequency）。每秒开关次数，单位 kHz。P_sw = f_sw × (Eon+Eoff)，开关损耗与频率成正比。提高 f_sw 可降低 THDi，但增加开关损耗。">
            <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>f_sw: {fsw.toFixed(1)}kHz</Text>
          </Tooltip>
          <Slider min={1} max={30} step={0.5} value={fsw} onChange={setFsw} style={{ margin: 0 }} /></Col>
        <Col span={6}>
          <Tooltip title="栅极电阻（Gate Resistance）。控制 IGBT/MOSFET 开关速度。Rg 越大→开关越慢→Eon/Eoff 越大→开关损耗增加，但 EMI 降低。需要在损耗和 EMI 之间权衡。">
            <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>Rg: {rg}Ω</Text>
          </Tooltip>
          <Slider min={1} max={47} value={rg} onChange={setRg} style={{ margin: 0 }} /></Col>
        <Col span={6}>
          <Tooltip title="直流母线电压（DC-link Voltage）。逆变器直流侧电压，通常 300~800V。Vdc 越高→开关过程中 Vce/Id 交叠面积越大→开关能量越大。">
            <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>Vdc: {vdc}V</Text>
          </Tooltip>
          <Slider min={200} max={1200} step={50} value={vdc} onChange={setVdc} style={{ margin: 0 }} /></Col>
      </Row>

      {/* Loss comparison across device types */}
      <div style={{ marginBottom: 12, background: '#F8F9FA', borderRadius: 8, padding: 10 }}>
        <Text strong style={{ fontSize: 12, color: C.medium }}>不同器件的开关损耗对比 (@ Ic=100A, fsw=4kHz):</Text>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {Object.entries(DEVICE_PRESETS).map(([k, v]) => {
            const eonK = v.eonBase * (100 / 100) * (v.rg / v.rg) * (600 / 600);
            const eoffK = v.eoffBase * (100 / 100) * (v.rg / v.rg) * (600 / 600) * 0.85;
            const lossK = 4 * 1000 * (eonK + eoffK) / 1000;
            const maxLoss = 200; // scale to 200W
            const w = Math.max(4, (lossK / maxLoss) * 100);
            const isCurrent = k === device;
            return (
              <div key={k} style={{ flex: '1 1 100px', minWidth: 80, cursor: 'pointer' }} onClick={() => handleDeviceChange(k)}>
                <div style={{ fontSize: 10, color: C.medium, marginBottom: 2 }}>{v.label.split(' ')[0]}</div>
                <div style={{ height: 26, width: `${w}%`, minWidth: 40, background: isCurrent ? C.red : '#d9d9d9', borderRadius: 4,
                  display: 'flex', alignItems: 'center', paddingLeft: 6, opacity: isCurrent ? 0.9 : 0.5 }}>
                  <Text style={{ color: isCurrent ? '#fff' : '#666', fontSize: 11, fontWeight: 'bold' }}>{lossK.toFixed(0)}W</Text>
                </div>
              </div>
            );
          })}
        </div>
        <Text style={{ fontSize: 10, color: C.green, marginTop: 4, display: 'block' }}>
          {isSiC ? '✓ SiC 开关能量仅为同等级 IGBT 的 1/8~1/10' : 'IGBT 开关损耗较高，考虑 SiC 替代可大幅降低开关损耗'}
        </Text>
      </div>

      {/* Stats */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}><Statistic title="Eon" value={`${eon.toFixed(1)}mJ`} valueStyle={{ fontSize: 16, color: C.red }} /></Col>
        <Col span={5}><Statistic title="Eoff" value={`${eoff.toFixed(1)}mJ`} valueStyle={{ fontSize: 16, color: C.orange }} /></Col>
        <Col span={5}><Statistic title="单管 P_sw" value={`${pSw.toFixed(0)}W`} valueStyle={{ fontSize: 16, color: C.red }} /></Col>
        <Col span={5}><Statistic title="6管总 P_sw" value={`${pSw6.toFixed(0)}W`} valueStyle={{ fontSize: 16, color: '#a8071a' }} /></Col>
        <Col span={4}><Tag color={rg > 15 ? 'orange' : 'green'} style={{ fontSize: 12 }}>{rg > 15 ? '慢速→EMI↓' : '快速→EMI↑'}</Tag></Col>
      </Row>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Waveform */}
        <div style={{ flex: '1 1 0', minWidth: 280, background: '#F8F9FA', borderRadius: 10, padding: 12 }}>
          <Text strong style={{ color: C.blue, fontSize: 13 }}>单次开关过程 (开通) — {isSiC ? 'SiC 极快' : `Rg=${rg}Ω 较慢`}</Text>
          <svg viewBox="0 0 320 200" width="100%" style={{ maxWidth: 400 }}>
            <line x1={40} y1={145} x2={300} y2={145} stroke={C.dark} strokeWidth={1} />
            <line x1={40} y1={40} x2={40} y2={145} stroke={C.dark} strokeWidth={1} />
            <polyline points={vPts} fill="none" stroke={C.blue} strokeWidth={2.5} />
            <polyline points={iPts} fill="none" stroke={C.red} strokeWidth={2.5} />
            <text x={60} y={95} fontSize={13} fontWeight="bold" fill={C.red}>Eon = ∫Vce×Ic dt</text>
            <text x={60} y={112} fontSize={12} fill={C.red}>= {eon.toFixed(1)}mJ</text>
            <text x={140} y={38} fontSize={12} fill={C.blue} fontWeight="bold">Vce↓</text>
            <text x={140} y={158} fontSize={12} fill={C.red} fontWeight="bold">Ic↑</text>
            <text x={40} y={172} fontSize={10} fill={C.medium}>开关时间 ~{rg > 10 ? (rg/2).toFixed(0) : '1-2'}百ns · 交叠面积=开关能量</text>
          </svg>
        </div>

        {/* Frequency impact */}
        <div style={{ flex: '1 1 0', minWidth: 240, background: '#F8F9FA', borderRadius: 10, padding: 12 }}>
          <Text strong style={{ color: C.green, fontSize: 13 }}>f_sw 对总损耗的影响</Text>
          <svg viewBox="0 0 200 170" width="100%" style={{ maxWidth: 280 }}>
            <line x1={20} y1={145} x2={190} y2={145} stroke={C.dark} strokeWidth={1} />
            {freqs.map((f, i) => {
              const maxLoss = Math.max(...freqs.map(x => x.loss), 1);
              const h = Math.max(12, f.loss / maxLoss * 100);
              const x = 22 + i * 56;
              return (
                <g key={i}>
                  <rect x={x} y={145 - h} width={22} height={h} rx={4} fill={f.color} opacity={0.85} />
                  <text x={x + 11} y={145 - h - 6} textAnchor="middle" fontSize={11} fontWeight="bold" fill={f.color}>{f.loss.toFixed(0)}W</text>
                  <text x={x + 11} y={160} textAnchor="middle" fontSize={10} fill={C.dark}>{f.f.toFixed(1)}k</text>
                  <text x={x + 11} y={170} textAnchor="middle" fontSize={9} fill={C.medium}>{i===0?'当前':i===1?'×1.5':'×2'}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ background: 'rgba(108,92,231,0.07)', borderRadius: 8, padding: 10, marginTop: 4, border: '1px solid rgba(108,92,231,0.15)' }}>
            <div style={{ fontSize: 12, color: C.purple, fontWeight: 'bold' }}>P_sw = f_sw×(Eon+Eoff)</div>
            <div style={{ fontSize: 10, color: C.medium, marginTop: 4 }}>
              {isSiC
                ? <><strong style={{ color: C.green }}>SiC优势</strong>：fsw可提升至16-30kHz仍保持低损耗。相同损耗下频率可达IGBT的5-10倍。</>
                : <>Rg↑→开关慢→E↑但EMI↓。需权衡。<strong style={{ color: C.red }}>高频下IGBT开关损耗急剧增加</strong>。</>
              }
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(9,132,227,0.05)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(9,132,227,0.12)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Text strong style={{ color: C.blue, whiteSpace: 'nowrap', fontSize: 13 }}>要点</Text>
        <Text style={{ fontSize: 12, color: C.medium, lineHeight: 1.7 }}>
          开关损耗 = <strong style={{ color: C.red }}>f_sw × (Eon + Eoff)</strong>。
          Vce下降与Ic上升交叠产生瞬时功率尖峰，积分 = 开关能量。
          <strong style={{ color: C.green }}>SiC MOSFET</strong> 开关能量仅为同等级IGBT的 1/8~1/10，可在更高频率下运行而损耗不显著增加。
          增大Rg减缓开关速度、降低EMI，但增加开关能量——<strong>需权衡</strong>。切换上方器件类型对比不同器件的开关损耗差异。
        </Text>
      </div>
    </div>
  );
}

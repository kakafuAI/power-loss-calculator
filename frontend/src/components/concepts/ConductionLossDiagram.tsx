import { useState, useEffect } from 'react';
import { Slider, Typography, Tag, Statistic, Row, Col, Tooltip, Select } from 'antd';
import type { ModuleConfig, OperatingConditions } from '../../types';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', purple: '#6C5CE7', red: '#D63031', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9' };

const DEVICE_PRESETS: Record<string, { label: string; ic: number; vce: number; vf: number; duty: number; color: string }> = {
  igbt_m:  { label: 'IGBT 模块 1200V/100A', ic: 80, vce: 2.0, vf: 1.7, duty: 0.70, color: '#1677ff' },
  igbt_d:  { label: 'IGBT 单管 600V/40A',  ic: 30, vce: 1.45, vf: 1.4, duty: 0.65, color: '#0958d9' },
  ipm:     { label: 'IPM 模块 600V/50A',    ic: 40, vce: 1.5, vf: 1.5, duty: 0.70, color: '#597ef7' },
  sic_m:   { label: 'SiC 模块 1200V/100A',  ic: 80, vce: 0.08, vf: 1.35, duty: 0.70, color: '#00B894' },
  sic_d:   { label: 'SiC 单管 1200V/50A',   ic: 40, vce: 0.04, vf: 1.2, duty: 0.65, color: '#55EFC4' },
};

interface Props { config?: ModuleConfig; conditions?: OperatingConditions; }

// Half-bridge conduction states
const STATES = [
  { key: 0, label: 'T1 导通', color: 'blue', desc: '上管IGBT/SiC导通', loss: (vce: number, ic: number, duty: number, isSiC: boolean) => isSiC ? ic*ic*vce*duty : vce*ic*duty },
  { key: 1, label: '死区', color: 'orange', desc: 'T1/T2均关断→二极管续流', loss: () => 0 },
  { key: 2, label: 'D1 续流', color: 'green', desc: '上管反并联二极管续流', loss: (vce: number, ic: number, duty: number, isSiC: boolean, vf: number) => vf*ic*(1-duty) },
  { key: 3, label: 'T2 导通', color: 'blue', desc: '下管IGBT/SiC导通', loss: (vce: number, ic: number, duty: number, isSiC: boolean) => isSiC ? ic*ic*vce*duty : vce*ic*duty },
  { key: 4, label: 'D2 续流', color: 'green', desc: '下管反并联二极管续流', loss: (vce: number, ic: number, duty: number, isSiC: boolean, vf: number) => vf*ic*(1-duty) },
];

export default function ConductionLossDiagram({ config, conditions }: Props) {
  const isDeviceSiC = config?.device_type?.startsWith('sic');
  const isDeviceIGBT = config?.device_type?.startsWith('igbt') || config?.device_type === 'ipm_module';
  const initIc = conditions?.i_out_rms ? Math.round(conditions.i_out_rms * 1.4) : (config?.ic_rated ? Math.round(config.ic_rated * 0.6) : 80);
  const initVce = isDeviceSiC ? 0.02 : ((config?.igbt?.vce_sat_125) ?? 2.0);
  const initVf = isDeviceSiC ? ((config?.sic_diode?.vsd_125) ?? 1.35) : ((config?.diode?.vf_125) ?? 1.7);
  const initDuty = 0.70;

  const [device, setDevice] = useState(isDeviceSiC ? 'sic_m' : 'igbt_m');
  const preset = DEVICE_PRESETS[device];
  const [state, setState] = useState(0);
  const [duty, setDuty] = useState(initDuty);
  const [ic, setIc] = useState(initIc);
  const [vce, setVce] = useState(initVce);
  const [vf, setVf] = useState(initVf);
  const [off, setOff] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(function l() { setOff(p => (p + 0.4) % 40); requestAnimationFrame(l); }); return () => cancelAnimationFrame(id); }, []);

  // Sync with actual device config
  useEffect(() => {
    if (config) {
      setIc(initIc); setVce(initVce); setVf(initVf);
    }
  }, [config?.igbt?.vce_sat_125, config?.sic_mos?.rds_on_125, config?.diode?.vf_125, config?.sic_diode?.vsd_125, config?.ic_rated]);

  const handleDeviceChange = (key: string) => {
    setDevice(key); const p = DEVICE_PRESETS[key];
    setIc(p.ic); setVce(p.vce); setVf(p.vf); setDuty(p.duty);
  };

  const isSiC = device.startsWith('sic');
  const pI = isSiC ? (ic * ic * (vce) * duty) : (vce * ic * duty);
  const pD = vf * ic * (1 - duty);
  const rthTotal = isSiC ? 0.5 : 0.3;
  const tJ = 40 + (pI + pD) * rthTotal;

  // Which switches are active for current state
  const t1On = state === 0;
  const d1On = state === 2;
  const t2On = state === 3;
  const d2On = state === 4;
  const deadTime = state === 1;
  const currentUp = state < 3; // T1/D1 carry current upward to DC+

  return (
    <div>
      {/* Device + State selector */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 13 }}>器件:</Text>
        <Select value={device} onChange={handleDeviceChange} style={{ width: 240 }} size="small"
          options={Object.entries(DEVICE_PRESETS).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Tag color={isSiC ? 'green' : 'blue'} style={{ fontSize: 12 }}>
          {isSiC ? `Rds(on)=${(vce*1000).toFixed(0)}mΩ` : `Vce(sat)=${vce.toFixed(2)}V`}
        </Tag>
        <Tag color="orange">Vf={vf.toFixed(2)}V</Tag>
      </div>

      {/* State tags */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 13 }}>半桥工作状态: </Text>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {STATES.map((s) => (
            <Tag key={s.key} color={state === s.key ? s.color as any : 'default'}
              style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 12 }}
              onClick={() => setState(s.key)}>{s.label}</Tag>
          ))}
        </div>
        <div style={{ marginTop: 6 }}>
          <Tag color={STATES[state].color as any} style={{ fontSize: 13 }}>{STATES[state].desc}</Tag>
          <Text strong style={{ color: C.red, marginLeft: 8, fontSize: 13 }}>
            导通损耗 ≈ {STATES[state].loss(vce, ic, duty, isSiC, vf).toFixed(0)}W
          </Text>
        </div>
      </div>

      {/* Controls */}
      <Row gutter={10} style={{ marginBottom: 12 }}>
        <Col span={5}><Tooltip title="集电极/漏极电流有效值。电流越大，导通损耗越大（IGBT: P∝I，SiC: P∝I²）。">
          <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>Ic: {ic}A</Text></Tooltip>
          <Slider min={5} max={200} value={ic} onChange={setIc} style={{ margin: 0 }} /></Col>
        <Col span={5}><Tooltip title={isSiC ? 'SiC导通电阻。P=Id²×Rds×D。温度系数远小于IGBT。' : 'IGBT饱和压降。P=Vce×Ic×D。正温度系数，随Tj升高而增大。'}>
          <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>
            {isSiC ? `Rds(on): ${(vce*1000).toFixed(0)}mΩ` : `Vce(sat): ${vce.toFixed(2)}V`}</Text></Tooltip>
          <Slider min={isSiC ? 2 : 0.5} max={isSiC ? 200 : 4.0} step={isSiC ? 2 : 0.05}
            value={isSiC ? vce * 1000 : vce} onChange={v => setVce(isSiC ? (v as number) / 1000 : v as number)} style={{ margin: 0 }} /></Col>
        <Col span={5}><Tooltip title="续流二极管正向压降。P_Diode=Vf×Ic×(1−D)。Vf越低续流损耗越小。">
          <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>Vf: {vf.toFixed(2)}V</Text></Tooltip>
          <Slider min={0.5} max={3.0} step={0.05} value={vf} onChange={setVf} style={{ margin: 0 }} /></Col>
        <Col span={5}><Tooltip title="占空比。上管导通占比。D越大→IGBT/SiC导通越长，(1−D)越大→二极管续流越长。">
          <Text strong style={{ fontSize: 12, cursor: 'help', borderBottom: '1px dotted #999' }}>D: {duty.toFixed(2)}</Text></Tooltip>
          <Slider min={0.1} max={0.95} step={0.05} value={duty} onChange={setDuty} style={{ margin: 0 }} /></Col>
        <Col span={4}><Statistic title="估算Tj" value={`${tJ.toFixed(0)}°C`} valueStyle={{ fontSize: 18, color: tJ > 150 ? C.red : C.green }} /></Col>
      </Row>

      {/* Device comparison bar */}
      <div style={{ marginBottom: 12, background: '#F8F9FA', borderRadius: 8, padding: 10 }}>
        <Text strong style={{ fontSize: 12, color: C.medium }}>不同器件导通损耗对比 (@ Ic=80A, D=0.7):</Text>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {Object.entries(DEVICE_PRESETS).map(([k, v]) => {
            const loss = k.startsWith('sic') ? (80*80*v.vce*0.7) : (v.vce*80*0.7);
            const maxLoss = 200; const w = Math.max(4, (loss/maxLoss)*100);
            return (
              <div key={k} style={{ flex: '1 1 100px', minWidth: 80, cursor: 'pointer' }} onClick={() => handleDeviceChange(k)}>
                <div style={{ fontSize: 10, color: C.medium, marginBottom: 2 }}>{v.label.split(' ')[0]}</div>
                <div style={{ height: 26, width: `${w}%`, minWidth: 40, background: k===device?C.red:'#d9d9d9', borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 6, opacity: k===device?0.9:0.5 }}>
                  <Text style={{ color: k===device?'#fff':'#666', fontSize: 11, fontWeight: 'bold' }}>{loss.toFixed(0)}W</Text>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Circuit — IEC 60617 standard diode symbols (hollow triangle) */}
        <div style={{ flex: '1 1 0', minWidth: 280, background: '#F8F9FA', borderRadius: 10, padding: 10 }}>
          <Text strong style={{ color: C.blue, fontSize: 13 }}>半桥电路 (IEC 60617 符号)</Text>
          <svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 360, display: 'block', margin: '0 auto' }}>
            <defs><marker id="ac" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill={C.green} /></marker></defs>
            {/* DC bus */}
            <line x1={20} y1={18} x2={150} y2={18} stroke={C.dark} strokeWidth={2.5} /><text x={85} y={12} textAnchor="middle" fontSize={13} fontWeight="bold" fill={C.dark}>DC+</text>
            <line x1={20} y1={302} x2={150} y2={302} stroke={C.dark} strokeWidth={2.5} /><text x={85} y={318} textAnchor="middle" fontSize={13} fontWeight="bold" fill={C.dark}>DC−</text>
            {/* Cdc */}
            <rect x={152} y={16} width={14} height={288} rx={3} fill="rgba(9,132,227,0.06)" stroke={C.blue} strokeWidth={1.5} />
            <text x={159} y={165} textAnchor="middle" fontSize={8} fill={C.blue} transform="rotate(-90,159,165)">Cdc</text>
            {/* Wires */}
            <line x1={166} y1={21} x2={200} y2={21} stroke="#888" strokeWidth={1.5} />
            <line x1={166} y1={299} x2={200} y2={299} stroke="#888" strokeWidth={1.5} />

            {/* ── T1 IGBT (upper) ── */}
            <Tooltip title={`T1: ${t1On?'导通中':'关断'} | ${isSiC?'Rds(on)':'Vce(sat)'}产生导通损耗`}>
              <g>
                <line x1={200} y1={28} x2={200} y2={42} stroke={t1On?C.blue:C.medium} strokeWidth={2} />
                <rect x={182} y={42} width={36} height={36} rx={4} fill={t1On?'rgba(9,132,227,0.2)':'rgba(200,200,200,0.1)'} stroke={t1On?C.blue:C.medium} strokeWidth={2} />
                <text x={200} y={64} textAnchor="middle" fontSize={13} fontWeight="bold" fill={t1On?C.blue:C.medium}>T1</text>
                <line x1={200} y1={78} x2={200} y2={92} stroke={t1On?C.blue:C.medium} strokeWidth={2} />
                <line x1={182} y1={56} x2={168} y2={56} stroke={C.dark} strokeWidth={1.5} /><circle cx={164} cy={56} r={4} fill="#F8F9FA" stroke={C.dark} strokeWidth={1.5} />
                {t1On && <rect x={182} y={42} width={36} height={36} rx={4} fill={C.blue} opacity={0.1}><animate attributeName="opacity" values="0.05;0.2;0.05" dur="2s" repeatCount="indefinite" /></rect>}
              </g>
            </Tooltip>

            {/* ── D1 — IEC 60617 hollow triangle, cathode UP (bar at top) ── */}
            <Tooltip title={`D1: ${d1On?'续流中':'反偏截止'} | 续流时Vf产生损耗`}>
              <g>
                <line x1={240} y1={36} x2={240} y2={44} stroke={d1On?C.orange:C.medium} strokeWidth={2} />
                <polygon points={`240,68 234,46 246,46`} fill="none" stroke={d1On?C.orange:C.medium} strokeWidth={2} />
                <line x1={232} y1={46} x2={248} y2={46} stroke={d1On?C.orange:C.medium} strokeWidth={2.5} />
                <text x={240} y={78} textAnchor="middle" fontSize={10} fontWeight="bold" fill={d1On?C.orange:C.medium}>D1</text>
              </g>
            </Tooltip>

            {/* Phase node */}
            <circle cx={200} cy={160} r={8} fill={C.red} />
            <text x={200} y={148} textAnchor="middle" fontSize={10} fill={C.red} fontWeight="bold">L</text>
            <text x={225} y={165} fontSize={14} fontWeight="bold" fill={C.dark}>→ i_load</text>

            {/* ── T2 IGBT (lower) ── */}
            <Tooltip title={`T2: ${t2On?'导通中':'关断'} | 互补管，与T1交替工作`}>
              <g>
                <line x1={200} y1={192} x2={200} y2={205} stroke={t2On?C.blue:C.medium} strokeWidth={2} />
                <rect x={182} y={205} width={36} height={36} rx={4} fill={t2On?'rgba(9,132,227,0.2)':'rgba(200,200,200,0.1)'} stroke={t2On?C.blue:C.medium} strokeWidth={2} />
                <text x={200} y={227} textAnchor="middle" fontSize={13} fontWeight="bold" fill={t2On?C.blue:C.medium}>T2</text>
                <line x1={200} y1={241} x2={200} y2={256} stroke={t2On?C.blue:C.medium} strokeWidth={2} />
                <line x1={182} y1={219} x2={168} y2={219} stroke={C.dark} strokeWidth={1.5} /><circle cx={164} cy={219} r={4} fill="#F8F9FA" stroke={C.dark} strokeWidth={1.5} />
                {t2On && <rect x={182} y={205} width={36} height={36} rx={4} fill={C.blue} opacity={0.1}><animate attributeName="opacity" values="0.05;0.2;0.05" dur="2s" repeatCount="indefinite" /></rect>}
              </g>
            </Tooltip>

            {/* ── D2 — IEC 60617 hollow triangle, cathode UP (bar at top, pointing toward phase) ── */}
            <Tooltip title={`D2: ${d2On?'续流中':'反偏截止'}`}>
              <g>
                <line x1={240} y1={200} x2={240} y2={208} stroke={d2On?C.orange:C.medium} strokeWidth={2} />
                <polygon points={`240,232 234,210 246,210`} fill="none" stroke={d2On?C.orange:C.medium} strokeWidth={2} />
                <line x1={232} y1={210} x2={248} y2={210} stroke={d2On?C.orange:C.medium} strokeWidth={2.5} />
                <text x={240} y={242} textAnchor="middle" fontSize={10} fontWeight="bold" fill={d2On?C.orange:C.medium}>D2</text>
              </g>
            </Tooltip>

            {/* Phase connections */}
            <line x1={200} y1={92} x2={200} y2={152} stroke={C.dark} strokeWidth={2} />
            <line x1={200} y1={168} x2={200} y2={192} stroke={C.dark} strokeWidth={2} />
            <line x1={240} y1={68} x2={200} y2={160} stroke={C.dark} strokeWidth={2} />
            <line x1={240} y1={232} x2={200} y2={160} stroke={C.dark} strokeWidth={2} />
            <line x1={200} y1={256} x2={200} y2={299} stroke={C.dark} strokeWidth={2} />
            <line x1={240} y1={232} x2={240} y2={299} stroke={C.dark} strokeWidth={2} />

            {/* Current path */}
            {t1On && <path d={`M20,302 L200,256 L200,168 L240,68 L240,44 L200,42 L200,21 L166,21`} stroke={C.green} strokeWidth={3.5} fill="none" markerEnd="url(#ac)" strokeDasharray="8,5" strokeDashoffset={-off} opacity={0.75} />}
            {t2On && <path d={`M20,18 L200,42 L200,168 L240,232 L240,210 L200,205 L200,256 L166,299`} stroke={C.green} strokeWidth={3.5} fill="none" markerEnd="url(#ac)" strokeDasharray="8,5" strokeDashoffset={-off} opacity={0.75} />}
            {d1On && <path d={`M20,302 L200,256 L200,168 L240,68 L240,44 L200,42 L200,21 L166,21`} stroke={C.orange} strokeWidth={3.5} fill="none" markerEnd="url(#ac)" strokeDasharray="8,5" strokeDashoffset={-off} opacity={0.7} />}
            {d2On && <path d={`M20,18 L200,42 L200,168 L240,232 L240,210 L200,205 L200,256 L166,299`} stroke={C.orange} strokeWidth={3.5} fill="none" markerEnd="url(#ac)" strokeDasharray="8,5" strokeDashoffset={-off} opacity={0.7} />}

            {/* Dead time indicator */}
            {deadTime && <rect x={182} y={92} width={36} height={68} rx={6} fill="none" stroke={C.orange} strokeWidth={2} strokeDasharray="6,3"><animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite" /></rect>}
          </svg>
        </div>

        {/* Right panel */}
        <div style={{ flex: '1 1 0', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'rgba(214,48,49,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(214,48,49,0.15)' }}>
            <Text strong style={{ color: C.red, fontSize: 13 }}>损耗分布 (Ic={ic}A, D={duty.toFixed(2)})</Text>
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ background: C.red, height: 30, width: `${Math.max(8, pI/(pI+pD+1)*100)}%`, minWidth: isSiC?40:80, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 10, opacity: 0.85 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                    {isSiC?'SiC 导通':'IGBT 导通'}: {pI.toFixed(0)}W
                  </Text>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ background: C.orange, height: 30, width: `${Math.max(8, pD/(pI+pD+1)*100)}%`, minWidth: 80, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 10, opacity: 0.85 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Diode 续流: {pD.toFixed(0)}W</Text>
                </div>
              </div>
            </div>
            <Text style={{ fontSize: 14, color: C.dark, marginTop: 8, display: 'block' }}>总导通损耗 = <strong style={{ color: C.red }}>{(pI+pD).toFixed(0)}W</strong></Text>
          </div>
          <div style={{ background: '#F8F9FA', borderRadius: 8, padding: 12 }}>
            <Text strong style={{ fontSize: 13 }}>占空比分配</Text>
            <div style={{ height: 36, background: '#f0f0f0', borderRadius: 6, marginTop: 6, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${duty*100}%`, background: C.blue, borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>T_IGBT/SiC ON: {(duty*100).toFixed(0)}%</Text>
              </div>
              <div style={{ position: 'absolute', left: `${duty*100}%`, top: 0, height: '100%', width: `${(1-duty)*100}%`, background: C.orange, borderRadius: '0 6px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.65 }}>
                <Text style={{ color: C.dark, fontSize: 13, fontWeight: 'bold' }}>Diode ON: {((1-duty)*100).toFixed(0)}%</Text>
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(225,112,85,0.06)', borderRadius: 8, padding: 12, border: '1px solid rgba(225,112,85,0.15)' }}>
            <Text style={{ fontSize: 13, color: C.dark, lineHeight: 2 }}>
              {isSiC
                ? <>P_SiC = Id²×Rds×D = <strong style={{ color: C.red }}>{ic}²×{(vce*1000).toFixed(0)}mΩ×{duty.toFixed(2)} = {pI.toFixed(0)}W</strong></>
                : <>P_IGBT = Vce×Ic×D = <strong style={{ color: C.red }}>{vce.toFixed(2)}×{ic}×{duty.toFixed(2)} = {pI.toFixed(0)}W</strong></>
              }<br />
              P_Diode = Vf×Ic×(1−D) = <strong style={{ color: C.orange }}>{vf.toFixed(2)}×{ic}×{(1-duty).toFixed(2)} = {pD.toFixed(0)}W</strong>
            </Text>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(108,92,231,0.05)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(108,92,231,0.12)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Text strong style={{ color: C.purple, whiteSpace: 'nowrap', fontSize: 13 }}>导通与续流</Text>
        <Text style={{ fontSize: 12, color: C.medium, lineHeight: 1.7 }}>
          半桥两管<strong>严格互补导通</strong>，死区期间二极管续流。<strong style={{ color: C.blue }}>IGBT导通</strong>→Vce(sat)损耗，
          <strong style={{ color: C.orange }}>二极管续流</strong>→Vf损耗。<strong style={{ color: C.red }}>死区</strong>防止上下管直通短路。
          续流结束后若互补管开通，二极管经历反向恢复（Qrr→Err损耗，参见开关损耗图）。
          点击上方<strong>状态标签</strong>切换T1导通/死区/D1续流/T2导通/D2续流，观察导电路径变化。
        </Text>
      </div>
    </div>
  );
}

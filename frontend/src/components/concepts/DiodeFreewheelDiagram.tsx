import { useState, useEffect } from 'react';
import { Typography, Tag, Tooltip, Row, Col } from 'antd';
const { Text } = Typography;
const C = { blue: '#0984E3', green: '#00B894', orange: '#E17055', purple: '#6C5CE7', red: '#D63031', dark: '#2D3436', medium: '#636E72', light: '#DFE6E9', yellow: '#FDCB6E' };

const steps = [
  { key: 't1_on', label: 'T1 导通', color: 'blue', desc: '上管IGBT导通→负载', loss: 'P = Vce(sat)×Ic×D(t)' },
  { key: 'dead', label: '死区', color: 'orange', desc: 'T1/T2均关断', loss: '短暂无导通损耗' },
  { key: 'd1_fw', label: 'D1 续流', color: 'green', desc: '上管D1续流', loss: 'P = Vf×If×(1−D(t))' },
  { key: 'rr', label: '反向恢复', color: 'red', desc: 'D1反向恢复Qrr', loss: 'P_rr = fsw×Err' },
  { key: 'shoot', label: '⚠ 直通风险', color: 'volcano', desc: 'T1/T2同时导通!', loss: '短路! 极高损耗' },
];

export default function DiodeFreewheelDiagram() {
  const [si, setSi] = useState(0);
  const [off, setOff] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(function l() { setOff(p => (p + 0.3) % 60); requestAnimationFrame(l); }); return () => cancelAnimationFrame(id); }, []);

  const s = steps[si];
  const t1 = si === 0; const d1 = si === 2 || si === 3; const t2 = si === 4; const dead = si === 1;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>半桥工作状态: </Text>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {steps.map((st, i) => (
            <Tag key={st.key} color={si === i ? st.color as any : 'default'}
              style={{ cursor: 'pointer', padding: '5px 14px', fontSize: 13 }}
              onClick={() => setSi(i)}>{st.label}</Tag>
          ))}
        </div>
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>← 点击切换状态 | 悬停器件查看详情</Text>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Circuit SVG */}
        <div style={{ flex: '0 0 370px', background: '#F8F9FA', borderRadius: 10, padding: 10 }}>
          <svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 370 }}>
            <defs><marker id="agf" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill={C.green} /></marker></defs>
            {/* DC bus */}
            <line x1={20} y1={18} x2={160} y2={18} stroke={C.dark} strokeWidth={2.5} /><text x={90} y={12} textAnchor="middle" fontSize={13} fontWeight="bold">DC+</text>
            <line x1={20} y1={302} x2={160} y2={302} stroke={C.dark} strokeWidth={2.5} /><text x={90} y={318} textAnchor="middle" fontSize={13} fontWeight="bold">DC−</text>
            {/* Cdc */}
            <rect x={160} y={15} width={16} height={290} rx={3} fill="rgba(9,132,227,0.06)" stroke={C.blue} strokeWidth={1.5} />
            <text x={168} y={165} textAnchor="middle" fontSize={9} fill={C.blue} transform="rotate(-90,168,165)">Cdc</text>

            {/* Wires */}
            <line x1={176} y1={21} x2={210} y2={21} stroke="#666" strokeWidth={1.5} />
            <line x1={176} y1={299} x2={210} y2={299} stroke="#666" strokeWidth={1.5} />

            {/* T1 */}
            <Tooltip title={t1 ? 'T1导通: Vce(sat)产生损耗' : 'T1关断'}>
              <g>
                <line x1={210} y1={30} x2={210} y2={42} stroke={t1 ? C.red : C.medium} strokeWidth={2} />
                <rect x={192} y={42} width={36} height={35} rx={4} fill={t1 ? 'rgba(214,48,49,0.2)' : 'rgba(200,200,200,0.1)'} stroke={t1 ? C.red : C.medium} strokeWidth={2} />
                <text x={210} y={63} textAnchor="middle" fontSize={13} fontWeight="bold" fill={t1 ? C.red : C.medium}>T1</text>
                <line x1={210} y1={77} x2={210} y2={90} stroke={t1 ? C.red : C.medium} strokeWidth={2} />
                <line x1={192} y1={56} x2={178} y2={56} stroke={C.dark} strokeWidth={1.5} />
                <circle cx={174} cy={56} r={4} fill="#F8F9FA" stroke={C.dark} strokeWidth={1.5} />
              </g>
            </Tooltip>
            {/* D1 — smaller, cross-line at cathode (top) */}
            <Tooltip title={d1 ? 'D1续流: Vf产生损耗' : 'D1反偏截止'}>
              <g>
                <line x1={250} y1={36} x2={250} y2={48} stroke={d1 ? C.orange : C.medium} strokeWidth={2} />
                <polygon points={`250,72 242,48 258,48`} fill={d1 ? 'rgba(225,112,85,0.2)' : 'rgba(200,200,200,0.1)'} stroke={d1 ? C.orange : C.medium} strokeWidth={2} />
                <line x1={240} y1={48} x2={260} y2={48} stroke={d1 ? C.orange : C.medium} strokeWidth={2} />
                <text x={250} y={80} textAnchor="middle" fontSize={10} fontWeight="bold" fill={d1 ? C.orange : C.medium}>D1</text>
              </g>
            </Tooltip>

            {/* Phase */}
            <circle cx={210} cy={160} r={8} fill={C.red} />
            <text x={210} y={150} textAnchor="middle" fontSize={10} fill={C.red} fontWeight="bold">L</text>
            <text x={245} y={165} fontSize={15} fontWeight="bold" fill={C.dark}>→ i_load</text>

            {/* T2 */}
            <rect x={192} y={190} width={36} height={35} rx={4} fill={t2 ? 'rgba(214,48,49,0.3)' : 'rgba(200,200,200,0.1)'} stroke={t2 ? C.red : C.medium} strokeWidth={2} />
            <text x={210} y={211} textAnchor="middle" fontSize={13} fontWeight="bold" fill={t2 ? C.red : C.medium}>T2</text>
            <line x1={210} y1={225} x2={210} y2={238} stroke={t2 ? C.red : C.medium} strokeWidth={2} />
            <line x1={192} y1={204} x2={178} y2={204} stroke={C.dark} strokeWidth={1.5} />
            <circle cx={174} cy={204} r={4} fill="#F8F9FA" stroke={C.dark} strokeWidth={1.5} />
            {/* D2 — smaller, cross-line at cathode (bottom) */}
            <polygon points={`250,198 242,222 258,222`} fill="rgba(200,200,200,0.1)" stroke={C.medium} strokeWidth={2} />
            <line x1={240} y1={222} x2={260} y2={222} stroke={C.medium} strokeWidth={2} />
            <text x={250} y={196} textAnchor="middle" fontSize={10} fontWeight="bold" fill={C.medium}>D2</text>

            {/* Phase connections */}
            <line x1={210} y1={90} x2={210} y2={152} stroke={C.dark} strokeWidth={2} />
            <line x1={210} y1={168} x2={210} y2={190} stroke={C.dark} strokeWidth={2} />
            <line x1={250} y1={72} x2={210} y2={160} stroke={C.dark} strokeWidth={2} />
            <line x1={250} y1={222} x2={210} y2={160} stroke={C.dark} strokeWidth={2} />

            {/* Current path */}
            {t1 && <path d={`M20,302 L210,238 L210,168 L250,72 L250,48 L210,42 L210,21 L176,21`} stroke={C.green} strokeWidth={3.5} fill="none" markerEnd="url(#agf)" strokeDasharray="10,5" strokeDashoffset={-off} opacity={0.75} />}
            {(si === 2 || si === 3) && <path d={`M20,302 L210,190 L250,160 L250,72 L210,90 L210,21 L176,21`} stroke={C.green} strokeWidth={3.5} fill="none" markerEnd="url(#agf)" strokeDasharray="10,5" strokeDashoffset={-off} opacity={0.75} />}

            {/* Shoot-through */}
            {t2 && <>
              <rect x={100} y={148} width={140} height={28} rx={7} fill="rgba(214,48,49,0.15)" stroke={C.red} strokeWidth={2.5}><animate attributeName="opacity" values="0.4;0.9;0.4" dur="0.5s" repeatCount="indefinite" /></rect>
              <text x={170} y={168} textAnchor="middle" fontSize={17} fill={C.red} fontWeight="bold">直通短路!</text>
            </>}
            {/* Reverse recovery */}
            {si === 3 && <circle cx={250} cy={60} r={18} fill="none" stroke={C.red} strokeWidth={2.5} strokeDasharray="4,3"><animate attributeName="r" values="16;30;16" dur="0.8s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.1;1" dur="0.8s" repeatCount="indefinite" /></circle>}
            {si === 3 && <text x={278} y={63} fontSize={12} fill={C.red} fontWeight="bold">Qrr</text>}
            {/* Dead time */}
            {dead && <rect x={192} y={90} width={55} height={100} rx={4} fill="none" stroke={C.yellow} strokeWidth={2.5} strokeDasharray="6,3" />}
          </svg>
        </div>

        {/* Info panel */}
        <div style={{ flex: '1 1 250px', minWidth: 220 }}>
          {/* Current state */}
          <div style={{ background: 'rgba(108,92,231,0.06)', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid rgba(108,92,231,0.15)' }}>
            <Tag color={s.color as any} style={{ fontSize: 13, padding: '3px 12px', marginBottom: 8 }}>{s.label}</Tag>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: C.dark, marginTop: 4 }}>{s.desc}</div>
            <div style={{ fontSize: 15, color: C.red, marginTop: 6, fontWeight: 'bold' }}>损耗: {s.loss}</div>
          </div>

          {/* Explanation */}
          <div style={{ background: '#F8F9FA', borderRadius: 10, padding: 14 }}>
            <Text strong style={{ fontSize: 14 }}>工作原理</Text>
            <div style={{ fontSize: 13, color: C.medium, marginTop: 6, lineHeight: 1.8 }}>
              {si === 0 && '正向电流流经上管T1。IGBT导通时Vce(sat)产生导通损耗。绿色虚线为导电路径。'}
              {si === 1 && '为防止上下管直通必须插入死区。死区时间内两管均关断，负载电流通过二极管续流。'}
              {si === 2 && '死区结束后下管未开通，电感电流通过D1自然续流。续流时Vf产生导通损耗。'}
              {si === 3 && '下管开通时D1经历反向恢复：Qrr电荷被扫出产生Err损耗。反向恢复峰值电流叠加在下管开关电流上。'}
              {si === 4 && '死区不足或驱动故障导致上下管同时导通→直流母线短路→电流急剧上升→器件可能在微秒级损坏!'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(108,92,231,0.05)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(108,92,231,0.12)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Text strong style={{ color: C.purple, whiteSpace: 'nowrap', fontSize: 13 }}>续流与直通</Text>
        <Text style={{ fontSize: 12, color: C.medium, lineHeight: 1.7 }}>
          半桥两管<strong>严格互补导通</strong>，中间插入死区防止直通。死区时间内负载电流通过二极管续流。
          续流结束时若互补管开通，二极管经历<strong style={{ color: C.red }}>反向恢复</strong>（Qrr电荷→Err损耗）。
          <strong style={{ color: C.red }}>点击「⚠ 直通风险」</strong>查看上下管同时导通的严重后果。
        </Text>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Typography, Tag } from 'antd';

const { Text, Paragraph } = Typography;

export default function DiodeFreewheelDiagram() {
  const [step, setStep] = useState(0); // 0=IGBT on, 1=deadtime, 2=diode on, 3=reverse recovery

  const steps = ['IGBT 导通', '死区时间', '二极管续流', '反向恢复'];
  const W = 500, H = 260;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong>工作状态: </Text>
        {steps.map((s, i) => (
          <Tag key={s} color={step === i ? 'blue' : 'default'} style={{ cursor: 'pointer' }}
            onClick={() => setStep(i)}>{s}</Tag>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 550, background: '#fafbfc', borderRadius: 8 }}>
        {/* Circuit schematic — simplified half-bridge */}
        <line x1={60} y1={30} x2={120} y2={30} stroke="#333" strokeWidth={2} />
        <text x={90} y={22} textAnchor="middle" fontSize={12}>DC+</text>
        <line x1={60} y1={H - 30} x2={120} y2={H - 30} stroke="#333" strokeWidth={2} />
        <text x={90} y={H - 18} textAnchor="middle" fontSize={12}>DC−</text>

        {/* IGBTs */}
        <rect x={200} y={50} width={55} height={55} rx={3} fill={step === 0 ? '#5470c6' : '#d9d9d9'}
          stroke={step === 0 ? '#2f54eb' : '#bfbfbf'} strokeWidth={2} />
        <text x={227} y={82} textAnchor="middle" fontSize={11} fill="#fff">T1</text>
        <rect x={200} y={H - 50 - 55} width={55} height={55} rx={3} fill={step === 0 ? '#d9d9d9' : '#d9d9d9'}
          stroke="#bfbfbf" strokeWidth={2} />
        <text x={227} y={H - 50 - 28} textAnchor="middle" fontSize={11}>T2</text>

        {/* Diodes */}
        <rect x={265} y={55} width={22} height={45} rx={2} fill={step >= 2 ? '#fac858' : '#e8e8e8'}
          stroke={step >= 2 ? '#d48806' : '#d9d9d9'} strokeWidth={2} />
        <text x={276} y={82} textAnchor="middle" fontSize={9}>D1</text>
        <rect x={265} y={H - 50 - 45} width={22} height={45} rx={2} fill={step === 0 ? '#fac858' : '#e8e8e8'}
          stroke={step === 0 ? '#d48806' : '#d9d9d9'} strokeWidth={2} />
        <text x={276} y={H - 50 - 18} textAnchor="middle" fontSize={9}>D2</text>

        {/* Load */}
        <circle cx={270} cy={H / 2} r={8} fill="#ff4d4f" />
        <text x={270} y={H / 2 - 14} textAnchor="middle" fontSize={10}>L</text>
        <text x={300} y={H / 2 + 4} fontSize={12} fontWeight="bold">→ i_load</text>

        {/* Current path */}
        {step === 0 && (
          <path d="M120,30 L200,50 L227,55 L270,{H / 2} L227,{H - 50} L200,{H - 50 - 55} L120,{H - 30}"
            stroke="#52c41a" strokeWidth={3} fill="none" markerEnd="url(#arr)" opacity={0.8} />
        )}
        {step === 2 && (
          <path d={`M120,${H - 30} L200,${H - 50} L227,${H - 50} L270,${H / 2} L276,${H - 50 - 23} L276,55 L260,55 L200,50 L120,30`}
            stroke="#52c41a" strokeWidth={3} fill="none" markerEnd="url(#arr)" opacity={0.8} />
        )}
        {step === 3 && (
          <>
            <path d={`M120,${H - 30} L200,${H - 50} L227,${H - 50} L270,${H / 2} L276,${H - 50 - 23}`}
              stroke="#52c41a" strokeWidth={3} fill="none" opacity={0.8} />
            <circle cx={276} cy={H - 50 - 23} r={15} fill="none" stroke="#ff4d4f" strokeWidth={2} strokeDasharray="3">
              <animate attributeName="r" values="12;20;12" dur="1s" repeatCount="indefinite" />
            </circle>
            <text x={300} y={H - 50 - 20} fontSize={10} fill="#cf1322">Qrr 放电</text>
          </>
        )}

        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#52c41a" />
          </marker>
        </defs>
      </svg>

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          死区时间内，T1/T2 均关断，负载电流通过二极管续流。续流结束后，
          互补 IGBT 开通时二极管经历反向恢复过程，Qrr 电荷被扫出产生 Err 损耗。
        </Text>
      </Paragraph>
    </div>
  );
}

import { useState } from 'react';
import { Slider, Typography, Tag } from 'antd';

const { Text, Paragraph } = Typography;

export default function ConductionLossDiagram() {
  const [currentDir, setCurrentDir] = useState(1); // 1=正, -1=负

  const W = 500, H = 300;
  const dcX = 60, dcW = 80, phaseX = 250, igbtH = 60, diodeH = 50;

  const igbtH_on = currentDir > 0;
  const diodeH_on = currentDir < 0;
  const igbtL_on = currentDir < 0;
  const diodeL_on = currentDir > 0;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong>负载电流方向: </Text>
        <Tag color={currentDir > 0 ? 'blue' : 'orange'} style={{ cursor: 'pointer' }}
          onClick={() => setCurrentDir(-currentDir)}>
          {currentDir > 0 ? '正向 (i > 0, 流出逆变器)' : '负向 (i < 0, 流入逆变器)'}
        </Tag>
        <Text type="secondary" style={{ marginLeft: 12 }}>点击切换</Text>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 550, background: '#fafbfc', borderRadius: 8 }}>
        {/* DC bus */}
        <line x1={dcX} y1={30} x2={dcX + dcW} y2={30} stroke="#333" strokeWidth={3} />
        <text x={dcX + dcW / 2} y={22} textAnchor="middle" fontSize={13} fontWeight="bold">DC+</text>
        <line x1={dcX} y1={H - 30} x2={dcX + dcW} y2={H - 30} stroke="#333" strokeWidth={3} />
        <text x={dcX + dcW / 2} y={H - 18} textAnchor="middle" fontSize={13} fontWeight="bold">DC−</text>

        {/* DC link cap */}
        <rect x={dcX + dcW} y={25} width={25} height={H - 50} fill="#e6f7ff" stroke="#91caff" strokeWidth={1} rx={2} />

        {/* Upper IGBT */}
        <rect x={phaseX - 30} y={50} width={60} height={igbtH} rx={4}
          fill={igbtH_on ? '#5470c6' : '#d9d9d9'} stroke={igbtH_on ? '#2f54eb' : '#bfbfbf'} strokeWidth={2} />
        <text x={phaseX} y={50 + igbtH / 2 + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="bold">IGBT</text>
        {/* Upper Diode */}
        <rect x={phaseX - 20} y={56} width={20} height={diodeH} rx={3}
          fill={diodeH_on ? '#fac858' : '#e8e8e8'} stroke={diodeH_on ? '#d48806' : '#d9d9d9'} strokeWidth={2} />
        <text x={phaseX - 10} y={56 + diodeH / 2 + 3} textAnchor="middle" fontSize={9} fill="#333">D</text>

        {/* Lower IGBT */}
        <rect x={phaseX - 30} y={H - 50 - igbtH} width={60} height={igbtH} rx={4}
          fill={igbtL_on ? '#5470c6' : '#d9d9d9'} stroke={igbtL_on ? '#2f54eb' : '#bfbfbf'} strokeWidth={2} />
        <text x={phaseX} y={H - 50 - igbtH / 2 + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="bold">IGBT</text>
        {/* Lower Diode */}
        <rect x={phaseX - 20} y={H - 50 - diodeH - 6} width={20} height={diodeH} rx={3}
          fill={diodeL_on ? '#fac858' : '#e8e8e8'} stroke={diodeL_on ? '#d48806' : '#d9d9d9'} strokeWidth={2} />
        <text x={phaseX - 10} y={H - 50 - diodeH / 2 - 3} textAnchor="middle" fontSize={9} fill="#333">D</text>

        {/* Connections */}
        <line x1={dcX + dcW + 25} y1={30} x2={phaseX - 30} y2={50} stroke="#666" strokeWidth={1.5} />
        <line x1={dcX + dcW + 25} y1={H - 30} x2={phaseX - 30} y2={H - 50} stroke="#666" strokeWidth={1.5} />
        {/* Phase output */}
        <line x1={phaseX} y1={50 + igbtH} x2={phaseX} y2={H - 50 - igbtH} stroke="#333" strokeWidth={2} />
        <circle cx={phaseX} cy={(50 + igbtH + H - 50 - igbtH) / 2} r={6} fill="#ff4d4f" />
        <text x={phaseX + 40} y={(50 + igbtH + H - 50 - igbtH) / 2 + 4} fontSize={13} fontWeight="bold">→ 负载</text>

        {/* Current path highlight */}
        {igbtH_on && (
          <path d={`M${dcX + dcW + 25},30 L${phaseX - 30},50 L${phaseX},${50 + igbtH / 2}`}
            stroke="#52c41a" strokeWidth={3} fill="none" markerEnd="url(#arrowG)" opacity={0.8} />
        )}
        {diodeL_on && (
          <path d={`M${dcX + dcW + 25},${H - 30} L${phaseX - 30},${H - 50} L${phaseX},${H - 50 - diodeH / 2}`}
            stroke="#52c41a" strokeWidth={3} fill="none" markerEnd="url(#arrowG)" opacity={0.8} />
        )}
        {igbtL_on && (
          <path d={`M${phaseX},${H - 50 - igbtH / 2} L${phaseX - 30},${H - 50} L${dcX + dcW + 25},${H - 30}`}
            stroke="#52c41a" strokeWidth={3} fill="none" markerEnd="url(#arrowG)" opacity={0.8} />
        )}
        {diodeH_on && (
          <path d={`M${phaseX},${50 + igbtH / 2} L${phaseX - 30},50 L${dcX + dcW + 25},30`}
            stroke="#52c41a" strokeWidth={3} fill="none" markerEnd="url(#arrowG)" opacity={0.8} />
        )}
        <defs>
          <marker id="arrowG" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#52c41a" />
          </marker>
        </defs>

        {/* Formula box */}
        <rect x={W - 200} y={15} width={190} height={45} rx={6} fill="#fffbe6" stroke="#ffe58f" />
        <text x={W - 105} y={34} textAnchor="middle" fontSize={11} fill="#ad6800">
          P_cond = Vce(sat)(Tj) × Ic × D
        </text>
        <text x={W - 105} y={52} textAnchor="middle" fontSize={10} fill="#ad8c00">
          导通损耗 ∝ 电流 × 占空比
        </text>
      </svg>

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          绿色高亮路径为当前电流方向下的导通路径。IGBT 导通时 Vce(sat) 产生损耗，
          二极管导通时 Vf 产生损耗。占空比 D 由调制策略决定。
        </Text>
      </Paragraph>
    </div>
  );
}

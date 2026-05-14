import { useState } from 'react';
import { Typography, Table, Tag } from 'antd';

const { Text, Paragraph } = Typography;

export default function ThermalIterationDiagram() {
  // Simulated iteration data
  const iterations = [
    { iter: 1, tJ_guess: 80.0, vceSat: 1.87, pLoss: 780, tHeatsink: 102, tCase: 133, tJ_new: 152.0, delta: 72.0 },
    { iter: 2, tJ_guess: 152.0, vceSat: 2.08, pLoss: 890, tHeatsink: 115, tCase: 153, tJ_new: 174.5, delta: 22.5 },
    { iter: 3, tJ_guess: 174.5, vceSat: 2.15, pLoss: 930, tHeatsink: 122, tCase: 163, tJ_new: 185.0, delta: 10.5 },
    { iter: 4, tJ_guess: 185.0, vceSat: 2.18, pLoss: 950, tHeatsink: 125, tCase: 167, tJ_new: 190.2, delta: 5.2 },
    { iter: 5, tJ_guess: 190.2, vceSat: 2.20, pLoss: 960, tHeatsink: 127, tCase: 169, tJ_new: 192.3, delta: 2.1 },
    { iter: 6, tJ_guess: 192.3, vceSat: 2.20, pLoss: 962, tHeatsink: 128, tCase: 171, tJ_new: 192.8, delta: 0.5 },
    { iter: 7, tJ_guess: 192.8, vceSat: 2.20, pLoss: 963, tHeatsink: 128, tCase: 171, tJ_new: 192.9, delta: 0.08 },
  ];

  return (
    <div>
      <Paragraph>
        <Text strong>热迭代原理：</Text> 损耗依赖结温 Tj，而 Tj 又依赖损耗，两者互为因果。
        通过反复迭代求解，直到 Tj 收敛（ΔTj &lt; 0.1°C）。
      </Paragraph>

      {/* Flow diagram */}
      <svg viewBox="0 0 550 120" width="100%" style={{ maxWidth: 600, marginBottom: 16 }}>
        <defs>
          <marker id="arrowI" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#1677ff" />
          </marker>
        </defs>
        {/* Guess Tj */}
        <rect x={10} y={35} width={80} height={50} rx={8} fill="#e6f4ff" stroke="#1677ff" strokeWidth={2} />
        <text x={50} y={58} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#1677ff">猜测 Tj</text>
        <text x={50} y={75} textAnchor="middle" fontSize={10} fill="#666">初始 Tamb+40</text>
        {/* Arrow */}
        <line x1={90} y1={60} x2={125} y2={60} stroke="#1677ff" strokeWidth={2} markerEnd="url(#arrowI)" />
        {/* Compute loss */}
        <rect x={130} y={35} width={85} height={50} rx={8} fill="#fff7e6" stroke="#fa8c16" strokeWidth={2} />
        <text x={172} y={58} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#d46b08">计算损耗</text>
        <text x={172} y={75} textAnchor="middle" fontSize={10} fill="#666">Vce(sat)×I + Esw×f</text>
        {/* Arrow */}
        <line x1={215} y1={60} x2={250} y2={60} stroke="#1677ff" strokeWidth={2} markerEnd="url(#arrowI)" />
        {/* Compute Tj */}
        <rect x={255} y={35} width={85} height={50} rx={8} fill="#f6ffed" stroke="#52c41a" strokeWidth={2} />
        <text x={297} y={58} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#389e0d">计算结温</text>
        <text x={297} y={75} textAnchor="middle" fontSize={10} fill="#666">Tj=Tcase+P×Rth</text>
        {/* Arrow */}
        <line x1={340} y1={60} x2={375} y2={60} stroke="#1677ff" strokeWidth={2} markerEnd="url(#arrowI)" />
        {/* Check */}
        <rect x={380} y={35} width={85} height={50} rx={8} fill="#fff1f0" stroke="#cf1322" strokeWidth={2} />
        <text x={422} y={55} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#a8071a">收敛检查</text>
        <text x={422} y={72} textAnchor="middle" fontSize={10} fill="#666">|ΔTj|&lt;0.1°C?</text>
        {/* Feedback loop */}
        <path d="M422,85 L422,105 L50,105 L50,85" fill="none" stroke="#fa8c16" strokeWidth={1.5} strokeDasharray="5,3" />
        <text x={240} y={115} textAnchor="middle" fontSize={10} fill="#fa8c16">不收敛则用新 Tj 回到"猜测 Tj"重复</text>
        {/* Converged */}
        <path d="M465,60 L510,60" stroke="#52c41a" strokeWidth={2} markerEnd="url(#arrowI)" />
        <circle cx={530} cy={60} r={18} fill="#52c41a" />
        <text x={530} y={64} textAnchor="middle" fontSize={16} fill="#fff">✓</text>
      </svg>

      <Table
        dataSource={iterations.map((r, i) => ({ ...r, key: i }))}
        size="small"
        pagination={false}
        columns={[
          { title: '迭代', dataIndex: 'iter', width: 50 },
          { title: '初始 Tj (°C)', dataIndex: 'tJ_guess', render: (v: number) => v.toFixed(1) },
          { title: 'Vce(sat) (V)', dataIndex: 'vceSat', render: (v: number) => v.toFixed(2) },
          { title: '损耗 (W)', dataIndex: 'pLoss', render: (v: number) => v.toFixed(0) },
          { title: '散热器 (°C)', dataIndex: 'tHeatsink', render: (v: number) => v.toFixed(0) },
          { title: '壳温 (°C)', dataIndex: 'tCase', render: (v: number) => v.toFixed(0) },
          { title: '新 Tj (°C)', dataIndex: 'tJ_new', render: (v: number) => v.toFixed(1) },
          {
            title: 'ΔTj', dataIndex: 'delta',
            render: (v: number) => (
              <Tag color={v < 0.1 ? 'green' : v < 5 ? 'orange' : 'red'}>
                {v < 0.1 ? '✓ 收敛' : `${v.toFixed(1)}°C`}
              </Tag>
            ),
          },
        ]}
      />

      <Paragraph style={{ marginTop: 12 }}>
        <Text type="secondary">
          每次迭代用当前估计的 Tj 重新计算温度相关的参数（Vce(sat)、Eon/Eoff），
          然后通过热网络求得新的 Tj。迭代持续到相邻两次 Tj 差异小于 0.1°C 为止。
          典型收敛需要 3-7 次迭代。
        </Text>
      </Paragraph>
    </div>
  );
}

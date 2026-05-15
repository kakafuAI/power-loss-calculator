import { useState } from 'react';
import { Card, Row, Col, Typography, Space, Tag, Slider, Select } from 'antd';
import {
  ThunderboltOutlined, SwapOutlined, DashboardOutlined,
  ExperimentOutlined, HeatMapOutlined, SoundOutlined,
} from '@ant-design/icons';
import ModulationDiagram from './ModulationDiagram';
import PowerFactorDiagram from './PowerFactorDiagram';
import ConductionLossDiagram from './ConductionLossDiagram';
import SwitchingLossDiagram from './SwitchingLossDiagram';
import ThermalNetworkDiagram from './ThermalNetworkDiagram';
import THDiDiagram from './THDiDiagram';

const { Title, Paragraph } = Typography;

interface Props {
  conditions?: { vdc: number; i_out_rms: number; f_sw: number; f_out: number; modulation_index: number; power_factor: number; modulation: string };
}

const concepts = [
  { key: 'modulation', label: '调制比 & 调制方式', icon: <DashboardOutlined />, component: ModulationDiagram },
  { key: 'power_factor', label: '功率因数', icon: <SwapOutlined />, component: PowerFactorDiagram },
  { key: 'conduction', label: '导通 & 续流机制', icon: <ThunderboltOutlined />, component: ConductionLossDiagram },
  { key: 'switching', label: '开关损耗机制', icon: <ExperimentOutlined />, component: SwitchingLossDiagram },
  { key: 'thermal_network', label: '热阻网络 & 迭代求解', icon: <HeatMapOutlined />, component: ThermalNetworkDiagram },
  { key: 'thdi', label: 'THDi 谐波影响', icon: <SoundOutlined />, component: THDiDiagram },
];

export default function ConceptExplorer({ conditions }: Props) {
  const [activeConcept, setActiveConcept] = useState('modulation');

  const ActiveComponent = concepts.find(c => c.key === activeConcept)?.component;

  return (
    <div style={{ padding: 16 }}>
      <Title level={4}>📖 交互式概念图解</Title>
      <Paragraph type="secondary">
        拖动滑块、切换选项，直观理解功率器件的关键物理概念。当前参数来自你的工况设置。
      </Paragraph>

      <Space wrap style={{ marginBottom: 24 }}>
        {concepts.map(c => (
          <Tag.CheckableTag
            key={c.key}
            checked={activeConcept === c.key}
            onChange={() => setActiveConcept(c.key)}
            style={{ padding: '4px 12px', fontSize: 14 }}
          >
            {c.icon} {c.label}
          </Tag.CheckableTag>
        ))}
      </Space>

      <Card>
        {ActiveComponent && <ActiveComponent conditions={conditions} />}
      </Card>
    </div>
  );
}

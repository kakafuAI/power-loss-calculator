import { Card, Radio, Typography, Space, Button, Tag, Row, Col } from 'antd';
import {
  ThunderboltOutlined, DashboardOutlined, ControlOutlined,
  ApiOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import type { ModuleConfig, DeviceType } from '../../types';

const { Title, Text, Paragraph } = Typography;

const deviceOptions: { value: DeviceType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'igbt_module', label: 'IGBT PIM 模块', icon: <DashboardOutlined />, desc: '三相整流+逆变+制动斩波，适用于通用变频器' },
  { value: 'ipm_module', label: 'IPM 智能功率模块', icon: <ControlOutlined />, desc: '内置驱动和保护，适用于伺服驱动' },
  { value: 'igbt_discrete', label: 'IGBT 单管', icon: <ThunderboltOutlined />, desc: '分立器件，适用于小功率或定制设计' },
  { value: 'sic_module', label: 'SiC 模块', icon: <ExperimentOutlined />, desc: '碳化硅模块，高频高效，适用于OBC/DCDC' },
  { value: 'sic_discrete', label: 'SiC 单管', icon: <ApiOutlined />, desc: '碳化硅分立器件，适用于高频开关电源' },
];

interface Props {
  config: ModuleConfig;
  onChange: (type: DeviceType) => void;
  onNext: () => void;
}

export default function DeviceSelector({ config, onChange, onNext }: Props) {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>选择器件类型</Title>
      <Paragraph type="secondary">
        选择需要计算的功率半导体器件类型。不同类型使用不同的损耗模型。
      </Paragraph>

      <Radio.Group
        value={config.device_type}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        <Row gutter={[16, 16]}>
          {deviceOptions.map(opt => (
            <Col span={8} key={opt.value}>
              <Card
                hoverable
                size="small"
                style={{
                  border: config.device_type === opt.value ? '2px solid #1677ff' : undefined,
                  height: '100%',
                }}
                onClick={() => onChange(opt.value)}
              >
                <Space direction="vertical" size="small">
                  <Space>
                    {opt.icon}
                    <Text strong>{opt.label}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>{opt.desc}</Text>
                  {config.device_type === opt.value && (
                    <Tag color="blue" style={{ margin: 0 }}>已选择</Tag>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Radio.Group>

      <div style={{ marginTop: 16 }}>
        <Card size="small" title="拓扑结构" style={{ background: '#fafafa' }}>
          <Space>
            <Tag color="green">三相两电平逆变器</Tag>
            <Text type="secondary">（含三相整流 + 三相逆变 + 制动斩波）</Text>
          </Space>
        </Card>
      </div>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Button type="primary" size="large" onClick={onNext}>
          下一步：参数设置
        </Button>
      </div>
    </div>
  );
}

import {
  Card, Row, Col, InputNumber, Slider, Typography, Button, Space, Select,
  Divider, Statistic, Descriptions,
} from 'antd';
import { PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { OperatingConditions, Modulation } from '../../types';

const { Title, Text } = Typography;

interface Props {
  conditions: OperatingConditions;
  onChange: (c: OperatingConditions) => void;
  onCalculate: () => void;
  loading: boolean;
  onBack: () => void;
}

export default function ConditionInput({ conditions, onChange, onCalculate, loading, onBack }: Props) {
  const update = (field: keyof OperatingConditions, value: number | string) => {
    onChange({ ...conditions, [field]: value });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>运行工况设置</Title>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card size="small" title="直流母线">
            <Row gutter={[12, 8]}>
              <Col span={24}>
                <Text>直流母线电压 Vdc (V)</Text>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Slider
                    min={100} max={1500} step={10}
                    value={conditions.vdc}
                    onChange={v => update('vdc', v)}
                    style={{ flex: 1 }}
                  />
                  <InputNumber
                    value={conditions.vdc}
                    onChange={v => v != null && update('vdc', v)}
                    style={{ width: 90 }}
                    min={100}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title="输出电流">
            <Row gutter={[12, 8]}>
              <Col span={24}>
                <Text>输出电流 RMS (A)</Text>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Slider
                    min={1} max={200} step={1}
                    value={conditions.i_out_rms}
                    onChange={v => update('i_out_rms', v)}
                    style={{ flex: 1 }}
                  />
                  <InputNumber
                    value={conditions.i_out_rms}
                    onChange={v => v != null && update('i_out_rms', v)}
                    style={{ width: 90 }}
                    min={1}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title="开关频率">
            <Row gutter={[12, 8]}>
              <Col span={24}>
                <Text>开关频率 f_sw (kHz)</Text>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Slider
                    min={0.5} max={50} step={0.5}
                    value={conditions.f_sw / 1000}
                    onChange={v => update('f_sw', v * 1000)}
                    style={{ flex: 1 }}
                  />
                  <InputNumber
                    value={conditions.f_sw / 1000}
                    onChange={v => v != null && update('f_sw', v * 1000)}
                    style={{ width: 90 }}
                    min={0.5} max={50} step={0.5}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title="输出频率">
            <Row gutter={[12, 8]}>
              <Col span={24}>
                <Text>输出频率 f_out (Hz)</Text>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Slider
                    min={1} max={400} step={1}
                    value={conditions.f_out}
                    onChange={v => update('f_out', v)}
                    style={{ flex: 1 }}
                  />
                  <InputNumber
                    value={conditions.f_out}
                    onChange={v => v != null && update('f_out', v)}
                    style={{ width: 90 }}
                    min={1} max={400}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small" title="调制比">
            <Text>调制比 m</Text>
            <InputNumber
              value={conditions.modulation_index}
              onChange={v => v != null && update('modulation_index', v)}
              style={{ width: '100%', marginTop: 8 }}
              min={0.1} max={1.15} step={0.05}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small" title="功率因数">
            <Text>功率因数 cos φ</Text>
            <InputNumber
              value={conditions.power_factor}
              onChange={v => v != null && update('power_factor', v)}
              style={{ width: '100%', marginTop: 8 }}
              min={0.1} max={1.0} step={0.05}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small" title="环境温度">
            <Text>环境温度 T_amb (°C)</Text>
            <InputNumber
              value={conditions.t_ambient}
              onChange={v => v != null && update('t_ambient', v)}
              style={{ width: '100%', marginTop: 8 }}
              min={-20} max={80}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="调制方式" style={{ marginTop: 16 }}>
        <Select
          value={conditions.modulation}
          onChange={v => update('modulation', v as Modulation)}
          options={[
            { value: 'spwm', label: 'SPWM 正弦脉宽调制' },
            { value: 'svpwm', label: 'SVPWM 空间矢量调制' },
          ]}
          style={{ width: 250 }}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card size="small" title="运行工况摘要" style={{ background: '#f6f8fa' }}>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="直流母线">{conditions.vdc} V</Descriptions.Item>
            <Descriptions.Item label="输出电流">{conditions.i_out_rms} A RMS</Descriptions.Item>
            <Descriptions.Item label="峰值电流">{(conditions.i_out_rms * Math.sqrt(2)).toFixed(1)} A</Descriptions.Item>
            <Descriptions.Item label="开关频率">{(conditions.f_sw / 1000).toFixed(1)} kHz</Descriptions.Item>
            <Descriptions.Item label="输出频率">{conditions.f_out} Hz</Descriptions.Item>
            <Descriptions.Item label="调制比">{conditions.modulation_index}</Descriptions.Item>
            <Descriptions.Item label="功率因数">{conditions.power_factor}</Descriptions.Item>
            <Descriptions.Item label="环境温度">{conditions.t_ambient} °C</Descriptions.Item>
            <Descriptions.Item label="调制方式">{conditions.modulation.toUpperCase()}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Divider />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onBack}>上一步</Button>
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          onClick={onCalculate}
          loading={loading}
        >
          开始计算
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tabs, Typography, Button,
  Space, Divider, Tag, Collapse, Descriptions, message, Tooltip,
} from 'antd';
import {
  ThunderboltOutlined, DownloadOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined,
  EditOutlined, PlusOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import LossPieChart from '../charts/LossPieChart';
import WaveformChart from '../charts/WaveformChart';
import type { CalculationResult, ModuleConfig, OperatingConditions } from '../../types';
import { exportExcel, exportCSV, sweepCurve } from '../../api/client';

const { Title, Text, Paragraph } = Typography;

interface Props {
  result: CalculationResult;
  config: ModuleConfig;
  conditions: OperatingConditions;
  onRecalculate: () => void;
  onNew: () => void;
}

export default function ResultDashboard({
  result, config, conditions, onRecalculate, onNew,
}: Props) {
  const [curveData, setCurveData] = useState<Record<string, unknown>[]>([]);
  const [curveLoading, setCurveLoading] = useState(false);

  const handleExportExcel = async () => {
    try {
      const blob = await exportExcel(result as unknown as Record<string, unknown>);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'loss_calculation.xlsx'; a.click();
      URL.revokeObjectURL(url);
      message.success('导出 Excel 成功');
    } catch { message.error('导出失败'); }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await exportCSV(result as unknown as Record<string, unknown>);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'loss_calculation.csv'; a.click();
      URL.revokeObjectURL(url);
      message.success('导出 CSV 成功');
    } catch { message.error('导出失败'); }
  };

  const handleLoadCurves = async (param: string) => {
    setCurveLoading(true);
    try {
      let start = 1, end = conditions.i_out_rms * 2;
      if (param === 'f_sw') { start = 500; end = 20000; }
      if (param === 'cos_phi') { start = 0.1; end = 1.0; }
      const res = await sweepCurve(config, conditions, param, start, end, 50);
      setCurveData(res.curves as unknown as Record<string, unknown>[]);
    } catch (err) {
      message.error('曲线加载失败');
      console.error(err);
    } finally {
      setCurveLoading(false);
    }
  };

  const curveOption = (curve: Record<string, unknown>) => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value', name: curve.x_label as string },
    yAxis: { type: 'value', name: curve.y_label as string },
    series: [{
      name: curve.name as string,
      type: 'line',
      data: (curve.points as { x: number; y: number }[]).map(p => [p.x, p.y]),
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
    }],
  });

  // Bar chart: per-device loss
  const deviceBarOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['导通损耗', '开关损耗'], bottom: 0 },
    grid: { left: 120, right: 30, top: 10, bottom: 40 },
    xAxis: { type: 'value', name: '损耗 (W)' },
    yAxis: {
      type: 'category',
      data: result.devices.map(d => d.name),
      inverse: true,
    },
    series: [
      {
        name: '导通损耗', type: 'bar', stack: 'total',
        data: result.devices.map(d => +d.p_cond.toFixed(2)),
        itemStyle: { color: '#5470c6' },
      },
      {
        name: '开关损耗', type: 'bar', stack: 'total',
        data: result.devices.map(d => +d.p_sw.toFixed(2)),
        itemStyle: { color: '#91cc75' },
      },
    ],
  };

  const deviceColumns = [
    { title: '器件', dataIndex: 'name', key: 'name', width: 120 },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 70,
      render: (t: string) => <Tag color={t === 'IGBT' ? 'blue' : 'orange'}>{t}</Tag>,
    },
    { title: '导通损耗 (W)', dataIndex: 'p_cond', key: 'p_cond', render: (v: number) => v.toFixed(2) },
    { title: '开关损耗 (W)', dataIndex: 'p_sw', key: 'p_sw', render: (v: number) => v.toFixed(2) },
    {
      title: '总损耗 (W)', dataIndex: 'p_total', key: 'p_total',
      render: (v: number) => <Text strong>{v.toFixed(2)}</Text>,
    },
    {
      title: '结温 (°C)', dataIndex: 't_j', key: 't_j',
      render: (v: number) => {
        const color = v > config.t_j_max ? 'red' : v > config.t_j_max * 0.85 ? 'orange' : 'green';
        return <Tag color={color}>{v.toFixed(1)}</Tag>;
      },
    },
  ];

  // Thermal iteration steps
  const iterColumns = [
    { title: '迭代', dataIndex: 'iteration', width: 60 },
    { title: '散热器温度 (°C)', dataIndex: 't_heatsink' },
    { title: '壳温 (°C)', dataIndex: 't_case' },
    { title: 'IGBT_H Tj (°C)', dataIndex: 't_j_igbt_h' },
    { title: '二极管_H Tj (°C)', dataIndex: 't_j_diode_h' },
    { title: 'IGBT 导通 (W/相)', dataIndex: 'p_igbt_cond_per_leg' },
    { title: 'IGBT 开关 (W/相)', dataIndex: 'p_igbt_sw_per_leg' },
    { title: 'Tj 最大变化 (°C)', dataIndex: 'max_tj_change' },
  ];

  const thermalSteps = result.calculation_steps.find(s => s.type === 'thermal');
  const iterData = (thermalSteps?.data as unknown as Record<string, unknown>[]) || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>计算结果</Title>
        <Space>
          <Tooltip title="导出 Excel"><Button icon={<DownloadOutlined />} onClick={handleExportExcel}>Excel</Button></Tooltip>
          <Tooltip title="导出 CSV"><Button icon={<DownloadOutlined />} onClick={handleExportCSV}>CSV</Button></Tooltip>
          <Button icon={<ReloadOutlined />} onClick={onRecalculate}>重新计算</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={onNew}>新建计算</Button>
        </Space>
      </div>

      <Text type="secondary">
        {config.manufacturer && `${config.manufacturer} `}{config.module_name || '自定义器件'} | {config.device_type} | {conditions.vdc}V / {conditions.i_out_rms}A / {conditions.f_sw / 1000}kHz
      </Text>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总损耗" value={result.p_total_loss} suffix="W" precision={1}
              valueStyle={{ color: '#cf1322', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="效率" value={result.efficiency} suffix="%" precision={2}
              valueStyle={{ color: '#3f8600', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="输出功率" value={(result.p_out / 1000).toFixed(2)} suffix="kW" precision={2}
              valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="最高结温"
              value={result.t_j_max}
              suffix="°C"
              precision={1}
              valueStyle={{
                color: result.t_j_max > config.t_j_max ? '#cf1322' : '#3f8600',
                fontSize: 22,
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="壳温" value={result.t_case_est} suffix="°C" precision={1} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="收敛"
              value={result.converged ? '是' : '否'}
              suffix={result.converged ? <CheckCircleOutlined style={{ color: '#3f8600' }} /> : <CloseCircleOutlined style={{ color: '#cf1322' }} />}
              valueStyle={{ fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{result.iteration_count} 次迭代</Text>
          </Card>
        </Col>
      </Row>

      {/* Main tabs */}
      <Tabs
        defaultActiveKey="overview"
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'overview',
            label: '总览',
            children: (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="损耗分布" size="small">
                    <LossPieChart result={result} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="器件损耗详情" size="small">
                    <ReactECharts option={deviceBarOption} style={{ height: 320 }} />
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title="损耗汇总" size="small">
                    <Row gutter={16}>
                      <Col span={5}>
                        <Statistic title="IGBT 导通损耗" value={result.p_igbt_cond} suffix="W" precision={1} />
                      </Col>
                      <Col span={5}>
                        <Statistic title="IGBT 开关损耗" value={result.p_igbt_sw} suffix="W" precision={1} />
                      </Col>
                      <Col span={5}>
                        <Statistic title="二极管导通损耗" value={result.p_diode_cond} suffix="W" precision={1} />
                      </Col>
                      <Col span={5}>
                        <Statistic title="二极管开关损耗" value={result.p_diode_sw} suffix="W" precision={1} />
                      </Col>
                      {result.p_brake_loss > 0 && (
                        <Col span={4}>
                          <Statistic title="制动损耗" value={result.p_brake_loss} suffix="W" precision={1} />
                        </Col>
                      )}
                    </Row>
                    {result.per_leg && (
                      <Descriptions size="small" column={4} style={{ marginTop: 12 }} bordered>
                        <Descriptions.Item label="IGBT 平均电流">{result.per_leg.i_igbt_avg?.toFixed(2)} A</Descriptions.Item>
                        <Descriptions.Item label="IGBT RMS 电流">{result.per_leg.i_igbt_rms?.toFixed(2)} A</Descriptions.Item>
                        <Descriptions.Item label="Diode 平均电流">{result.per_leg.i_diode_avg?.toFixed(2)} A</Descriptions.Item>
                        <Descriptions.Item label="Diode RMS 电流">{result.per_leg.i_diode_rms?.toFixed(2)} A</Descriptions.Item>
                      </Descriptions>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'devices',
            label: '器件详情',
            children: (
              <Table
                dataSource={result.devices.map((d, i) => ({ ...d, key: i }))}
                columns={deviceColumns}
                size="small"
                pagination={false}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}><Text strong>总计</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>{result.devices.reduce((s, d) => s + d.p_cond, 0).toFixed(2)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong>{result.devices.reduce((s, d) => s + d.p_sw, 0).toFixed(2)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <Text strong>{result.devices.reduce((s, d) => s + d.p_total, 0).toFixed(2)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>{result.t_j_max_device}</Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ),
          },
          {
            key: 'steps',
            label: '计算过程',
            children: (
              <div>
                {result.calculation_steps.map((step, idx) => (
                  <Card key={idx} size="small" title={step.title} style={{ marginBottom: 12 }}>
                    {step.formula && <Paragraph type="secondary" code>{step.formula}</Paragraph>}
                    {step.type === 'thermal' ? (
                      <Table
                        dataSource={(step.data as unknown as Record<string, unknown>[] || []).map((d, i) => ({ ...d, key: i }))}
                        columns={iterColumns}
                        size="small"
                        pagination={false}
                      />
                    ) : step.type === 'input' || step.type === 'calculation' || step.type === 'summary' ? (
                      <Descriptions size="small" column={2} bordered>
                        {Object.entries(step.data as Record<string, string>).map(([k, v]) => (
                          <Descriptions.Item key={k} label={k}>{String(v)}</Descriptions.Item>
                        ))}
                      </Descriptions>
                    ) : null}
                  </Card>
                ))}
              </div>
            ),
          },
          {
            key: 'waveforms',
            label: '波形',
            children: (
              <Card title="调制信号与输出电流" size="small">
                <WaveformChart conditions={conditions} />
                <Paragraph type="secondary" style={{ marginTop: 8 }}>
                  显示一个基波周期内的调制信号、输出电流和上管占空比。IGBT 导通区间为占空比 D_H=1 且电流 i&gt;0 的区域。
                </Paragraph>
              </Card>
            ),
          },
          {
            key: 'curves',
            label: '特性曲线',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => handleLoadCurves('i_out')}
                    loading={curveLoading}
                  >
                    损耗 vs 输出电流
                  </Button>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => handleLoadCurves('f_sw')}
                    loading={curveLoading}
                  >
                    损耗 vs 开关频率
                  </Button>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => handleLoadCurves('cos_phi')}
                    loading={curveLoading}
                  >
                    损耗 vs 功率因数
                  </Button>
                </Space>
                {curveData.map((curve, idx) => (
                  <Card key={idx} size="small" title={(curve as Record<string, unknown>).name as string} style={{ marginBottom: 12 }}>
                    <ReactECharts option={curveOption(curve as Record<string, unknown>)} style={{ height: 280 }} />
                  </Card>
                ))}
                {curveData.length === 0 && (
                  <Card>
                    <Text type="secondary">点击上方按钮生成特性曲线。系统将自动进行参数扫描计算。</Text>
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'thermal_detail',
            label: '热迭代',
            children: (
              <div>
                <Paragraph>
                  热迭代过程：从初始猜测温度开始，交替计算损耗和结温，直至收敛。
                  {result.converged ? (
                    <Tag color="green" style={{ marginLeft: 8 }}>已收敛 {result.iteration_count} 次迭代</Tag>
                  ) : (
                    <Tag color="red" style={{ marginLeft: 8 }}>未收敛（已达最大迭代次数）</Tag>
                  )}
                </Paragraph>
                <Table
                  dataSource={iterData.map((d, i) => ({ ...d, key: i }))}
                  columns={iterColumns}
                  size="small"
                  pagination={false}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Typography, Card, Row, Col, Statistic, Button, Space, message, Descriptions, Tag, Table, Empty, Tooltip, Alert } from 'antd';
import { SwapOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import type { CalculationResult, ModuleConfig, OperatingConditions } from '../types';

const { Title, Text, Paragraph } = Typography;

interface Props {
  result?: CalculationResult | null;
  config?: ModuleConfig;
  conditions?: OperatingConditions;
}

export default function ComparisonView({ result, config, conditions }: Props) {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<any>(null);

  // Load all devices from library, and latest result if not provided
  const [currentResult, setCurrentResult] = useState(result);
  const [currentConfig, setCurrentConfig] = useState(config);
  const [currentConditions, setCurrentConditions] = useState(conditions);

  useEffect(() => {
    if (result) { setCurrentResult(result); setCurrentConfig(config); setCurrentConditions(conditions); }
  }, [result, config, conditions]);

  useEffect(() => {
    axios.get('/api/devices?limit=100').then(({ data }) => {
      setDevices(data.devices || []);
    }).catch(() => {});
    // If no result from props, try loading latest from history
    if (!result) {
      axios.get('/api/history?limit=1').then(({ data }) => {
        const recs = data.history || [];
        if (recs.length > 0) {
          const rec = recs[0];
          try {
            const cfg = JSON.parse(rec.config_json || '{}');
            if (cfg.device_type) {
              setCurrentConfig(cfg);
              setCurrentConditions(JSON.parse(rec.conditions_json || '{}'));
              setCurrentResult(JSON.parse(rec.result_json || '{}'));
            }
          } catch {}
        }
      }).catch(() => {});
    }
  }, []);

  // Filter devices by same type and similar current/voltage rating
  const activeConfig = currentConfig || config;
  const activeConditions = currentConditions || conditions;
  const activeResult = currentResult || result;

  const compatibleDevices = useMemo(() => {
    if (!activeConfig) return [];
    const curType = activeConfig.device_type;
    const curVdc = activeConfig.vdc_rated || 0;
    const curIc = activeConfig.ic_rated || 0;
    return devices.filter((d: any) => {
      if (d.device_type !== curType) return false;
      try {
        const devConfig = JSON.parse(d.config_json);
        const dVdc = devConfig.vdc_rated || 0;
        const dIc = devConfig.ic_rated || 0;
        const vdcMatch = curVdc === 0 || dVdc === 0 || (dVdc >= curVdc * 0.7 && dVdc <= curVdc * 1.3);
        const icMatch = curIc === 0 || dIc === 0 || (dIc >= curIc * 0.5 && dIc <= curIc * 2.0);
        return vdcMatch && icMatch;
      } catch { return false; }
    });
  }, [devices, activeConfig]);

  const handleCompare = async (device: any) => {
    setSelectedDevice(device);
    setComparing(true);
    try {
      let devConfig: any;
      try { devConfig = JSON.parse(device.config_json); } catch { message.error('器件配置解析失败'); setComparing(false); return; }
      // Ensure required fields
      const fullConfig = {
        device_type: devConfig.device_type || config?.device_type || 'igbt_module',
        module_name: devConfig.module_name || device.device_name || '',
        manufacturer: devConfig.manufacturer || device.manufacturer || '',
        vdc_rated: devConfig.vdc_rated || 1200,
        ic_rated: devConfig.ic_rated || 100,
        num_parallel_chips: devConfig.num_parallel_chips || 1,
        t_j_max: devConfig.t_j_max || 150,
        igbt: devConfig.igbt || undefined,
        sic_mos: devConfig.sic_mos || undefined,
        diode: devConfig.diode || undefined,
        sic_diode: devConfig.sic_diode || undefined,
        rth_ch_module: devConfig.rth_ch_module || 0.02,
        rth_ha: devConfig.rth_ha || 0.08,
      };
      const { data: calcResult } = await axios.post('/api/calculate', {
        config: fullConfig,
        conditions: conditions || {
          vdc: 600, i_out_rms: 50, f_out: 50, f_sw: 4000,
          modulation_index: 1.0, power_factor: 0.85,
          modulation: 'spwm', t_ambient: 40,
        },
      });
      setCompareResult(calcResult);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || '请检查器件配置是否完整';
      message.error(`对比计算失败: ${detail}`);
    }
    finally { setComparing(false); }
  };

  const deviceColumns = [
    {
      title: '型号', dataIndex: 'device_name', width: 180,
      render: (v: string, r: any) => <Text strong>{v}{r.is_builtin ? <Tag color="blue" style={{ marginLeft: 4 }}>内置</Tag> : null}</Text>,
    },
    { title: '厂商', dataIndex: 'manufacturer', width: 100 },
    {
      title: '额定值', width: 100,
      render: (_: any, r: any) => {
        try {
          const c = JSON.parse(r.config_json);
          return <Text>{c.vdc_rated || '?'}V / {c.ic_rated || '?'}A</Text>;
        } catch { return '—'; }
      },
    },
    {
      title: '关键参数', width: 130,
      render: (_: any, r: any) => {
        try {
          const c = JSON.parse(r.config_json);
          const vce = c.igbt?.vce_sat_25;
          const rds = c.sic_mos?.rds_on_25;
          return <Text>{vce != null ? `Vce(sat)=${vce}V` : rds != null ? `Rds(on)=${rds}mΩ` : '—'}</Text>;
        } catch { return '—'; }
      },
    },
    {
      title: '操作', width: 100,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          size="small"
          icon={<SwapOutlined />}
          loading={comparing && selectedDevice?.id === record.id}
          onClick={() => handleCompare(record)}
        >
          对比
        </Button>
      ),
    },
  ];

  // Current device summary
  const currentSummary = activeResult ? {
    name: activeConfig?.module_name || '当前器件',
    manufacturer: activeConfig?.manufacturer || '',
    type: activeConfig?.device_type || '未知',
    pTotal: result.p_total_loss,
    efficiency: result.efficiency,
    tJMax: result.t_j_max,
    pCond: result.p_igbt_cond,
    pSw: result.p_igbt_sw,
  } : null;

  const compareSummary = compareResult ? {
    name: selectedDevice?.name || selectedDevice?.device_name || '对比器件',
    manufacturer: selectedDevice?.manufacturer || '',
    type: selectedDevice?.device_type || '未知',
    pTotal: compareResult.p_total_loss,
    efficiency: compareResult.efficiency,
    tJMax: compareResult.t_j_max,
    pCond: compareResult.p_igbt_cond,
    pSw: compareResult.p_igbt_sw,
  } : null;

  const hasCompareData = currentSummary && compareSummary;

  // Radar chart
  const radarOption = hasCompareData ? {
    tooltip: {},
    legend: { data: [currentSummary.name, compareSummary.name], bottom: 0 },
    radar: {
      center: ['50%', '45%'],
      indicator: [
        { name: '效率', max: 100 },
        { name: 'Tj 余量', max: 100 },
        { name: '损耗(反比)', max: 100 },
        { name: 'Vce/Rds', max: 100 },
        { name: '热阻', max: 100 },
      ],
    },
    series: [{
      type: 'radar',
      data: [
        {
          name: currentSummary.name,
          value: [
            currentSummary.efficiency,
            Math.max(0, 100 - currentSummary.tJMax / 2),
            Math.max(0, 100 - currentSummary.pTotal / 15),
            Math.max(0, 100 - (config?.igbt?.vce_sat_25 || config?.sic_mos?.rds_on_25 || 0) * 20),
            Math.max(0, 100 - (config?.igbt?.thermal?.rth_jc || config?.sic_mos?.thermal?.rth_jc || 0) * 200),
          ],
        },
        {
          name: compareSummary.name,
          value: [
            compareSummary.efficiency,
            Math.max(0, 100 - compareSummary.tJMax / 2),
            Math.max(0, 100 - compareSummary.pTotal / 15),
            Math.max(0, 100 - (selectedDevice ? (() => { try { const c = JSON.parse(selectedDevice.config_json); return c.igbt?.vce_sat_25 || c.sic_mos?.rds_on_25 || 0; } catch { return 0; } })() : 0) * 20),
            Math.max(0, 100 - (selectedDevice ? (() => { try { const c = JSON.parse(selectedDevice.config_json); return c.igbt?.thermal?.rth_jc || c.sic_mos?.thermal?.rth_jc || 0; } catch { return 0; } })() : 0) * 200),
          ],
        },
      ],
    }],
  } : null;

  const paramCompare = hasCompareData ? [
    {
      label: '总损耗', unit: 'W', lowerBetter: true,
      current: currentSummary.pTotal.toFixed(0),
      compare: compareSummary.pTotal.toFixed(0),
    },
    {
      label: '效率', unit: '%', lowerBetter: false,
      current: currentSummary.efficiency.toFixed(1),
      compare: compareSummary.efficiency.toFixed(1),
    },
    {
      label: '最高结温 Tj', unit: '°C', lowerBetter: true,
      current: currentSummary.tJMax.toFixed(1),
      compare: compareSummary.tJMax.toFixed(1),
    },
    {
      label: '导通损耗', unit: 'W', lowerBetter: true,
      current: currentSummary.pCond.toFixed(0),
      compare: compareSummary.pCond.toFixed(0),
    },
    {
      label: '开关损耗', unit: 'W', lowerBetter: true,
      current: currentSummary.pSw.toFixed(0),
      compare: compareSummary.pSw.toFixed(0),
    },
  ] : [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={3}>对比分析</Title>
      <Paragraph type="secondary">
        选择器件库中<Text strong>同类型、同档次</Text>的器件，在相同工况下运行计算并对比关键指标。
      </Paragraph>

      {!activeResult && (
        <Alert
          type="info"
          showIcon
          message="请先在「损耗计算」页面完成一次计算"
          description="对比分析需要在相同工况下对比两个器件的损耗表现。先完成一次基础计算，再来这里对比器件库中的同类器件。"
          style={{ marginBottom: 16 }}
        />
      )}

      {result && !hasCompareData && (
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Left: Current device summary */}
          <div style={{ flex: 1 }}>
            <Card size="small" title={<Text style={{ color: '#1677ff' }}>当前器件: {currentSummary?.name}</Text>}
              style={{ borderColor: '#1677ff' }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="类型"><Tag>{currentSummary?.type}</Tag></Descriptions.Item>
                <Descriptions.Item label="总损耗">{currentSummary?.pTotal.toFixed(0)} W</Descriptions.Item>
                <Descriptions.Item label="效率">{currentSummary?.efficiency.toFixed(1)}%</Descriptions.Item>
                <Descriptions.Item label="最高结温">{currentSummary?.tJMax.toFixed(1)}°C</Descriptions.Item>
              </Descriptions>
              <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                <Descriptions.Item label="工况">
                  {activeConditions?.vdc}V / {conditions?.i_out_rms}A / {(conditions?.f_sw || 4000) / 1000}kHz / cosφ={conditions?.power_factor}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </div>

          {/* Right: Device selection table */}
          <div style={{ flex: 2 }}>
            <Card size="small" title="从器件库中选择同档次器件进行对比">
              {compatibleDevices.length === 0 ? (
                <Empty description="器件库中暂无同类型、同档次的器件">
                  <Text type="secondary">请先在器件库中添加同类型的器件</Text>
                </Empty>
              ) : (
                <Table
                  dataSource={compatibleDevices.map((d: any) => ({ ...d, key: d.id }))}
                  columns={deviceColumns}
                  size="small"
                  pagination={false}
                  scroll={{ y: 300 }}
                />
              )}
            </Card>
          </div>
        </div>
      )}

      {hasCompareData && (
        <>
          {/* Head-to-head cards */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small" style={{ borderColor: '#1677ff', background: '#f0f5ff' }}>
                <Text strong style={{ color: '#1677ff' }}>
                  <CheckCircleOutlined /> {currentSummary.name}
                </Text>
                {currentSummary.manufacturer && <div><Text type="secondary" style={{ fontSize: 11 }}>{currentSummary.manufacturer}</Text></div>}
                <Row gutter={8} style={{ marginTop: 8 }}>
                  <Col span={12}><Statistic title="总损耗" value={currentSummary.pTotal.toFixed(0)} suffix="W" valueStyle={{ fontSize: 18 }} /></Col>
                  <Col span={12}><Statistic title="效率" value={currentSummary.efficiency.toFixed(1)} suffix="%" valueStyle={{ fontSize: 18 }} /></Col>
                  <Col span={12}><Statistic title="Tj_max" value={`${currentSummary.tJMax.toFixed(1)}°C`} valueStyle={{ fontSize: 16, color: currentSummary.tJMax > (activeConfig?.t_j_max || 150) ? '#cf1322' : '#3f8600' }} /></Col>
                  <Col span={12}><Statistic title="开关损耗" value={currentSummary.pSw.toFixed(0)} suffix="W" valueStyle={{ fontSize: 16 }} /></Col>
                </Row>
              </Card>
            </Col>
            <Col span={6} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <SwapOutlined style={{ fontSize: 36, color: '#999' }} />
                <div><Tag color="processing">相同工况</Tag></div>
              </div>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderColor: '#52c41a', background: '#f6ffed' }}>
                <Text strong style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined /> {compareSummary.name}
                </Text>
                {compareSummary.manufacturer && <div><Text type="secondary" style={{ fontSize: 11 }}>{compareSummary.manufacturer}</Text></div>}
                <Row gutter={8} style={{ marginTop: 8 }}>
                  <Col span={12}><Statistic title="总损耗" value={compareSummary.pTotal.toFixed(0)} suffix="W" valueStyle={{ fontSize: 18 }} /></Col>
                  <Col span={12}><Statistic title="效率" value={compareSummary.efficiency.toFixed(1)} suffix="%" valueStyle={{ fontSize: 18 }} /></Col>
                  <Col span={12}><Statistic title="Tj_max" value={`${compareSummary.tJMax.toFixed(1)}°C`} valueStyle={{ fontSize: 16, color: compareSummary.tJMax > (activeConfig?.t_j_max || 150) ? '#cf1322' : '#3f8600' }} /></Col>
                  <Col span={12}><Statistic title="开关损耗" value={compareSummary.pSw.toFixed(0)} suffix="W" valueStyle={{ fontSize: 16 }} /></Col>
                </Row>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" title="对比结论" style={{ background: '#fffbe6' }}>
                {paramCompare.map((p, i) => {
                  const currVal = parseFloat(p.current);
                  const compVal = parseFloat(p.compare);
                  const diff = ((compVal / currVal - 1) * 100);
                  const better = p.lowerBetter ? (compVal < currVal ? 'compare' : 'current') : (compVal > currVal ? 'compare' : 'current');
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12 }}>{p.label}: </Text>
                      <Tag color={better === 'compare' ? 'green' : 'blue'}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}% {better === 'compare' ? '← 更优' : '当前更优'}
                      </Tag>
                    </div>
                  );
                })}
              </Card>
            </Col>
          </Row>

          {/* Radar chart */}
          <Card size="small" title="关键指标雷达图" style={{ marginBottom: 16 }}>
            {radarOption && <ReactECharts option={radarOption} style={{ height: 340 }} />}
          </Card>

          {/* Parameter comparison detail */}
          <Card size="small" title="参数对比详情">
            {paramCompare.map((p, i) => {
              const diff = (parseFloat(p.compare) / parseFloat(p.current) - 1) * 100;
              const absDiff = Math.abs(diff);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', background: i % 2 === 0 ? '#fafafa' : '#fff',
                  borderBottom: '1px solid #f0f0f0',
                }}>
                  <Text strong style={{ width: 140, fontSize: 13 }}>{p.label}</Text>
                  <Space size={8}>
                    <Tag color="blue">{currentSummary.name}: {p.current} {p.unit}</Tag>
                    <Tag color={absDiff > 10 ? 'red' : absDiff > 3 ? 'orange' : 'green'}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                    </Tag>
                    <Tag color="green">{compareSummary.name}: {p.compare} {p.unit}</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {absDiff > 15 ? (diff > 0 ? '⚠ 对比器件损耗偏高' : '✓ 对比器件明显更优') :
                     absDiff > 5 ? (diff > 0 ? '对比器件略差' : '对比器件略优') :
                     '两器件表现相近'}
                  </Text>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}

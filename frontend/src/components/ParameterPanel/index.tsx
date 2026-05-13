import { useState } from 'react';
import {
  Card, Tabs, Button, Space, Typography, InputNumber, Input, Upload,
  Table, Tag, message, Collapse, Row, Col, Descriptions, Alert,
  Divider,
} from 'antd';
import { UploadOutlined, InboxOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { ModuleConfig, SwitchingPoint, PDFParseResult } from '../../types';
import { parseDatasheet } from '../../api/client';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Panel } = Collapse;

interface Props {
  config: ModuleConfig;
  onChange: (config: ModuleConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ParameterPanel({ config, onChange, onBack, onNext }: Props) {
  const [parseResult, setParseResult] = useState<PDFParseResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('manual');

  const isSiC = config.device_type === 'sic_module' || config.device_type === 'sic_discrete';

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File;
    setUploading(true);
    try {
      const result = await parseDatasheet(file, config.device_type);
      setParseResult(result);
      setActiveTab('extracted');

      // Auto-fill parameters based on device type
      const p = result.parameters;
      if (isSiC) {
        onChange({
          ...config,
          module_name: result.metadata.part_number || config.module_name,
          manufacturer: result.metadata.manufacturer || config.manufacturer,
          sic_mos: config.sic_mos ? {
            ...config.sic_mos,
            rds_on_25: (p.rds_on_25 as number) ?? config.sic_mos?.rds_on_25,
            rds_on_125: (p.rds_on_125 as number) ?? config.sic_mos?.rds_on_125,
            vds_rated: (p.vds_rated as number) ?? config.sic_mos?.vds_rated,
            id_nom: (p.id_nom as number) ?? config.sic_mos?.id_nom,
          } : undefined,
          sic_diode: config.sic_diode ? {
            ...config.sic_diode,
            vsd_25: (p.vsd_25 as number) ?? config.sic_diode?.vsd_25,
            vsd_125: (p.vsd_125 as number) ?? config.sic_diode?.vsd_125,
          } : undefined,
        });
      } else {
        onChange({
          ...config,
          module_name: result.metadata.part_number || config.module_name,
          manufacturer: result.metadata.manufacturer || config.manufacturer,
          igbt: config.igbt ? {
            ...config.igbt,
            vce_sat_25: (p.vce_sat_25 as number) ?? config.igbt?.vce_sat_25,
            vce_sat_125: (p.vce_sat_125 as number) ?? config.igbt?.vce_sat_125,
            vce_rated: (p.vce_rated as number) ?? config.igbt?.vce_rated,
            ic_nom: (p.ic_nom as number) ?? config.igbt?.ic_nom,
          } : undefined,
          diode: config.diode ? {
            ...config.diode,
            vf_25: (p.vf_25 as number) ?? config.diode?.vf_25,
            vf_125: (p.vf_125 as number) ?? config.diode?.vf_125,
          } : undefined,
        });
      }
      message.success(`参数提取完成，已提取 ${Object.keys(p).filter(k => p[k] != null).length} 个参数`);
    } catch (err) {
      message.error('PDF 解析失败，请检查文件格式');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const confidenceTag = (key: string) => {
    const conf = parseResult?.parameters?.confidence as Record<string, number> | undefined;
    const val = conf?.[key];
    if (val == null) return null;
    if (val >= 0.8) return <Tag color="green">高置信度</Tag>;
    if (val >= 0.5) return <Tag color="orange">中置信度</Tag>;
    return <Tag color="red">低置信度</Tag>;
  };

  const updateIGBT = (field: string, value: number | undefined) => {
    if (!config.igbt) return;
    onChange({ ...config, igbt: { ...config.igbt, [field]: value } });
  };

  const updateDiode = (field: string, value: number | undefined) => {
    if (!config.diode) return;
    onChange({ ...config, diode: { ...config.diode, [field]: value } });
  };

  const updateSiCMOS = (field: string, value: number | undefined) => {
    if (!config.sic_mos) return;
    onChange({ ...config, sic_mos: { ...config.sic_mos, [field]: value } });
  };

  const updateSiCDiode = (field: string, value: number | undefined) => {
    if (!config.sic_diode) return;
    onChange({ ...config, sic_diode: { ...config.sic_diode, [field]: value } });
  };

  const updateSwitchingPoints = (device: 'igbt' | 'diode' | 'sic_mos', curve: 'eon' | 'eoff' | 'err', points: SwitchingPoint[]) => {
    if (device === 'igbt' && config.igbt) {
      const which = curve === 'eon' ? 'eon_curve' : curve === 'eoff' ? 'eoff_curve' : null;
      if (!which) return;
      onChange({
        ...config,
        igbt: { ...config.igbt, [which]: { ...config.igbt[which], points } },
      });
    } else if (device === 'diode' && config.diode) {
      onChange({
        ...config,
        diode: { ...config.diode, err_curve: { ...config.diode.err_curve, points } },
      });
    } else if (device === 'sic_mos' && config.sic_mos) {
      const which = curve === 'eon' ? 'eon_curve' : curve === 'eoff' ? 'eoff_curve' : null;
      if (!which) return;
      onChange({
        ...config,
        sic_mos: { ...config.sic_mos, [which]: { ...config.sic_mos[which], points } },
      });
    }
  };

  const renderIGBTTab = () => (
    <Collapse defaultActiveKey={['basic', 'switching', 'thermal']} style={{ marginTop: 16 }}>
      <Panel header="基本参数" key="basic">
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Text>模块名称</Text>
            <Input
              value={config.module_name}
              onChange={e => onChange({ ...config, module_name: e.target.value })}
              placeholder="如: FS100R12KT4"
            />
          </Col>
          <Col span={12}>
            <Text>制造商</Text>
            <Input
              value={config.manufacturer}
              onChange={e => onChange({ ...config, manufacturer: e.target.value })}
              placeholder="如: Infineon"
            />
          </Col>
          <Col span={6}>
            <Text>额定 Vce (V)</Text>
            <InputNumber value={config.vdc_rated} onChange={v => onChange({ ...config, vdc_rated: v ?? 1200 })} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>额定 Ic (A)</Text>
            <InputNumber value={config.ic_rated} onChange={v => onChange({ ...config, ic_rated: v ?? 100 })} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Vce(sat) @ 25°C (V)</Text>
            <InputNumber value={config.igbt?.vce_sat_25} onChange={v => updateIGBT('vce_sat_25', v ?? undefined)} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Vce(sat) @ 125°C (V)</Text>
            <InputNumber value={config.igbt?.vce_sat_125} onChange={v => updateIGBT('vce_sat_125', v ?? undefined)} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>额定 Ic_nom (A)</Text>
            <InputNumber value={config.igbt?.ic_nom} onChange={v => updateIGBT('ic_nom', v ?? undefined)} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>最高结温 Tj_max (°C)</Text>
            <InputNumber value={config.t_j_max} onChange={v => onChange({ ...config, t_j_max: v ?? 150 })} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Panel>

      <Panel header="二极管参数 (FWD)" key="diode">
        <Row gutter={[16, 12]}>
          <Col span={6}>
            <Text>Vf @ 25°C (V)</Text>
            <InputNumber value={config.diode?.vf_25} onChange={v => updateDiode('vf_25', v ?? undefined)} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Vf @ 125°C (V)</Text>
            <InputNumber value={config.diode?.vf_125} onChange={v => updateDiode('vf_125', v ?? undefined)} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Qrr (μC)</Text>
            <InputNumber value={config.diode?.qrr} onChange={v => updateDiode('qrr', v ?? undefined)} step={0.1} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>额定 If (A)</Text>
            <InputNumber value={config.diode?.if_nom} onChange={v => updateDiode('if_nom', v ?? undefined)} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Panel>

      <Panel header="开关损耗参数" key="switching">
        <Text type="secondary">Eon / Eoff / Err 数据点（电流 A, 能量 mJ），参考条件：Vcc={config.igbt?.eon_curve.vcc ?? 600}V, Rg={config.igbt?.eon_curve.rg ?? 10}Ω</Text>
        <SwitchingPointEditor
          label="Eon 点"
          points={config.igbt?.eon_curve.points ?? []}
          onChange={pts => updateSwitchingPoints('igbt', 'eon', pts)}
        />
        <Divider />
        <SwitchingPointEditor
          label="Eoff 点"
          points={config.igbt?.eoff_curve.points ?? []}
          onChange={pts => updateSwitchingPoints('igbt', 'eoff', pts)}
        />
        <Divider />
        <SwitchingPointEditor
          label="Err 点 (二极管反向恢复)"
          points={config.diode?.err_curve.points ?? []}
          onChange={pts => updateSwitchingPoints('diode', 'err', pts)}
        />
      </Panel>

      <Panel header="热参数" key="thermal">
        <Row gutter={[16, 12]}>
          <Col span={6}>
            <Text>Rth(j-c) IGBT (K/W)</Text>
            <InputNumber value={config.igbt?.thermal.rth_jc} onChange={v => {
              if (!config.igbt || v == null) return;
              onChange({ ...config, igbt: { ...config.igbt, thermal: { ...config.igbt.thermal, rth_jc: v } } });
            }} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rth(j-c) Diode (K/W)</Text>
            <InputNumber value={config.diode?.thermal.rth_jc} onChange={v => {
              if (!config.diode || v == null) return;
              onChange({ ...config, diode: { ...config.diode, thermal: { ...config.diode.thermal, rth_jc: v } } });
            }} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rth(c-s) Module (K/W)</Text>
            <InputNumber value={config.rth_ch_module} onChange={v => onChange({ ...config, rth_ch_module: v ?? undefined })} step={0.001} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rth(s-a) Heatsink (K/W)</Text>
            <InputNumber value={config.rth_ha} onChange={v => onChange({ ...config, rth_ha: v ?? undefined })} step={0.01} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Panel>
    </Collapse>
  );

  const renderSiCTab = () => (
    <Collapse defaultActiveKey={['basic', 'switching', 'thermal']} style={{ marginTop: 16 }}>
      <Panel header="SiC MOSFET 基本参数" key="basic">
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Text>模块名称</Text>
            <Input value={config.module_name} onChange={e => onChange({ ...config, module_name: e.target.value })} />
          </Col>
          <Col span={12}>
            <Text>制造商</Text>
            <Input value={config.manufacturer} onChange={e => onChange({ ...config, manufacturer: e.target.value })} />
          </Col>
          <Col span={6}>
            <Text>额定 Vds (V)</Text>
            <InputNumber value={config.sic_mos?.vds_rated} onChange={v => updateSiCMOS('vds_rated', v ?? undefined)} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>额定 Id (A)</Text>
            <InputNumber value={config.sic_mos?.id_nom} onChange={v => updateSiCMOS('id_nom', v ?? undefined)} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rds(on) @ 25°C (mΩ)</Text>
            <InputNumber value={config.sic_mos?.rds_on_25} onChange={v => updateSiCMOS('rds_on_25', v ?? undefined)} step={0.1} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rds(on) @ 125°C (mΩ)</Text>
            <InputNumber value={config.sic_mos?.rds_on_125} onChange={v => updateSiCMOS('rds_on_125', v ?? undefined)} step={0.1} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>VSD @ 25°C (V)</Text>
            <InputNumber value={config.sic_diode?.vsd_25} onChange={v => updateSiCDiode('vsd_25', v ?? undefined)} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>VSD @ 125°C (V)</Text>
            <InputNumber value={config.sic_diode?.vsd_125} onChange={v => updateSiCDiode('vsd_125', v ?? undefined)} step={0.01} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Panel>

      <Panel header="开关损耗参数" key="switching">
        <Text type="secondary">SiC MOSFET Eon / Eoff 数据点（电流 A, 能量 mJ）</Text>
        <SwitchingPointEditor
          label="Eon 点"
          points={config.sic_mos?.eon_curve.points ?? []}
          onChange={pts => updateSwitchingPoints('sic_mos', 'eon', pts)}
        />
        <Divider />
        <SwitchingPointEditor
          label="Eoff 点"
          points={config.sic_mos?.eoff_curve.points ?? []}
          onChange={pts => updateSwitchingPoints('sic_mos', 'eoff', pts)}
        />
      </Panel>

      <Panel header="热参数" key="thermal">
        <Row gutter={[16, 12]}>
          <Col span={6}>
            <Text>Rth(j-c) MOSFET (K/W)</Text>
            <InputNumber value={config.sic_mos?.thermal.rth_jc} onChange={v => {
              if (!config.sic_mos || v == null) return;
              onChange({ ...config, sic_mos: { ...config.sic_mos, thermal: { ...config.sic_mos.thermal, rth_jc: v } } });
            }} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rth(j-c) Diode (K/W)</Text>
            <InputNumber value={config.sic_diode?.thermal.rth_jc} onChange={v => {
              if (!config.sic_diode || v == null) return;
              onChange({ ...config, sic_diode: { ...config.sic_diode, thermal: { ...config.sic_diode.thermal, rth_jc: v } } });
            }} step={0.01} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rth(c-s) (K/W)</Text>
            <InputNumber value={config.rth_ch_module} onChange={v => onChange({ ...config, rth_ch_module: v ?? undefined })} step={0.001} style={{ width: '100%' }} />
          </Col>
          <Col span={6}>
            <Text>Rth(s-a) (K/W)</Text>
            <InputNumber value={config.rth_ha} onChange={v => onChange({ ...config, rth_ha: v ?? undefined })} step={0.01} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Panel>
    </Collapse>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>器件参数设置</Title>

      <Card style={{ marginBottom: 16 }}>
        <Dragger
          customRequest={handleUpload}
          showUploadList={false}
          accept=".pdf"
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽器件规格书 PDF 文件上传</p>
          <p className="ant-upload-hint">支持英飞凌、三菱、富士、赛米控、罗姆、科锐等品牌规格书</p>
        </Dragger>

        {parseResult && (
          <Alert
            type="info"
            style={{ marginTop: 16 }}
            message={`已解析: ${parseResult.metadata.manufacturer || '未知厂商'} - ${parseResult.metadata.part_number || '未识别型号'} (${parseResult.page_count} 页)`}
            showIcon
          />
        )}
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'manual',
            label: <span><EditOutlined /> 手动输入参数</span>,
            children: isSiC ? renderSiCTab() : renderIGBTTab(),
          },
        ]}
      />

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onBack}>上一步</Button>
        <Button type="primary" size="large" onClick={onNext}>
          下一步：工况设置
        </Button>
      </div>
    </div>
  );
}

// ── Helper: Switching point editor ──────────────────────────────────

function SwitchingPointEditor({
  label, points, onChange,
}: {
  label: string;
  points: SwitchingPoint[];
  onChange: (pts: SwitchingPoint[]) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <Text strong>{label}</Text>
      <Table
        size="small"
        pagination={false}
        dataSource={points.map((p, i) => ({ ...p, key: i }))}
        columns={[
          {
            title: '电流 (A)', dataIndex: 'current', width: 120,
            render: (_: number, __: SwitchingPoint, idx: number) => (
              <InputNumber
                size="small"
                value={points[idx]?.current}
                onChange={v => {
                  const next = [...points];
                  next[idx] = { ...next[idx], current: v ?? 0 };
                  onChange(next);
                }}
                style={{ width: 90 }}
              />
            ),
          },
          {
            title: '能量 (mJ)', dataIndex: 'energy', width: 120,
            render: (_: number, __: SwitchingPoint, idx: number) => (
              <InputNumber
                size="small"
                value={points[idx]?.energy}
                onChange={v => {
                  const next = [...points];
                  next[idx] = { ...next[idx], energy: v ?? 0 };
                  onChange(next);
                }}
                step={0.1}
                style={{ width: 90 }}
              />
            ),
          },
          {
            title: '', width: 80,
            render: (_: unknown, __: SwitchingPoint, idx: number) => (
              <Button size="small" danger onClick={() => {
                const next = points.filter((_, i) => i !== idx);
                onChange(next);
              }}>删除</Button>
            ),
          },
        ]}
        footer={() => (
          <Button size="small" type="dashed" block onClick={() => onChange([...points, { current: 0, energy: 0 }])}>
            + 添加数据点
          </Button>
        )}
      />
    </div>
  );
}

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

      // Auto-fill ALL extracted parameters, preserving existing values only when extracted value is missing
      const p = result.parameters;
      if (isSiC) {
        onChange({
          ...config,
          module_name: result.metadata.part_number || config.module_name,
          manufacturer: result.metadata.manufacturer || config.manufacturer,
          vdc_rated: (p.vds_rated as number) ?? config.vdc_rated,
          ic_rated: (p.id_nom as number) ?? config.ic_rated,
          t_j_max: (p.t_j_max as number) ?? config.t_j_max,
          num_parallel_chips: (p.num_parallel as number) ?? config.num_parallel_chips,
          sic_mos: config.sic_mos ? {
            ...config.sic_mos,
            rds_on_25: (p.rds_on_25 as number) ?? config.sic_mos?.rds_on_25,
            rds_on_125: (p.rds_on_125 as number) ?? config.sic_mos?.rds_on_125,
            vds_rated: (p.vds_rated as number) ?? config.sic_mos?.vds_rated,
            id_nom: (p.id_nom as number) ?? config.sic_mos?.id_nom,
            rg_int: (p.rg_int as number) ?? config.sic_mos?.rg_int,
          } : undefined,
          sic_diode: config.sic_diode ? {
            ...config.sic_diode,
            vsd_25: (p.vsd_25 as number) ?? config.sic_diode?.vsd_25,
            vsd_125: (p.vsd_125 as number) ?? config.sic_diode?.vsd_125,
            if_nom: (p.if_nom as number) ?? config.sic_diode?.if_nom,
          } : undefined,
          rth_ch_module: (p.rth_ch as number) ?? config.rth_ch_module,
          rth_ha: (p.rth_ha as number) ?? config.rth_ha,
        });
      } else {
        onChange({
          ...config,
          module_name: result.metadata.part_number || config.module_name,
          manufacturer: result.metadata.manufacturer || config.manufacturer,
          vdc_rated: (p.vce_rated as number) ?? config.vdc_rated,
          ic_rated: (p.ic_nom as number) ?? config.ic_rated,
          t_j_max: (p.t_j_max as number) ?? config.t_j_max,
          num_parallel_chips: (p.num_parallel as number) ?? config.num_parallel_chips,
          igbt: config.igbt ? {
            ...config.igbt,
            vce_sat_25: (p.vce_sat_25 as number) ?? config.igbt?.vce_sat_25,
            vce_sat_125: (p.vce_sat_125 as number) ?? config.igbt?.vce_sat_125,
            vce_rated: (p.vce_rated as number) ?? config.igbt?.vce_rated,
            ic_nom: (p.ic_nom as number) ?? config.igbt?.ic_nom,
            rg_int: (p.rg_int as number) ?? config.igbt?.rg_int,
          } : undefined,
          diode: config.diode ? {
            ...config.diode,
            vf_25: (p.vf_25 as number) ?? config.diode?.vf_25,
            vf_125: (p.vf_125 as number) ?? config.diode?.vf_125,
            if_nom: (p.if_nom as number) ?? config.diode?.if_nom,
            qrr: (p.qrr as number) ?? config.diode?.qrr,
          } : undefined,
          rth_ch_module: (p.rth_ch as number) ?? config.rth_ch_module,
          rth_ha: (p.rth_ha as number) ?? config.rth_ha,
        });
      }
      const extractedCount = Object.entries(p).filter(([k, v]) => k !== 'confidence' && v != null).length;
      message.success(`参数提取完成，已提取 ${extractedCount} 个参数 — 请在下方查看并微调`);
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

  const renderExtractedView = () => {
    if (!parseResult) return null;
    const p = parseResult.parameters;
    const conf = (p.confidence as Record<string, number>) || {};
    const isSiC = config.device_type === 'sic_module' || config.device_type === 'sic_discrete';

    // ── All param definitions with backend key → label → get/set mapping ──
    interface ParamDef { key: string; label: string; getVal: () => number | undefined; setVal: (v: number | undefined) => void; confidence: number | undefined; readOnly?: boolean; }
    const allDefs: ParamDef[] = [];

    // Helper: add if param exists in extraction result
    const add = (bk: string, label: string, getVal: () => number | undefined, setVal: (v: number | undefined) => void, readOnly = false) => {
      if (p[bk] != null) {
        allDefs.push({ key: bk, label, getVal, setVal, confidence: conf[bk], readOnly });
      }
    };

    if (isSiC) {
      add('rds_on_25', 'Rds(on) @25°C (mΩ)', () => config.sic_mos?.rds_on_25, v => updateSiCMOS('rds_on_25', v));
      add('rds_on_125', 'Rds(on) @125°C (mΩ)', () => config.sic_mos?.rds_on_125, v => updateSiCMOS('rds_on_125', v));
      add('vds_rated', '额定 Vds (V)', () => config.sic_mos?.vds_rated, v => updateSiCMOS('vds_rated', v));
      add('id_nom', '额定 Id (A)', () => config.sic_mos?.id_nom, v => updateSiCMOS('id_nom', v));
      add('vsd_25', 'VSD @25°C (V)', () => config.sic_diode?.vsd_25, v => updateSiCDiode('vsd_25', v));
      add('vsd_125', 'VSD @125°C (V)', () => config.sic_diode?.vsd_125, v => updateSiCDiode('vsd_125', v));
      add('eon', 'Eon (mJ)', () => config.sic_mos?.eon_curve.points[0]?.energy, v => {
        if (v != null && config.sic_mos) { const pts = [...config.sic_mos.eon_curve.points]; pts[0] = { ...pts[0], energy: v }; onChange({ ...config, sic_mos: { ...config.sic_mos, eon_curve: { ...config.sic_mos.eon_curve, points: pts } } }); }
      });
      add('eoff', 'Eoff (mJ)', () => config.sic_mos?.eoff_curve.points[0]?.energy, v => {
        if (v != null && config.sic_mos) { const pts = [...config.sic_mos.eoff_curve.points]; pts[0] = { ...pts[0], energy: v }; onChange({ ...config, sic_mos: { ...config.sic_mos, eoff_curve: { ...config.sic_mos.eoff_curve, points: pts } } }); }
      });
      add('qrr', 'Qrr (μC)', () => config.sic_diode?.qrr, v => updateSiCDiode('qrr', v));
      add('rth_jc_mos', 'Rth(j-c) MOSFET (K/W)', () => config.sic_mos?.thermal.rth_jc, v => {
        if (v != null && config.sic_mos) onChange({ ...config, sic_mos: { ...config.sic_mos, thermal: { ...config.sic_mos.thermal, rth_jc: v } } });
      });
      add('rth_jc_diode', 'Rth(j-c) Diode (K/W)', () => config.sic_diode?.thermal.rth_jc, v => {
        if (v != null && config.sic_diode) onChange({ ...config, sic_diode: { ...config.sic_diode, thermal: { ...config.sic_diode.thermal, rth_jc: v } } });
      });
      add('rth_cs', 'Rth(c-s) Module (K/W)', () => config.rth_ch_module, v => onChange({ ...config, rth_ch_module: v }));
      // Read-only reference info
      add('eon_id_ref', 'Eon @ Id_ref (A)', () => p.eon_id_ref as number | undefined, () => {}, true);
      add('eoff_id_ref', 'Eoff @ Id_ref (A)', () => p.eoff_id_ref as number | undefined, () => {}, true);
      add('eon_vdd_ref', 'Eon @ Vdd_ref (V)', () => p.eon_vdd_ref as number | undefined, () => {}, true);
      add('eoff_vdd_ref', 'Eoff @ Vdd_ref (V)', () => p.eoff_vdd_ref as number | undefined, () => {}, true);
      add('eon_rg_ref', 'Eon @ Rg_ref (Ω)', () => p.eon_rg_ref as number | undefined, () => {}, true);
      add('eoff_rg_ref', 'Eoff @ Rg_ref (Ω)', () => p.eoff_rg_ref as number | undefined, () => {}, true);
    } else {
      // IGBT
      add('vce_sat_25', 'Vce(sat) @25°C (V)', () => config.igbt?.vce_sat_25, v => updateIGBT('vce_sat_25', v));
      add('vce_sat_125', 'Vce(sat) @125°C (V)', () => config.igbt?.vce_sat_125, v => updateIGBT('vce_sat_125', v));
      add('vce_rated', '额定 Vce (V)', () => config.igbt?.vce_rated, v => updateIGBT('vce_rated', v));
      add('ic_nom', '额定 Ic (A)', () => config.igbt?.ic_nom, v => updateIGBT('ic_nom', v));
      add('vf_25', 'Vf @25°C (V)', () => config.diode?.vf_25, v => updateDiode('vf_25', v));
      add('vf_125', 'Vf @125°C (V)', () => config.diode?.vf_125, v => updateDiode('vf_125', v));
      add('eon', 'Eon (mJ)', () => config.igbt?.eon_curve.points[0]?.energy, v => {
        if (v != null && config.igbt) { const pts = [...config.igbt.eon_curve.points]; pts[0] = { ...pts[0], energy: v }; onChange({ ...config, igbt: { ...config.igbt, eon_curve: { ...config.igbt.eon_curve, points: pts } } }); }
      });
      add('eoff', 'Eoff (mJ)', () => config.igbt?.eoff_curve.points[0]?.energy, v => {
        if (v != null && config.igbt) { const pts = [...config.igbt.eoff_curve.points]; pts[0] = { ...pts[0], energy: v }; onChange({ ...config, igbt: { ...config.igbt, eoff_curve: { ...config.igbt.eoff_curve, points: pts } } }); }
      });
      add('err', 'Err (mJ)', () => config.diode?.err_curve.points[0]?.energy, v => {
        if (v != null && config.diode) { const pts = [...config.diode.err_curve.points]; pts[0] = { ...pts[0], energy: v }; onChange({ ...config, diode: { ...config.diode, err_curve: { ...config.diode.err_curve, points: pts } } }); }
      });
      add('qrr', 'Qrr (μC)', () => config.diode?.qrr, v => updateDiode('qrr', v));
      add('rth_jc_igbt', 'Rth(j-c) IGBT (K/W)', () => config.igbt?.thermal.rth_jc, v => {
        if (v != null && config.igbt) onChange({ ...config, igbt: { ...config.igbt, thermal: { ...config.igbt.thermal, rth_jc: v } } });
      });
      add('rth_jc_diode', 'Rth(j-c) Diode (K/W)', () => config.diode?.thermal.rth_jc, v => {
        if (v != null && config.diode) onChange({ ...config, diode: { ...config.diode, thermal: { ...config.diode.thermal, rth_jc: v } } });
      });
      add('rth_cs', 'Rth(c-s) Module (K/W)', () => config.rth_ch_module, v => onChange({ ...config, rth_ch_module: v }));
      add('rg_int', '内部 Rg (Ω)', () => config.igbt?.rg_int, v => updateIGBT('rg_int', v));
      add('t_j_max', '最高结温 Tj_max (°C)', () => config.t_j_max, v => onChange({ ...config, t_j_max: v ?? 150 }));
      // Read-only reference info
      add('eon_ic_ref', 'Eon @ Ic_ref (A)', () => p.eon_ic_ref as number | undefined, () => {}, true);
      add('eoff_ic_ref', 'Eoff @ Ic_ref (A)', () => p.eoff_ic_ref as number | undefined, () => {}, true);
      add('eon_vcc_ref', 'Eon @ Vcc_ref (V)', () => p.eon_vcc_ref as number | undefined, () => {}, true);
      add('eoff_vcc_ref', 'Eoff @ Vcc_ref (V)', () => p.eoff_vcc_ref as number | undefined, () => {}, true);
      add('eon_rg_ref', 'Eon @ Rg_ref (Ω)', () => p.eon_rg_ref as number | undefined, () => {}, true);
      add('eoff_rg_ref', 'Eoff @ Rg_ref (Ω)', () => p.eoff_rg_ref as number | undefined, () => {}, true);
      add('ton', '开通时间 ton (ns)', () => p.ton as number | undefined, () => {}, true);
      add('toff', '关断时间 toff (ns)', () => p.toff as number | undefined, () => {}, true);
      add('cies', '输入电容 Cies (nF)', () => p.cies as number | undefined, () => {}, true);
    }

    const extractedCount = allDefs.length;
    const editable = allDefs.filter(d => !d.readOnly);
    const info = allDefs.filter(d => d.readOnly);

    return (
      <div>
        <Alert
          type="success"
          showIcon
          message={`已提取 ${extractedCount} 个参数（${editable.length} 个可编辑，${info.length} 个参考信息）`}
          description={`型号: ${parseResult.metadata.part_number || '未识别'} | 厂商: ${parseResult.metadata.manufacturer || '未识别'} | 页数: ${parseResult.page_count}`}
          style={{ marginBottom: 16 }}
        />
        {editable.length > 0 && (
          <Card size="small" title="可编辑参数（已自动填入，下方可直接微调）" style={{ marginBottom: 12 }}>
            <Row gutter={[12, 8]}>
              {editable.map(d => {
                const val = d.getVal();
                const hasConf = d.confidence != null;
                return (
                  <Col span={8} key={d.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, minHeight: 20 }}>
                      <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{d.label}</Text>
                      {hasConf && (
                        <Tag color={d.confidence! >= 0.8 ? 'green' : d.confidence! >= 0.5 ? 'orange' : 'red'}
                          style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px', margin: 0 }}>
                          {Math.round(d.confidence! * 100)}%
                        </Tag>
                      )}
                    </div>
                    <InputNumber
                      size="small"
                      value={val}
                      onChange={(v: number | null) => d.setVal(v ?? undefined)}
                      step={d.key.includes('rth') ? 0.01 : d.key.includes('rds') ? 0.1 : 0.01}
                      style={{ width: '100%' }}
                    />
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}
        {info.length > 0 && (
          <Card size="small" title="参考信息（开关能量测试条件，仅供核对）" style={{ marginBottom: 12 }}>
            <Row gutter={[12, 8]}>
              {info.map(d => {
                const val = d.getVal();
                return (
                  <Col span={8} key={d.key}>
                    <Text style={{ fontSize: 11, color: '#666' }}>{d.label}</Text>
                    <div><Text strong style={{ fontSize: 13 }}>{val != null ? val : '—'}</Text></div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}
        {parseResult.raw_text_sample && (
          <Collapse items={[{
            key: 'raw',
            label: <Text type="secondary">查看原文提取片段</Text>,
            children: <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8, borderRadius: 4 }}>{parseResult.raw_text_sample}</pre>,
          }]} />
        )}
      </div>
    );
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
          ...(parseResult ? [{
            key: 'extracted',
            label: <span><CheckCircleOutlined /> 规格书提取参数</span>,
            children: renderExtractedView(),
          }] : []),
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

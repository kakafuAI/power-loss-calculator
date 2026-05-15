import { useState } from 'react';
import {
  Card, Tabs, Button, Space, Typography, InputNumber, Input, Upload,
  Table, Tag, message, Collapse, Row, Col, Descriptions, Alert,
  Divider, Tooltip, Badge,
} from 'antd';
import { UploadOutlined, InboxOutlined, EditOutlined, CheckCircleOutlined, QuestionCircleOutlined, WarningOutlined } from '@ant-design/icons';
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

type ConfLevel = 'high' | 'medium' | 'low' | null;

export default function ParameterPanel({ config, onChange, onBack, onNext }: Props) {
  const [parseResult, setParseResult] = useState<PDFParseResult | null>(null);
  const [uploading, setUploading] = useState(false);

  const isSiC = config.device_type === 'sic_module' || config.device_type === 'sic_discrete';

  // ── Helpers: get extracted value / confidence from parseResult ──
  const p = parseResult?.parameters || {};
  const pConf = (p.confidence as Record<string, number>) || {};

  const extVal = (key: string): number | undefined => {
    const v = p[key];
    return v != null && typeof v === 'number' ? v : undefined;
  };

  const extStr = (key: string): string | undefined => {
    const v = p[key];
    return v != null && typeof v === 'string' ? v : undefined;
  };

  const confLevel = (key: string): ConfLevel => {
    const c = pConf[key];
    if (c == null) return null;
    if (c >= 0.8) return 'high';
    if (c >= 0.5) return 'medium';
    return 'low';
  };

  const confTag = (key: string) => {
    const level = confLevel(key);
    if (!level) return null;
    const color = level === 'high' ? 'green' : level === 'medium' ? 'orange' : 'red';
    const icon = level === 'high' ? <CheckCircleOutlined /> : level === 'medium' ? <QuestionCircleOutlined /> : <WarningOutlined />;
    const pct = Math.round((pConf[key] || 0) * 100);
    return <Tooltip title={`AI 置信度: ${pct}%`}><Tag color={color} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>{icon} {pct}%</Tag></Tooltip>;
  };

  // ── Upload handler ──────────────────────────────────────────────────
  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File;
    setUploading(true);
    try {
      const result = await parseDatasheet(file, config.device_type);
      setParseResult(result);

      const params: Record<string, unknown> = result.parameters;
      // Determine metadata: LLM first, then regex
      const partNo = extStr('part_number') || result.metadata?.part_number;
      const mfr = extStr('manufacturer') || extStr('manufacturer_name') || result.metadata?.manufacturer;

      // Build new config with extracted values merged into existing structure
      const newConfig: ModuleConfig = {
        ...config,
        module_name: (partNo as string) || config.module_name,
        manufacturer: (mfr as string) || config.manufacturer,
        vdc_rated: (isSiC ? params.vds_rated : params.vce_rated) as number ?? config.vdc_rated,
        ic_rated: (isSiC ? params.id_nom : params.ic_nom) as number ?? config.ic_rated,
        t_j_max: (params.t_j_max as number) ?? config.t_j_max,
        num_parallel_chips: (params.num_parallel as number) ?? config.num_parallel_chips,
        rth_ch_module: (params.rth_cs as number) ?? config.rth_ch_module,
      };

      // Helper: normalize multi-point switching data from [[x,y],...] or [{current,energy},...]
      const normSwPts = (raw: unknown): SwitchingPoint[] => {
        if (!Array.isArray(raw) || !raw.length) return [];
        return raw.map((p: any) => {
          if (Array.isArray(p) && p.length >= 2) return { current: Number(p[0]), energy: Number(p[1]) };
          if (typeof p.current === 'number' && typeof p.energy === 'number') return { current: p.current, energy: p.energy };
          return null;
        }).filter(Boolean) as SwitchingPoint[];
      };

      if (isSiC) {
        const mos = config.sic_mos;
        const dio = config.sic_diode;
        if (mos) {
          // Build switching curves from extraction
          const eonRefId = (params.eon_id_ref as number) ?? mos.eon_curve.points[0]?.current ?? mos.id_nom;
          const eoffRefId = (params.eoff_id_ref as number) ?? mos.eoff_curve.points[0]?.current ?? mos.id_nom;
          const eonRefVdd = (params.eon_vdd_ref as number) ?? mos.eon_curve.vcc;
          const eoffRefVdd = (params.eoff_vdd_ref as number) ?? mos.eoff_curve.vcc;
          const eonRefRg = (params.eon_rg_ref as number) ?? mos.eon_curve.rg;
          const eoffRefRg = (params.eoff_rg_ref as number) ?? mos.eoff_curve.rg;
          const eonVal = params.eon as number | undefined;
          const eoffVal = params.eoff as number | undefined;
          const eonPts = normSwPts(params.eon_points);
          const eoffPts = normSwPts(params.eoff_points);

          let eonCurve = mos.eon_curve;
          if (eonPts.length) {
            eonCurve = { vcc: eonRefVdd, rg: eonRefRg, tj: 150, points: eonPts };
          } else if (eonVal != null) {
            eonCurve = { vcc: eonRefVdd, rg: eonRefRg, tj: 150, points: [{ current: eonRefId, energy: eonVal }] };
          }
          let eoffCurve = mos.eoff_curve;
          if (eoffPts.length) {
            eoffCurve = { vcc: eoffRefVdd, rg: eoffRefRg, tj: 150, points: eoffPts };
          } else if (eoffVal != null) {
            eoffCurve = { vcc: eoffRefVdd, rg: eoffRefRg, tj: 150, points: [{ current: eoffRefId, energy: eoffVal }] };
          }

          newConfig.sic_mos = {
            ...mos,
            rds_on_25: (params.rds_on_25 as number) ?? mos.rds_on_25,
            rds_on_125: (params.rds_on_125 as number) ?? mos.rds_on_125,
            vds_rated: (params.vds_rated as number) ?? mos.vds_rated,
            id_nom: (params.id_nom as number) ?? mos.id_nom,
            rg_int: (params.rg_int as number) ?? mos.rg_int,
            eon_curve: eonCurve,
            eoff_curve: eoffCurve,
          };
        }
        if (dio) {
          newConfig.sic_diode = {
            ...dio,
            vsd_25: (params.vsd_25 as number) ?? dio.vsd_25,
            vsd_125: (params.vsd_125 as number) ?? dio.vsd_125,
            if_nom: (params.if_nom as number) ?? dio.if_nom,
          };
        }
      } else {
        const igbt = config.igbt;
        const diode = config.diode;
        if (igbt) {
          const eonRefIc = (params.eon_ic_ref as number) ?? igbt.eon_curve.points[0]?.current ?? igbt.ic_nom;
          const eoffRefIc = (params.eoff_ic_ref as number) ?? igbt.eoff_curve.points[0]?.current ?? igbt.ic_nom;
          const eonRefVcc = (params.eon_vcc_ref as number) ?? igbt.eon_curve.vcc;
          const eoffRefVcc = (params.eoff_vcc_ref as number) ?? igbt.eoff_curve.vcc;
          const eonRefRg = (params.eon_rg_ref as number) ?? igbt.eon_curve.rg;
          const eoffRefRg = (params.eoff_rg_ref as number) ?? igbt.eoff_curve.rg;
          const eonVal = params.eon as number | undefined;
          const eoffVal = params.eoff as number | undefined;
          const eonPts = normSwPts(params.eon_points);
          const eoffPts = normSwPts(params.eoff_points);

          let eonCurve = igbt.eon_curve;
          if (eonPts.length) {
            eonCurve = { vcc: eonRefVcc, rg: eonRefRg, tj: 125, points: eonPts };
          } else if (eonVal != null) {
            eonCurve = { vcc: eonRefVcc, rg: eonRefRg, tj: 125, points: [{ current: eonRefIc, energy: eonVal }] };
          }
          let eoffCurve = igbt.eoff_curve;
          if (eoffPts.length) {
            eoffCurve = { vcc: eoffRefVcc, rg: eoffRefRg, tj: 125, points: eoffPts };
          } else if (eoffVal != null) {
            eoffCurve = { vcc: eoffRefVcc, rg: eoffRefRg, tj: 125, points: [{ current: eoffRefIc, energy: eoffVal }] };
          }

          newConfig.igbt = {
            ...igbt,
            vce_sat_25: (params.vce_sat_25 as number) ?? igbt.vce_sat_25,
            vce_sat_125: (params.vce_sat_125 as number) ?? igbt.vce_sat_125,
            vce_rated: (params.vce_rated as number) ?? igbt.vce_rated,
            ic_nom: (params.ic_nom as number) ?? igbt.ic_nom,
            rg_int: (params.rg_int as number) ?? igbt.rg_int,
            eon_curve: eonCurve,
            eoff_curve: eoffCurve,
          };
        }
        if (diode) {
          const errRefIf = (params.err_if_ref as number) ?? diode.err_curve.points[0]?.current ?? diode.if_nom;
          const errRefVr = (params.err_vr_ref as number) ?? diode.err_curve.vcc;
          const errVal = params.err as number | undefined;
          const errPts = normSwPts(params.err_points);

          let errCurve = diode.err_curve;
          if (errPts.length) {
            errCurve = { vcc: errRefVr, rg: diode.err_curve.rg, tj: 125, points: errPts };
          } else if (errVal != null) {
            errCurve = { vcc: errRefVr, rg: diode.err_curve.rg, tj: 125, points: [{ current: errRefIf, energy: errVal }] };
          }

          newConfig.diode = {
            ...diode,
            vf_25: (params.vf_25 as number) ?? diode.vf_25,
            vf_125: (params.vf_125 as number) ?? diode.vf_125,
            if_nom: (params.if_nom as number) ?? diode.if_nom,
            qrr: (params.qrr as number) ?? diode.qrr,
            err_curve: errCurve,
          };
        }
      }

      onChange(newConfig);
      const extractedCount = Object.entries(params).filter(
        ([k, v]) => k !== 'confidence' && v != null
      ).length;
      message.success(`AI 已提取 ${extractedCount} 个参数 — 已自动填入，可微调后继续`);
    } catch (err) {
      message.error('PDF 解析失败，请检查文件格式或网络');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // ── State updaters ──────────────────────────────────────────────────
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

  // ── Unified field renderer with confidence ──────────────────────────
  const renderField = (
    key: string, label: string, value: number | undefined,
    onChange: (v: number | undefined) => void,
    opts?: { step?: number; min?: number; span?: number },
  ) => {
    const step = opts?.step ?? (key.includes('rth') ? 0.001 : 0.01);
    const colSpan = opts?.span ?? 6;
    const hasConf = confLevel(key) !== null;
    return (
      <Col span={colSpan} key={key}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{label}</Text>
          {hasConf && confTag(key)}
        </div>
        <InputNumber
          size="small"
          value={value}
          onChange={v => onChange(v ?? undefined)}
          step={step}
          style={{ width: '100%', borderColor: hasConf ? (confLevel(key) === 'high' ? '#52c41a' : confLevel(key) === 'medium' ? '#faad14' : '#ff4d4f') : undefined }}
        />
      </Col>
    );
  };

  // ── Main render — always unified, no tabs ──────────────────────────
  const partNoFromLLM = extStr('part_number');
  const mfrFromLLM = extStr('manufacturer') || extStr('manufacturer_name');

  const renderUnifiedView = () => {
    if (isSiC) {
      const mos = config.sic_mos;
      const dio = config.sic_diode;
      if (!mos || !dio) return null;
      return (
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
              {renderField('vds_rated', '额定 Vds (V)', mos.vds_rated, v => updateSiCMOS('vds_rated', v), { step: 10 })}
              {renderField('id_nom', '额定 Id (A)', mos.id_nom, v => updateSiCMOS('id_nom', v))}
              {renderField('rds_on_25', 'Rds(on) @25°C (mΩ)', mos.rds_on_25, v => updateSiCMOS('rds_on_25', v), { step: 0.1 })}
              {renderField('rds_on_125', 'Rds(on) @125°C (mΩ)', mos.rds_on_125, v => updateSiCMOS('rds_on_125', v), { step: 0.1 })}
              {renderField('vsd_25', 'VSD @25°C (V)', dio.vsd_25, v => updateSiCDiode('vsd_25', v), { step: 0.01 })}
              {renderField('vsd_125', 'VSD @125°C (V)', dio.vsd_125, v => updateSiCDiode('vsd_125', v), { step: 0.01 })}
              {renderField('rg_int', '内部 Rg (Ω)', mos.rg_int, v => updateSiCMOS('rg_int', v), { step: 0.1 })}
              {renderField('t_j_max', '最高结温 (°C)', config.t_j_max, v => onChange({ ...config, t_j_max: v ?? 150 }), { step: 1, span: 6 })}
              <Col span={6}>
                <Text>额定 Vdc (V)</Text>
                <InputNumber size="small" value={config.vdc_rated} onChange={v => onChange({ ...config, vdc_rated: v ?? 1200 })} style={{ width: '100%' }} />
              </Col>
              <Col span={6}>
                <Text>额定 Ic (A)</Text>
                <InputNumber size="small" value={config.ic_rated} onChange={v => onChange({ ...config, ic_rated: v ?? 100 })} style={{ width: '100%' }} />
              </Col>
            </Row>
          </Panel>

          <Panel header="开关损耗参数" key="switching">
            <Text type="secondary">
              SiC MOSFET Eon / Eoff 数据点（电流 A, 能量 mJ）
              &nbsp;参考: Vdd={mos.eon_curve.vcc}V, Rg={mos.eon_curve.rg}Ω
              {confTag('eon')} {confTag('eoff')}
            </Text>
            <SwitchingPointEditor label="Eon 点" points={mos.eon_curve.points} onChange={pts => onChange({ ...config, sic_mos: { ...mos, eon_curve: { ...mos.eon_curve, points: pts } } })} showConf />
            <Divider />
            <SwitchingPointEditor label="Eoff 点" points={mos.eoff_curve.points} onChange={pts => onChange({ ...config, sic_mos: { ...mos, eoff_curve: { ...mos.eoff_curve, points: pts } } })} showConf />
          </Panel>

          <Panel header="热参数" key="thermal">
            <Row gutter={[16, 12]}>
              {renderField('rth_jc_mos', 'Rth(j-c) MOSFET (K/W)', mos.thermal.rth_jc, v => onChange({ ...config, sic_mos: { ...mos, thermal: { ...mos.thermal, rth_jc: v ?? 0 } } }), { step: 0.001 })}
              {renderField('rth_jc_diode', 'Rth(j-c) Diode (K/W)', dio.thermal.rth_jc, v => onChange({ ...config, sic_diode: { ...dio, thermal: { ...dio.thermal, rth_jc: v ?? 0 } } }), { step: 0.001 })}
              {renderField('rth_cs', 'Rth(c-s) Module (K/W)', config.rth_ch_module, v => onChange({ ...config, rth_ch_module: v }), { step: 0.001 })}
              <Col span={6}>
                <Text>Rth(s-a) Heatsink (K/W)</Text>
                <InputNumber size="small" value={config.rth_ha} onChange={v => onChange({ ...config, rth_ha: v ?? undefined })} step={0.001} style={{ width: '100%' }} />
              </Col>
            </Row>
          </Panel>
        </Collapse>
      );
    }

    // IGBT
    const igbt = config.igbt;
    const diode = config.diode;
    if (!igbt || !diode) return null;
    return (
      <Collapse defaultActiveKey={['basic', 'diode', 'switching', 'thermal']} style={{ marginTop: 16 }}>
        <Panel header="基本参数" key="basic">
          <Row gutter={[16, 12]}>
            <Col span={12}>
              <Text>模块名称</Text>
              <Input value={config.module_name} onChange={e => onChange({ ...config, module_name: e.target.value })} placeholder="如: FS100R12KT4" />
            </Col>
            <Col span={12}>
              <Text>制造商</Text>
              <Input value={config.manufacturer} onChange={e => onChange({ ...config, manufacturer: e.target.value })} placeholder="如: Infineon" />
            </Col>
            {renderField('vce_rated', '额定 Vce (V)', config.vdc_rated, v => onChange({ ...config, vdc_rated: v ?? 1200 }), { step: 10 })}
            {renderField('ic_nom', '额定 Ic (A)', config.ic_rated, v => onChange({ ...config, ic_rated: v ?? 100 }))}
            {renderField('vce_sat_25', 'Vce(sat) @ 25°C (V)', igbt.vce_sat_25, v => updateIGBT('vce_sat_25', v), { step: 0.01 })}
            {renderField('vce_sat_125', 'Vce(sat) @ 125°C (V)', igbt.vce_sat_125, v => updateIGBT('vce_sat_125', v), { step: 0.01 })}
            {renderField('ic_nom', '额定 Ic_nom (A)', igbt.ic_nom, v => updateIGBT('ic_nom', v))}
            {renderField('t_j_max', '最高结温 (°C)', config.t_j_max, v => onChange({ ...config, t_j_max: v ?? 150 }), { step: 1, span: 6 })}
            {renderField('rg_int', '内部 Rg (Ω)', igbt.rg_int, v => updateIGBT('rg_int', v), { step: 0.1, span: 6 })}
          </Row>
        </Panel>

        <Panel header="二极管参数 (FWD)" key="diode">
          <Row gutter={[16, 12]}>
            {renderField('vf_25', 'Vf @ 25°C (V)', diode.vf_25, v => updateDiode('vf_25', v), { step: 0.01 })}
            {renderField('vf_125', 'Vf @ 125°C (V)', diode.vf_125, v => updateDiode('vf_125', v), { step: 0.01 })}
            {renderField('qrr', 'Qrr (μC)', diode.qrr, v => updateDiode('qrr', v), { step: 0.1 })}
            <Col span={6}>
              <Text>额定 If (A)</Text>
              <InputNumber size="small" value={diode.if_nom} onChange={v => updateDiode('if_nom', v ?? undefined)} style={{ width: '100%' }} />
            </Col>
          </Row>
        </Panel>

        <Panel header="开关损耗参数" key="switching">
          <Text type="secondary">
            Eon / Eoff / Err 数据点（电流 A, 能量 mJ）
            &nbsp;参考: Vcc={igbt.eon_curve.vcc ?? 600}V, Rg={igbt.eon_curve.rg ?? 10}Ω
            {confTag('eon')} {confTag('eoff')} {confTag('err')}
          </Text>
          <SwitchingPointEditor label="Eon 点" points={igbt.eon_curve.points} onChange={pts => onChange({ ...config, igbt: { ...igbt, eon_curve: { ...igbt.eon_curve, points: pts } } })} showConf />
          <Divider />
          <SwitchingPointEditor label="Eoff 点" points={igbt.eoff_curve.points} onChange={pts => onChange({ ...config, igbt: { ...igbt, eoff_curve: { ...igbt.eoff_curve, points: pts } } })} showConf />
          <Divider />
          <SwitchingPointEditor label="Err 点 (二极管反向恢复)" points={diode.err_curve.points} onChange={pts => onChange({ ...config, diode: { ...diode, err_curve: { ...diode.err_curve, points: pts } } })} showConf />
        </Panel>

        <Panel header="热参数" key="thermal">
          <Row gutter={[16, 12]}>
            {renderField('rth_jc_igbt', 'Rth(j-c) IGBT (K/W)', igbt.thermal.rth_jc, v => onChange({ ...config, igbt: { ...igbt, thermal: { ...igbt.thermal, rth_jc: v ?? 0 } } }), { step: 0.001 })}
            {renderField('rth_jc_diode', 'Rth(j-c) Diode (K/W)', diode.thermal.rth_jc, v => onChange({ ...config, diode: { ...diode, thermal: { ...diode.thermal, rth_jc: v ?? 0 } } }), { step: 0.001 })}
            {renderField('rth_cs', 'Rth(c-s) Module (K/W)', config.rth_ch_module, v => onChange({ ...config, rth_ch_module: v }), { step: 0.001 })}
            <Col span={6}>
              <Text>Rth(s-a) Heatsink (K/W)</Text>
              <InputNumber size="small" value={config.rth_ha} onChange={v => onChange({ ...config, rth_ha: v ?? undefined })} step={0.001} style={{ width: '100%' }} />
            </Col>
          </Row>
        </Panel>
      </Collapse>
    );
  };

  // ── Alert message with metadata ─────────────────────────────────────
  const alertMsg = () => {
    if (!parseResult) return null;
    const pn = extStr('part_number') || parseResult.metadata.part_number || '未识别型号';
    const mn = extStr('manufacturer') || extStr('manufacturer_name') || parseResult.metadata.manufacturer || '未知厂商';
    const extractedCount = Object.entries(p).filter(([k, v]) => k !== 'confidence' && v != null).length;
    return (
      <Alert
        type="success"
        style={{ marginTop: 16 }}
        message={`已解析: ${mn} - ${pn} | 提取 ${extractedCount} 个参数 (${parseResult.page_count} 页)`}
        description="参数已自动填入下方表单。绿色 = 高置信度(≥80%), 橙色 = 中置信度(50-79%), 红色 = 低置信度(<50%)。请检查后微调。"
        showIcon
      />
    );
  };

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
        {alertMsg()}
      </Card>

      {renderUnifiedView()}

      {parseResult?.raw_text_sample && (
        <Collapse style={{ marginTop: 16 }} items={[{
          key: 'raw',
          label: <Text type="secondary">查看原文提取片段</Text>,
          children: <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8, borderRadius: 4 }}>{parseResult.raw_text_sample}</pre>,
        }]} />
      )}

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
  label, points, onChange, showConf,
}: {
  label: string;
  points: SwitchingPoint[];
  onChange: (pts: SwitchingPoint[]) => void;
  showConf?: boolean;
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

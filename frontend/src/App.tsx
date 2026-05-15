import { useState, useCallback } from 'react';
import {
  Layout, Steps, Typography, theme, ConfigProvider, App as AntApp,
  Menu, Button,
} from 'antd';
import {
  ThunderboltOutlined, BookOutlined, ExperimentOutlined,
  HistoryOutlined, BarChartOutlined, SettingOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import DeviceSelector from './components/DeviceSelector';
import ParameterPanel from './components/ParameterPanel';
import ConditionInput from './components/ConditionInput';
import ResultDashboard from './components/ResultDashboard';
import ConceptExplorer from './components/concepts/ConceptExplorer';
import DeviceLibrary from './pages/DeviceLibrary';
import CalculationHistory from './pages/CalculationHistory';
import ComparisonView from './pages/ComparisonView';
import ConceptDemoCompare from './pages/ConceptDemoCompare';
import ConductionLossCompare from './pages/ConductionLossCompare';
import ThermalNetworkCompare from './pages/ThermalNetworkCompare';
import type { ModuleConfig, OperatingConditions, CalculationResult, DeviceType } from './types';
import { calculateLossesCombined, saveHistory } from './api/client';
import { message } from 'antd';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const defaultConfig: ModuleConfig = {
  device_type: 'igbt_module', module_name: '', manufacturer: '',
  vdc_rated: 1200, ic_rated: 100, num_parallel_chips: 1, t_j_max: 150,
  igbt: {
    vce_sat_25: 1.7, vce_sat_125: 2.0, ic_nom: 100, vce_rated: 1200,
    eon_curve: { vcc: 600, rg: 10, tj: 125, points: [{ current: 100, energy: 15 }] },
    eoff_curve: { vcc: 600, rg: 10, tj: 125, points: [{ current: 100, energy: 10 }] },
    thermal: { rth_jc: 0.24 },
  },
  diode: {
    vf_25: 1.8, vf_125: 1.6, if_nom: 100,
    err_curve: { vcc: 600, rg: 10, tj: 125, points: [{ current: 100, energy: 8 }] },
    qrr: 5, thermal: { rth_jc: 0.42 },
  },
  rth_ch_module: 0.02, rth_ha: 0.08,
};

const defaultConditions: OperatingConditions = {
  vdc: 600, i_out_rms: 50, f_out: 50, f_sw: 4000,
  modulation_index: 1.0, power_factor: 0.85, modulation: 'spwm', t_ambient: 40,
};

type PageKey = 'calculate' | 'devices' | 'concepts' | 'history' | 'compare' | 'demo' | 'cond_demo' | 'therm_demo';

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentPage, setCurrentPage] = useState<PageKey>('calculate');
  const [config, setConfig] = useState<ModuleConfig>(defaultConfig);
  const [conditions, setConditions] = useState<OperatingConditions>(defaultConditions);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();

  const handleDeviceTypeChange = useCallback((type: DeviceType) => {
    setConfig(prev => {
      const next = { ...prev, device_type: type };
      if (type === 'sic_module') {
        next.sic_mos = {
          rds_on_25: 20, rds_on_125: 35, id_nom: 100, vds_rated: 1200,
          eon_curve: { vcc: 800, rg: 5, tj: 150, points: [{ current: 100, energy: 1.8 }] },
          eoff_curve: { vcc: 800, rg: 5, tj: 150, points: [{ current: 100, energy: 1.2 }] },
          thermal: { rth_jc: 0.2 },
        };
        next.sic_diode = {
          vsd_25: 1.35, vsd_125: 1.2, if_nom: 100, qrr: 0, thermal: { rth_jc: 0.3 },
        };
        next.igbt = undefined; next.diode = undefined;
        next.vdc_rated = 1200; next.ic_rated = 100; next.t_j_max = 175;
      } else if (type === 'sic_discrete') {
        next.sic_mos = {
          rds_on_25: 40, rds_on_125: 65, id_nom: 50, vds_rated: 1200,
          eon_curve: { vcc: 800, rg: 5, tj: 150, points: [{ current: 50, energy: 0.9 }] },
          eoff_curve: { vcc: 800, rg: 5, tj: 150, points: [{ current: 50, energy: 0.6 }] },
          thermal: { rth_jc: 0.6 },
        };
        next.sic_diode = {
          vsd_25: 1.35, vsd_125: 1.2, if_nom: 50, qrr: 0, thermal: { rth_jc: 0.8 },
        };
        next.igbt = undefined; next.diode = undefined;
        next.vdc_rated = 1200; next.ic_rated = 50; next.t_j_max = 175;
      } else if (type === 'ipm_module') {
        next.igbt = {
          vce_sat_25: 1.5, vce_sat_125: 1.8, ic_nom: 50, vce_rated: 600,
          eon_curve: { vcc: 300, rg: 10, tj: 125, points: [{ current: 50, energy: 3.5 }] },
          eoff_curve: { vcc: 300, rg: 10, tj: 125, points: [{ current: 50, energy: 2.5 }] },
          thermal: { rth_jc: 1.2 },
        };
        next.diode = {
          vf_25: 1.5, vf_125: 1.3, if_nom: 50,
          err_curve: { vcc: 300, rg: 10, tj: 125, points: [{ current: 50, energy: 1.5 }] },
          qrr: 3, thermal: { rth_jc: 1.8 },
        };
        next.sic_mos = undefined; next.sic_diode = undefined;
        next.vdc_rated = 600; next.ic_rated = 50; next.t_j_max = 150;
      } else if (type === 'igbt_discrete') {
        next.igbt = {
          vce_sat_25: 1.45, vce_sat_125: 1.8, ic_nom: 40, vce_rated: 600,
          eon_curve: { vcc: 300, rg: 10, tj: 125, points: [{ current: 40, energy: 0.5 }] },
          eoff_curve: { vcc: 300, rg: 10, tj: 125, points: [{ current: 40, energy: 0.3 }] },
          thermal: { rth_jc: 1.5 },
        };
        next.diode = {
          vf_25: 1.4, vf_125: 1.2, if_nom: 40,
          err_curve: { vcc: 300, rg: 10, tj: 125, points: [{ current: 40, energy: 0.2 }] },
          qrr: 2, thermal: { rth_jc: 2.5 },
        };
        next.sic_mos = undefined; next.sic_diode = undefined;
        next.vdc_rated = 600; next.ic_rated = 40; next.t_j_max = 175;
      } else {
        // igbt_module default
        next.sic_mos = undefined; next.sic_diode = undefined;
        next.vdc_rated = 1200; next.ic_rated = 100; next.t_j_max = 150;
      }
      return next;
    });
  }, []);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await calculateLossesCombined(config, conditions);
      setResult(res);
      setCurrentStep(3);
      saveHistory({ config, conditions, result: res }).catch(() => {});
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || '未知错误';
      message.error(`计算失败: ${detail}`);
      console.error('Calculation failed:', err);
    }
    finally { setLoading(false); }
  }, [config, conditions]);

  const handleSelectDevice = useCallback((devConfig: ModuleConfig) => {
    // Ensure all required fields have defaults
    const filled: ModuleConfig = {
      ...devConfig,
      device_type: devConfig.device_type || 'igbt_module',
      module_name: devConfig.module_name || '',
      manufacturer: devConfig.manufacturer || '',
      vdc_rated: devConfig.vdc_rated || 1200,
      ic_rated: devConfig.ic_rated || 100,
      num_parallel_chips: devConfig.num_parallel_chips || 1,
      t_j_max: devConfig.t_j_max || 150,
      rth_ch_module: devConfig.rth_ch_module ?? 0.02,
      rth_ha: devConfig.rth_ha ?? 0.08,
    };
    // Normalize switching points — accepts [{current, energy}, ...] or [[x,y], ...]
    const normPts = (pts: any[]) => pts?.map((p: any) =>
      typeof p.current === 'number' ? p : { current: Number(p[0]) || 0, energy: Number(p[1]) || 0 }
    ) || [];

    // Ensure sub-objects have required nested fields
    if (filled.igbt) {
      filled.igbt = {
        vce_sat_25: filled.igbt.vce_sat_25 ?? 1.7,
        vce_sat_125: filled.igbt.vce_sat_125 ?? 2.0,
        ic_nom: filled.igbt.ic_nom ?? 100,
        vce_rated: filled.igbt.vce_rated ?? 1200,
        eon_curve: { vcc: filled.igbt.eon_curve?.vcc ?? 600, rg: filled.igbt.eon_curve?.rg ?? 10, tj: filled.igbt.eon_curve?.tj ?? 125, points: normPts(filled.igbt.eon_curve?.points) },
        eoff_curve: { vcc: filled.igbt.eoff_curve?.vcc ?? 600, rg: filled.igbt.eoff_curve?.rg ?? 10, tj: filled.igbt.eoff_curve?.tj ?? 125, points: normPts(filled.igbt.eoff_curve?.points) },
        thermal: { rth_jc: filled.igbt.thermal?.rth_jc ?? 0.24 },
        rg_int: filled.igbt.rg_int,
      };
      if (!filled.igbt.eon_curve.points.length) filled.igbt.eon_curve.points = [{ current: 100, energy: 15 }];
      if (!filled.igbt.eoff_curve.points.length) filled.igbt.eoff_curve.points = [{ current: 100, energy: 10 }];
    }
    if (filled.diode) {
      filled.diode = {
        vf_25: filled.diode.vf_25 ?? 1.8,
        vf_125: filled.diode.vf_125 ?? 1.6,
        if_nom: filled.diode.if_nom ?? 100,
        err_curve: { vcc: filled.diode.err_curve?.vcc ?? 600, rg: filled.diode.err_curve?.rg ?? 10, tj: filled.diode.err_curve?.tj ?? 125, points: normPts(filled.diode.err_curve?.points) },
        qrr: filled.diode.qrr ?? 5,
        thermal: { rth_jc: filled.diode.thermal?.rth_jc ?? 0.42 },
      };
      if (!filled.diode.err_curve.points.length) filled.diode.err_curve.points = [{ current: 100, energy: 8 }];
    }
    if (filled.sic_mos) {
      filled.sic_mos = {
        rds_on_25: filled.sic_mos.rds_on_25 ?? 20,
        rds_on_125: filled.sic_mos.rds_on_125 ?? 35,
        id_nom: filled.sic_mos.id_nom ?? 100,
        vds_rated: filled.sic_mos.vds_rated ?? 1200,
        eon_curve: { vcc: filled.sic_mos.eon_curve?.vcc ?? 800, rg: filled.sic_mos.eon_curve?.rg ?? 5, tj: filled.sic_mos.eon_curve?.tj ?? 150, points: normPts(filled.sic_mos.eon_curve?.points) },
        eoff_curve: { vcc: filled.sic_mos.eoff_curve?.vcc ?? 800, rg: filled.sic_mos.eoff_curve?.rg ?? 5, tj: filled.sic_mos.eoff_curve?.tj ?? 150, points: normPts(filled.sic_mos.eoff_curve?.points) },
        thermal: { rth_jc: filled.sic_mos.thermal?.rth_jc ?? 0.2 },
        rg_int: filled.sic_mos.rg_int,
      };
      if (!filled.sic_mos.eon_curve.points.length) filled.sic_mos.eon_curve.points = [{ current: 100, energy: 2 }];
      if (!filled.sic_mos.eoff_curve.points.length) filled.sic_mos.eoff_curve.points = [{ current: 100, energy: 1.5 }];
    }
    if (filled.sic_diode) {
      filled.sic_diode = {
        vsd_25: filled.sic_diode.vsd_25 ?? 1.5,
        vsd_125: filled.sic_diode.vsd_125 ?? 1.3,
        if_nom: filled.sic_diode.if_nom ?? 100,
        qrr: filled.sic_diode.qrr ?? 0,
        thermal: { rth_jc: filled.sic_diode.thermal?.rth_jc ?? 0.3 },
      };
    }
    setConfig(filled);
    setResult(null);
    // Auto-set conditions based on device ratings (#5)
    const ratedVdc = filled.vdc_rated || 1200;
    const ratedIc = filled.ic_rated || 100;
    setConditions(prev => ({
      ...prev,
      vdc: Math.round(ratedVdc * 0.5),
      i_out_rms: Math.round(ratedIc * 0.5),
    }));
    setCurrentPage('calculate');
    setCurrentStep(2);
    message.success(`已加载器件: ${filled.module_name || filled.manufacturer || '未知器件'}`);
  }, []);

  const menuItems = [
    { key: 'calculate' as PageKey, icon: <ThunderboltOutlined />, label: '损耗计算' },
    { key: 'devices' as PageKey, icon: <BookOutlined />, label: '器件库' },
    { key: 'concepts' as PageKey, icon: <ExperimentOutlined />, label: '概念图解' },
    { key: 'history' as PageKey, icon: <HistoryOutlined />, label: '计算历史' },
    { key: 'compare' as PageKey, icon: <BarChartOutlined />, label: '对比分析' },
    { key: 'demo' as PageKey, icon: <ExperimentOutlined />, label: '方案对比-PF' },
    { key: 'cond_demo' as PageKey, icon: <ExperimentOutlined />, label: '方案对比-导通' },
    { key: 'therm_demo' as PageKey, icon: <ExperimentOutlined />, label: '方案对比-热阻' },
  ];

  const renderCalculator = () => (
    <>
      {currentStep === 0 && (
        <DeviceSelector config={config} onChange={handleDeviceTypeChange}
          onNext={() => setCurrentStep(1)} />
      )}
      {currentStep === 1 && (
        <ParameterPanel config={config} onChange={setConfig}
          onNext={() => setCurrentStep(2)} onBack={() => setCurrentStep(0)} />
      )}
      {currentStep === 2 && (
        <ConditionInput conditions={conditions} onChange={setConditions}
          onCalculate={handleCalculate} loading={loading} onBack={() => setCurrentStep(1)} />
      )}
      {currentStep === 3 && result && (
        <ResultDashboard result={result} config={config} conditions={conditions}
          onRecalculate={() => setCurrentStep(2)}
          onNew={() => { setResult(null); setCurrentStep(0); }} />
      )}
    </>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'calculate': return renderCalculator();
      case 'devices': return <DeviceLibrary onSelect={handleSelectDevice} conditions={conditions} />;
      case 'concepts': return <ConceptExplorer config={config} conditions={conditions} />;
      case 'history': return <CalculationHistory onSelect={handleSelectDevice} conditions={conditions} />;
      case 'compare': return <ComparisonView result={result} config={config} conditions={conditions} />;
      case 'demo': return <ConceptDemoCompare />;
      case 'cond_demo': return <ConductionLossCompare />;
      case 'therm_demo': return <ThermalNetworkCompare />;
      default: return renderCalculator();
    }
  };

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <AntApp>
        <Layout style={{ minHeight: '100vh' }}>
          <Header style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: '0 24px', display: 'flex', alignItems: 'center', height: 56,
          }}>
            <Title level={4} style={{ margin: 0, color: token.colorPrimary }}>
              ⚡ Power Loss Calculator 功率器件损耗计算工具
            </Title>
          </Header>
          <Layout>
            <Sider width={200} style={{
              background: token.colorBgContainer,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              padding: '12px 0',
            }}>
              <Menu mode="inline" selectedKeys={[currentPage]}
                items={menuItems.map(m => ({ key: m.key, icon: m.icon, label: m.label }))}
                onClick={({ key }) => setCurrentPage(key as PageKey)}
                style={{ border: 'none' }} />
              {currentPage === 'calculate' && (
                <div style={{ padding: '8px 16px', marginTop: 16 }}>
                  <Steps current={currentStep} direction="vertical" size="small"
                    onChange={(s) => { if (s < currentStep || result) setCurrentStep(s); }}
                    items={[
                      { title: '器件选择' }, { title: '参数设置' },
                      { title: '工况设置' }, { title: '计算结果' },
                    ]} />
                </div>
              )}
            </Sider>
            <Content style={{ padding: 24, background: token.colorBgLayout, minHeight: 'calc(100vh - 56px)' }}>
              {renderPage()}
            </Content>
          </Layout>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}

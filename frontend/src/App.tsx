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
import type { ModuleConfig, OperatingConditions, CalculationResult, DeviceType } from './types';
import { calculateLossesCombined } from './api/client';

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

type PageKey = 'calculate' | 'devices' | 'concepts' | 'history' | 'compare';

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
      if (type === 'sic_module' || type === 'sic_discrete') {
        next.sic_mos = {
          rds_on_25: 20, rds_on_125: 35, id_nom: 100, vds_rated: 1200,
          eon_curve: { vcc: 800, rg: 5, tj: 150, points: [{ current: 100, energy: 2 }] },
          eoff_curve: { vcc: 800, rg: 5, tj: 150, points: [{ current: 100, energy: 1.5 }] },
          thermal: { rth_jc: 0.2 },
        };
        next.sic_diode = {
          vsd_25: 1.5, vsd_125: 1.3, if_nom: 100, qrr: 0, thermal: { rth_jc: 0.3 },
        };
        next.igbt = undefined; next.diode = undefined;
      } else {
        next.sic_mos = undefined; next.sic_diode = undefined;
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
    } catch (err) { console.error('Calculation failed:', err); }
    finally { setLoading(false); }
  }, [config, conditions]);

  const handleSelectDevice = useCallback((devConfig: ModuleConfig) => {
    setConfig(devConfig);
    setCurrentPage('calculate');
    setCurrentStep(2);
  }, []);

  const menuItems = [
    { key: 'calculate' as PageKey, icon: <ThunderboltOutlined />, label: '损耗计算' },
    { key: 'devices' as PageKey, icon: <BookOutlined />, label: '器件库' },
    { key: 'concepts' as PageKey, icon: <ExperimentOutlined />, label: '概念图解' },
    { key: 'history' as PageKey, icon: <HistoryOutlined />, label: '计算历史' },
    { key: 'compare' as PageKey, icon: <BarChartOutlined />, label: '对比分析' },
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
      case 'concepts': return <ConceptExplorer conditions={conditions} />;
      case 'history': return <CalculationHistory onSelect={handleSelectDevice} conditions={conditions} />;
      case 'compare': return <ComparisonView />;
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

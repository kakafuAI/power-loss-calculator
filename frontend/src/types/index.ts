// Device type enums
export type DeviceType = 'igbt_module' | 'ipm_module' | 'igbt_discrete' | 'sic_module' | 'sic_discrete';

export type Topology = 'three_phase_inverter';
export type Modulation = 'spwm' | 'svpwm';

// Switching energy data
export interface SwitchingPoint {
  current: number;
  energy: number;
}

export interface SwitchingCurve {
  vcc: number;
  rg: number;
  tj: number;
  points: SwitchingPoint[];
}

// Thermal parameters
export interface ThermalParams {
  rth_jc: number;
  rth_ch?: number;
  rth_ha?: number;
}

// IGBT parameters
export interface IGBTParams {
  vce_sat_25: number;
  vce_sat_125: number;
  ic_nom: number;
  vce_rated: number;
  eon_curve: SwitchingCurve;
  eoff_curve: SwitchingCurve;
  thermal: ThermalParams;
  rg_int?: number;
}

// Diode parameters
export interface DiodeParams {
  vf_25: number;
  vf_125: number;
  if_nom: number;
  err_curve: SwitchingCurve;
  qrr: number;
  thermal: ThermalParams;
}

// SiC MOSFET parameters
export interface SiCMOSParams {
  rds_on_25: number;
  rds_on_125: number;
  id_nom: number;
  vds_rated: number;
  eon_curve: SwitchingCurve;
  eoff_curve: SwitchingCurve;
  thermal: ThermalParams;
  rg_int?: number;
}

// SiC diode parameters
export interface SiCDiodeParams {
  vsd_25: number;
  vsd_125: number;
  if_nom: number;
  err_curve?: SwitchingCurve;
  qrr: number;
  thermal: ThermalParams;
}

// Module configuration
export interface ModuleConfig {
  device_type: DeviceType;
  module_name: string;
  manufacturer: string;
  vdc_rated: number;
  ic_rated: number;
  num_parallel_chips: number;

  igbt?: IGBTParams;
  sic_mos?: SiCMOSParams;
  diode?: DiodeParams;
  sic_diode?: SiCDiodeParams;

  brake_igbt?: IGBTParams;
  brake_diode?: DiodeParams;

  rth_ch_module?: number;
  rth_ha?: number;
  t_j_max: number;
}

// Operating conditions
export interface OperatingConditions {
  vdc: number;
  i_out_rms: number;
  i_out_peak?: number;
  f_out: number;
  f_sw: number;
  modulation_index: number;
  power_factor: number;
  modulation: Modulation;
  t_ambient: number;
  t_case?: number;
  rth_ha?: number;
}

// Device loss breakdown
export interface DeviceLoss {
  name: string;
  p_cond: number;
  p_sw: number;
  p_total: number;
  t_j: number;
  type: string;
}

// Calculation step
export interface CalcStep {
  title: string;
  type: 'input' | 'calculation' | 'thermal' | 'summary';
  formula?: string;
  data: Record<string, unknown>;
}

// Full calculation result
export interface CalculationResult {
  p_total_loss: number;
  p_igbt_cond: number;
  p_igbt_sw: number;
  p_diode_cond: number;
  p_diode_sw: number;
  p_brake_loss: number;
  efficiency: number;
  p_out: number;
  t_j_max: number;
  t_j_max_device: string;
  t_case_est: number;
  t_heatsink_est?: number;
  devices: DeviceLoss[];
  iteration_count: number;
  converged: boolean;
  calculation_steps: CalcStep[];
  per_leg?: Record<string, number>;
}

// Curve data
export interface CurvePoint {
  x: number;
  y: number;
}

export interface CurveData {
  name: string;
  x_label: string;
  y_label: string;
  points: CurvePoint[];
}

export interface CurveSweepResult {
  curves: CurveData[];
}

// PDF parse result
export interface PDFParseResult {
  file_name: string;
  page_count: number;
  metadata: {
    part_number?: string;
    manufacturer?: string;
    confidence: Record<string, number>;
  };
  parameters: Record<string, unknown>;
  raw_text_sample: string;
}

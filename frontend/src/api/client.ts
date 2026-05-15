import axios from 'axios';
import type {
  ModuleConfig,
  OperatingConditions,
  CalculationResult,
  CurveSweepResult,
  PDFParseResult,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export async function calculateLossesCombined(
  config: ModuleConfig,
  conditions: OperatingConditions,
): Promise<CalculationResult> {
  const { data } = await api.post('/calculate', {
    config,
    conditions,
  });
  return data;
}

export async function sweepCurve(
  config: ModuleConfig,
  conditions: OperatingConditions,
  sweepParam: string,
  sweepStart: number,
  sweepEnd: number,
  sweepPoints: number = 50,
): Promise<CurveSweepResult> {
  const { data } = await api.post('/calculate/curve', {
    config,
    conditions,
    sweep_param: sweepParam,
    sweep_start: sweepStart,
    sweep_end: sweepEnd,
    sweep_points: sweepPoints,
  });
  return data;
}

export async function parseDatasheet(
  file: File,
  deviceType: string,
): Promise<PDFParseResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('device_type', deviceType);
  const { data } = await api.post('/datasheet/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function exportExcel(resultData: Record<string, unknown>): Promise<Blob> {
  const { data } = await api.post('/export/excel', resultData, {
    responseType: 'blob',
  });
  return data;
}

export async function exportCSV(resultData: Record<string, unknown>): Promise<Blob> {
  const { data } = await api.post('/export/csv', resultData, {
    responseType: 'blob',
  });
  return data;
}

export async function saveHistory(params: {
  config: ModuleConfig;
  conditions: OperatingConditions;
  result: CalculationResult;
  rating?: number;
}): Promise<{ id: number }> {
  const { data } = await api.post('/history', {
    device_name: params.config.module_name || params.config.manufacturer || '',
    device_type: params.config.device_type,
    config: params.config,
    conditions: params.conditions,
    result: params.result,
    t_j_max: params.result.t_j_max ?? 0,
    p_total_loss: params.result.p_total_loss ?? 0,
    efficiency: params.result.efficiency ?? 0,
    converged: params.result.converged ?? true,
    trust_score: params.rating,
  });
  return data;
}

export async function fetchHistory(params?: {
  limit?: number;
  device_type?: string;
}): Promise<any[]> {
  const { data } = await api.get('/history', { params });
  return data;
}

export async function createComparison(calcIds: number[]): Promise<any> {
  const { data } = await api.post('/compare', { calc_ids: calcIds });
  return data;
}

export async function fetchComparisons(limit: number = 20): Promise<any[]> {
  const { data } = await api.get('/compare', { params: { limit } });
  return data;
}

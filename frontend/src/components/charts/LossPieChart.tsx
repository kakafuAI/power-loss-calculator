import ReactECharts from 'echarts-for-react';
import type { CalculationResult } from '../../types';

interface Props {
  result: CalculationResult;
  isSiC?: boolean;
}

export default function LossPieChart({ result, isSiC }: Props) {
  const swLabel = isSiC ? 'SiC MOSFET' : 'IGBT';
  const diodeLabel = isSiC ? '体二极管' : '二极管';

  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} W ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [{
      name: '损耗分布',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%' },
      data: [
        { value: result.p_igbt_cond, name: `${swLabel} 导通损耗`, itemStyle: { color: '#5470c6' } },
        { value: result.p_igbt_sw, name: `${swLabel} 开关损耗`, itemStyle: { color: '#91cc75' } },
        { value: result.p_diode_cond, name: `${diodeLabel} 导通损耗`, itemStyle: { color: '#fac858' } },
        { value: result.p_diode_sw, name: `${diodeLabel} 开关损耗`, itemStyle: { color: '#ee6666' } },
      ].filter(d => d.value > 0),
    }],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}

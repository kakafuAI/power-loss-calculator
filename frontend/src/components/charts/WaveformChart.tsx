import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { OperatingConditions } from '../../types';

interface Props {
  conditions: OperatingConditions;
}

export default function WaveformChart({ conditions }: Props) {
  const { data } = useMemo(() => {
    const n = 200;
    const theta = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n);
    const m = conditions.modulation_index;
    const phi = Math.acos(conditions.power_factor);
    const iPeak = conditions.i_out_rms * Math.sqrt(2);

    const va = theta.map(t => Math.sin(t));
    const ia = theta.map(t => Math.sin(t - phi));
    const iaAbs = ia.map(v => v * iPeak);
    const dutyH = theta.map(t => 0.5 * (1 + m * Math.sin(t)));

    return {
      data: theta.map((t, i) => ({
        angle: (t * 180) / Math.PI,
        va: va[i],
        ia: ia[i],
        iaAbs: iaAbs[i],
        dutyH: dutyH[i],
      })),
    };
  }, [conditions]);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['调制信号', '输出电流', '上管占空比'], bottom: 0 },
    grid: { left: 60, right: 30, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.angle.toFixed(0) + '°'),
      name: '电角度',
      axisLabel: { interval: 40, rotate: 0 },
    },
    yAxis: [
      { type: 'value', name: '归一化值', min: -1.2, max: 1.2 },
      { type: 'value', name: '占空比', min: 0, max: 1.1 },
    ],
    series: [
      {
        name: '调制信号', type: 'line', data: data.map(d => +d.va.toFixed(3)),
        smooth: true, lineStyle: { width: 2 },
      },
      {
        name: '输出电流', type: 'line', data: data.map(d => +d.ia.toFixed(3)),
        smooth: true, lineStyle: { width: 2, type: 'dashed' },
      },
      {
        name: '上管占空比', type: 'line', yAxisIndex: 1,
        data: data.map(d => +d.dutyH.toFixed(3)),
        smooth: true, areaStyle: { opacity: 0.15 },
        lineStyle: { width: 1.5 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}

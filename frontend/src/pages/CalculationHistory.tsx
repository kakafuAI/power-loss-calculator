import { useState, useEffect } from 'react';
import { Table, Typography, Tag, Rate, Button, Space, message, Popconfirm } from 'antd';
import { EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ModuleConfig, OperatingConditions } from '../types';
import axios from 'axios';

const { Title, Text } = Typography;

interface Props {
  onSelect: (config: ModuleConfig) => void;
  conditions?: OperatingConditions;
}

export default function CalculationHistory({ onSelect }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data: h } = await axios.get('/api/history?limit=50');
      setRecords(h.history || []);
      const { data: a } = await axios.get('/api/anomalies?limit=10');
      setAnomalies(a.anomalies || []);
    } catch { message.error('加载历史失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleTrustChange = async (id: number, score: number) => {
    try {
      await axios.put(`/api/history/${id}/trust`, { trust_score: score });
      message.success('评分已更新');
      fetchHistory();
    } catch { message.error('评分更新失败'); }
  };

  const handleReuse = (record: any) => {
    try {
      const conditions = JSON.parse(record.conditions_json);
      const result = JSON.parse(record.result_json);
      // Navigate to calculate and pre-fill — simplified for now
      message.info(`已加载历史记录: ${record.device_name}`);
    } catch { message.error('记录解析失败'); }
  };

  const columns = [
    { title: '日期', dataIndex: 'created_at', width: 150,
      render: (v: string) => v?.split('.')[0]?.replace('T', ' ') || '' },
    { title: '器件', dataIndex: 'device_name', width: 180 },
    {
      title: '总损耗', dataIndex: 'p_total_loss', width: 100,
      render: (v: number) => <Text strong>{v?.toFixed(1)} W</Text>,
    },
    {
      title: '效率', dataIndex: 'efficiency', width: 80,
      render: (v: number) => <Tag color={v > 95 ? 'green' : v > 85 ? 'orange' : 'red'}>{v?.toFixed(1)}%</Tag>,
    },
    {
      title: 'Tj_max', dataIndex: 't_j_max', width: 80,
      render: (v: number) => <Tag color={v > 150 ? 'red' : v > 120 ? 'orange' : 'green'}>{v?.toFixed(0)}°C</Tag>,
    },
    {
      title: '收敛', dataIndex: 'converged', width: 70,
      render: (v: number) => v ? <Tag color="green">✓</Tag> : <Tag color="red">✗</Tag>,
    },
    {
      title: '可信度', dataIndex: 'trust_score', width: 160,
      render: (v: number, record: any) => (
        <Rate count={5} value={v || 0} style={{ fontSize: 14 }}
          onChange={(s) => handleTrustChange(record.id, s)} />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={3}>📋 计算历史</Title>

      {anomalies.length > 0 && (
        <div style={{
          background: '#fff2e8', border: '1px solid #ffbb96',
          borderRadius: 8, padding: 12, marginBottom: 16,
        }}>
          <Text strong style={{ color: '#d4380d' }}>⚠ 检测到 {anomalies.length} 个异常:</Text>
          {anomalies.map((a: any, i: number) => (
            <div key={i} style={{ marginTop: 4, fontSize: 13 }}>
              <Tag color="error">{a.name}</Tag>
              {a.anomalies?.map((an: any, j: number) => (
                <div key={j} style={{ marginLeft: 16, color: '#666' }}>
                  • {an.message}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Table dataSource={records.map((r: any) => ({ ...r, key: r.id }))}
        columns={columns} loading={loading} size="small"
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender: (record: any) => {
            let conditions: any = {};
            try { conditions = JSON.parse(record.conditions_json); } catch {}
            return (
              <div style={{ padding: 8 }}>
                <Text type="secondary">
                  Vdc={conditions.vdc}V, Iout={conditions.i_out_rms}A,
                  fsw={conditions.f_sw}Hz, cosφ={conditions.power_factor},
                  Tamb={conditions.t_ambient}°C
                </Text>
              </div>
            );
          },
        }} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Typography, Table, Tag, Button, Space, message, Card, Row, Col, Statistic } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

export default function ComparisonView() {
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComparisons = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/compare?limit=20');
      setComparisons(data.comparisons || []);
    } catch { message.error('加载对比数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchComparisons(); }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>📈 对比分析</Title>

      {comparisons.length === 0 ? (
        <Card>
          <Text type="secondary">
            暂无对比数据。完成多次计算后，可在计算历史中选择记录进行对比分析。
          </Text>
        </Card>
      ) : (
        comparisons.map((cmp: any) => {
          let analysis: any = {};
          let anomalies: any[] = [];
          try { analysis = JSON.parse(cmp.analysis_json); } catch {}
          try { anomalies = JSON.parse(cmp.anomalies_json); } catch {}

          return (
            <Card key={cmp.id} style={{ marginBottom: 16 }} title={cmp.name || '对比分析'}>
              {anomalies.length > 0 && (
                <div style={{
                  background: '#fff2e8', borderRadius: 6, padding: '8px 12px', marginBottom: 12,
                  border: '1px solid #ffbb96',
                }}>
                  <Text type="danger" strong>⚠ 检测到 {anomalies.length} 个显著差异</Text>
                </div>
              )}

              <Row gutter={16}>
                {analysis.comparisons?.map((c: any, i: number) => (
                  <Col span={8} key={i}>
                    <Card size="small" style={{ background: c.significant ? '#fff7e6' : '#f6ffed' }}>
                      <Statistic title={c.label}
                        value={c.spread_pct}
                        suffix="% 差异"
                        valueStyle={{
                          color: c.significant ? '#cf1322' : '#3f8600',
                          fontSize: 20,
                        }} />
                    </Card>
                  </Col>
                ))}
              </Row>

              <div style={{ marginTop: 12 }}>
                <Text type="secondary">
                  对比器件: {analysis.devices?.join(', ')} | 创建时间: {cmp.created_at}
                </Text>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

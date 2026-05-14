import { useState, useEffect } from 'react';
import { Table, Typography, Tag, Input, Select, Space, Button, message } from 'antd';
import { SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ModuleConfig, OperatingConditions } from '../types';
import axios from 'axios';

const { Title } = Typography;

interface Props {
  onSelect: (config: ModuleConfig) => void;
  conditions?: OperatingConditions;
}

export default function DeviceLibrary({ onSelect, conditions }: Props) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('device_type', typeFilter);
      const { data } = await axios.get(`/api/devices?${params}`);
      setDevices(data.devices || []);
    } catch { message.error('加载器件库失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDevices(); }, [search, typeFilter]);

  const handleUse = (device: any) => {
    try {
      const config = JSON.parse(device.config_json);
      onSelect(config);
      message.success(`已加载器件: ${device.name}`);
    } catch { message.error('器件配置解析失败'); }
  };

  const columns = [
    { title: '型号', dataIndex: 'name', sorter: true, width: 200,
      render: (v: string, r: any) => (
        <Space>
          {v}
          {r.is_builtin ? <Tag color="blue" style={{ fontSize: 10 }}>内置</Tag> : null}
        </Space>
      ),
    },
    { title: '厂商', dataIndex: 'manufacturer', width: 120 },
    {
      title: '类型', dataIndex: 'device_type', width: 120,
      render: (v: string) => {
        const labels: Record<string, string> = {
          igbt_module: 'IGBT模块', ipm_module: 'IPM模块',
          igbt_discrete: 'IGBT单管', sic_module: 'SiC模块', sic_discrete: 'SiC单管',
        };
        return <Tag>{labels[v] || v}</Tag>;
      },
    },
    { title: '额定电压 (V)', dataIndex: 'vdc_rated', width: 100 },
    { title: '额定电流 (A)', dataIndex: 'ic_rated', width: 100 },
    {
      title: '来源', dataIndex: 'source', width: 80,
      render: (v: string) => <Tag color={v === 'builtin' ? 'green' : 'default'}>{v === 'builtin' ? '内置' : v}</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_: any, record: any) => (
        <Button type="primary" size="small" icon={<ThunderboltOutlined />}
          onClick={() => handleUse(record)}>使用</Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3}>📚 器件库</Title>
      <Space style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="搜索型号或厂商"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 250 }} allowClear />
        <Select placeholder="筛选类型" allowClear style={{ width: 150 }}
          value={typeFilter} onChange={setTypeFilter}
          options={[
            { value: 'igbt_module', label: 'IGBT模块' },
            { value: 'sic_module', label: 'SiC模块' },
            { value: 'igbt_discrete', label: 'IGBT单管' },
            { value: 'sic_discrete', label: 'SiC单管' },
          ]} />
      </Space>
      <Table dataSource={devices.map((d: any) => ({ ...d, key: d.id }))}
        columns={columns} loading={loading} size="small" pagination={{ pageSize: 20 }} />
    </div>
  );
}

# 示例数据

## 示例输入

| 文件 | 器件类型 | 工况 | 说明 |
|------|---------|------|------|
| `example_igbt_module.json` | IGBT PIM 模块 | 600V/50A/4kHz | 典型 1200V/100A 变频器工况 |
| `example_sic_module.json` | SiC 模块 | 800V/40A/20kHz | 高频 OBC/DCDC 工况 |
| `example_igbt_discrete.json` | IGBT 单管 | 320V/15A/8kHz | 小功率逆变器工况 |

## 示例输出

对应的 `*_output.json` 文件包含完整的 API 响应，包括：

- 总损耗和分类损耗
- 12 个器件的详细数据
- 热迭代收敛日志
- 所有中间计算步骤
- 每相电流和损耗统计

## 使用方法

将输入文件中的 `config` 和 `conditions` 作为请求体发送至 API：

```bash
# 使用 curl
curl -X POST http://localhost:8000/api/calculate \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json; d=json.load(open('example_igbt_module.json')); print(json.dumps({'config':d['config'],'conditions':d['conditions']}))")"

# 使用 Python
import json, requests
with open('example_igbt_module.json') as f:
    data = json.load(f)
resp = requests.post('http://localhost:8000/api/calculate',
                     json={'config': data['config'], 'conditions': data['conditions']})
print(resp.json())
```

## 典型计算结果

### IGBT 模块 (4kHz)
- 总损耗: 897W
- 效率: 96.8%
- Tj_max: 159.7°C (IGBT_H_U)
- 开关损耗占比: 55.5%

### SiC 模块 (20kHz)
- 总损耗: 231W
- 效率: 99.2%
- Tj_max: 73.7°C
- 高频下 SiC 的开关损耗优势明显

### IGBT 单管 (8kHz)
- 总损耗: 120W
- 效率: 97.0%
- Tj_max: 250°C（钳位值 — 表示需要更好的散热设计）
- 单管热阻大，需注意散热设计

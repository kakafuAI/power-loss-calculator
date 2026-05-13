# Power Loss Calculator — 功率半导体器件损耗计算工具

Web 版功率器件损耗计算工具，支持 IGBT PIM/IPM 模块、IGBT 单管、SiC 模块、SiC 单管的导通损耗、开关损耗计算及热分析。

## 功能概览

| 功能 | 说明 |
|------|------|
| 器件类型 | IGBT PIM 模块、IPM 模块、IGBT 单管、SiC 模块、SiC 单管 |
| 拓扑结构 | 三相两电平逆变器（含整流 + 逆变 + 制动斩波） |
| 损耗类型 | IGBT/MOSFET 导通损耗、开关损耗、二极管导通损耗、反向恢复损耗 |
| 热模型 | Foster 热网络 + 散热器模型，结温迭代求解至收敛 |
| 计算展示 | 每步中间过程、热迭代收敛日志 |
| 可视化 | 损耗分布饼图、器件损耗柱状图、调制波形、特性曲线 |
| 参数获取 | 手动输入 / PDF 规格书自动提取 |
| 结果导出 | Excel (.xlsx) 和 CSV 格式 |

## 技术架构

```
hermes-agent/
├── frontend/                # React + TypeScript + Vite
│   └── src/
│       ├── components/      # UI 组件
│       │   ├── DeviceSelector/    # 器件类型选择
│       │   ├── ParameterPanel/    # 参数输入 + PDF 上传
│       │   ├── ConditionInput/    # 工况条件设置
│       │   ├── ResultDashboard/   # 结果展示面板
│       │   └── charts/            # ECharts 图表组件
│       ├── api/             # API 客户端
│       └── types/           # TypeScript 类型定义
├── backend/                 # Python FastAPI
│   └── app/
│       ├── engine/          # 损耗计算引擎
│       │   ├── conduction.py     # 导通损耗模型
│       │   ├── switching.py      # 开关损耗模型
│       │   ├── thermal.py        # 热网络 + 迭代
│       │   ├── topology.py       # 三相逆变器拓扑
│       │   └── curves.py         # 特性曲线生成
│       ├── parser/          # PDF 规格书解析
│       │   ├── patterns.py       # 正则模式库（多品牌）
│       │   ├── pdf_reader.py     # PDF 文本提取
│       │   ├── igbt_parser.py    # IGBT 参数提取
│       │   └── sic_parser.py     # SiC 参数提取
│       ├── models/          # Pydantic 数据模型
│       └── routers/         # FastAPI 路由
├── design/                  # 设计文档（需求、架构、计算模型、UI）
├── docs/                    # 用户文档（使用指南、API 参考）
├── examples/                # 示例输入/输出
├── tests/                   # 测试脚本
├── CHANGELOG.md             # 版本变更记录
└── start.sh                 # 一键启动脚本
```

## 快速开始

### 环境要求
- Python >= 3.11
- Node.js >= 18

### 安装依赖

```bash
# 后端
cd backend
pip install --break-system-packages -r requirements.txt

# 前端
cd frontend
npm install
```

### 启动

```bash
# 方式 1：一键启动
./start.sh

# 方式 2：分别启动
# 终端 1 - 后端
cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 终端 2 - 前端
cd frontend && npx vite --host 0.0.0.0
```

访问地址：
- 前端界面：http://localhost:5173
- API 文档 (Swagger)：http://localhost:8000/docs

## 计算模型

### 导通损耗

**IGBT**: P_cond = Vce(sat)(Tj) × Ic × D(θ)

Vce(sat) 随结温线性插值：
```
Vce(sat)(Tj) = Vce(sat)@25°C + [Vce(sat)@125°C - Vce(sat)@25°C] × (Tj - 25) / 100
```

**SiC MOSFET**: P_cond = Rds(on)(Tj) × Id² × D(θ)

**二极管**: P_cond = Vf(Tj) × If × [1 - D(θ)]

占空比 D(θ) 由 SPWM 调制决定：
```
D_high(θ) = 1/2 × (1 + m × sin(θ))
D_low(θ)  = 1/2 × (1 - m × sin(θ))
```

损耗通过对一个基波周期进行数值积分（1000 点梯形积分）计算。

### 开关损耗

```
P_sw = f_sw × [Eon(Ic) + Eoff(Ic)] / 1000

E(Ic)  = E_ref(Ic) × (Vdc/Vdc_ref)^Kv × [1 + α_T × (Tj - T_ref)]
```

开关能量 Eon、Eoff 由数据表曲线插值获得，再根据实际 Vdc 和 Tj 缩放。

二极管反向恢复损耗：
```
P_rr = f_sw × Err(If) / 1000
```

### 热模型

```
T_junction = T_ambient + P_total × (Rth_jc + Rth_ch + Rth_ha)
```

迭代求解流程：
1. 初始猜测 Tj = T_ambient + 40°C
2. 在猜测 Tj 下计算所有损耗
3. 由损耗计算新 Tj
4. 若 |ΔTj_max| < 0.1°C → 收敛
5. 否则更新 Tj，重复步骤 2-4

温度线性插值在 [25°C, 200°C] 范围内钳位，防止非物理外推。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/calculate` | 执行损耗计算 |
| POST | `/api/calculate/curve` | 参数扫描生成特性曲线 |
| POST | `/api/datasheet/parse` | 上传 PDF 规格书并提取参数 |
| POST | `/api/export/excel` | 导出 Excel 报告 |
| POST | `/api/export/csv` | 导出 CSV 数据 |

## 支持的规格书品牌

PDF 解析器的正则模式库覆盖以下厂商的数据表格式：
- Infineon（英飞凌）
- Mitsubishi（三菱）
- Fuji Electric（富士电机）
- Semikron（赛米控）
- ON Semiconductor / STMicroelectronics
- Rohm（罗姆）
- Wolfspeed / Cree（科锐）
- 其他符合标准格式的数据表

## 使用流程

1. **器件选择** → 选择器件类型（IGBT/SiC 模块或单管）
2. **参数设置** → 上传 PDF 规格书自动提取参数，或手动输入
3. **工况设置** → 配置直流母线电压、输出电流、开关频率等
4. **计算结果** → 查看损耗分布、器件详情、计算过程、波形和特性曲线
5. **导出** → 下载 Excel 或 CSV 格式的完整计算报告

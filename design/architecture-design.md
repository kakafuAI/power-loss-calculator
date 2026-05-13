# 系统架构设计

> 版本: v1.0.0 | 日期: 2026-05-14

## 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────────────────┐  │
│  │ Device    │ │ Parameter │ │ Results Dashboard     │  │
│  │ Selector  │ │ Panel     │ │ (Tabs: Charts/Tables) │  │
│  └───────────┘ └───────────┘ └───────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐   │
│  │         ECharts Visualization Layer               │   │
│  │  Pie charts / Bar charts / Waveforms / Curves     │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST (JSON)
                       │ Vite proxy: /api → localhost:8000
┌──────────────────────┴──────────────────────────────────┐
│                   FastAPI Backend                        │
│  ┌───────────┐ ┌──────────────┐ ┌───────────────────┐   │
│  │ Routers   │ │ Calculation  │ │ Parser Pipeline   │   │
│  │ - calc    │ │ Engine       │ │ - PDF → text      │   │
│  │ - datasht │ │ - conduction │ │ - regex extract   │   │
│  │ - export  │ │ - switching  │ │ - confidence score│   │
│  └───────────┘ │ - thermal    │ └───────────────────┘   │
│                │ - topology   │                         │
│                │ - curves     │                         │
│                └──────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## 数据流

### 计算请求流

```
User Input (Frontend)
  │
  ├─ ModuleConfig (器件参数)
  │   ├─ IGBTParams / SiCMOSParams
  │   ├─ DiodeParams / SiCDiodeParams
  │   └─ ThermalParams
  │
  ├─ OperatingConditions (工况)
  │   ├─ vdc, i_out_rms, f_sw, f_out
  │   ├─ modulation_index, power_factor
  │   └─ t_ambient, modulation
  │
  ▼
POST /api/calculate { config, conditions }
  │
  ▼
_build_config() → InverterConfig (内部计算配置)
  │
  ▼
calculate_inverter_losses(config, op)
  │
  ├─ 热迭代循环 (max 20 次, tol 0.1°C):
  │   ├─ vce_sat_at_temp(Tj) → Vce(sat)(Tj)
  │   ├─ igbt_conduction_loss() → 导通损耗/相
  │   ├─ diode_conduction_loss() → 二极管导通损耗/相
  │   ├─ compute_switching_loss() → 开关损耗/相
  │   ├─ 热网络计算 → T_case, T_heatsink, T_j_new
  │   └─ 收敛判断 → |ΔTj| < 0.1°C ?
  │
  ▼
CalculationResult
  ├─ 汇总: p_total_loss, efficiency, t_j_max
  ├─ 器件列表: DeviceLoss[] (12 个器件)
  ├─ 计算步骤: CalcStep[] (7 个步骤)
  └─ 每相明细: per_leg
```

### PDF 解析流

```
PDF Upload (Frontend)
  │
  ▼
POST /api/datasheet/parse { file, device_type }
  │
  ▼
extract_pdf() → PDFExtractResult
  ├─ pdfplumber.open()
  ├─ page.extract_text() → full_text
  └─ page.extract_tables() → tables[]
  │
  ▼
extract_datasheet_metadata() → { part_number, manufacturer }
  │
  ▼
extract_igbt_params() 或 extract_sic_params()
  ├─ 正则匹配 (patterns.py)
  ├─ 电气特性: Vce(sat), Vf, Rds(on)
  ├─ 开关特性: Eon, Eoff, Err + 参考条件
  ├─ 热特性: Rth(j-c), Rth(c-s)
  └─ 置信度评分 (0.0 - 1.0)
  │
  ▼
Response { metadata, parameters, confidence }
```

## 热迭代算法

```
Algorithm: Thermal Iteration
Input: InverterConfig, OperatingPoint
Output: Loss breakdown with converged Tj

t_j_igbt ← [Tamb+40] × 6    # 6 IGBT 初始猜测
t_j_diode ← [Tamb+40] × 6   # 6 二极管初始猜测

for iter ← 1 to 20:
    # Step 1: 在当前 Tj 下计算损耗
    vce_sat ← interpolate(vce_25, vce_125, mean(t_j_igbt))
    p_cond_igbt ← conduction_loss(i_peak, m, pf, vce_sat)
    p_sw_igbt   ← switching_loss(i_peak, f_sw, vdc, mean(t_j_igbt))
    p_cond_diode ← diode_conduction_loss(i_peak, m, pf, vf)
    p_sw_diode   ← diode_switching_loss(...)

    # Step 2: 热网络计算
    p_module ← 3 × (p_cond_igbt + p_sw_igbt + p_cond_diode + p_sw_diode)
    t_heatsink ← Tamb + p_module × Rth_ha
    t_case ← t_heatsink + p_module × Rth_ch

    # Step 3: 更新结温
    t_j_new ← t_case + p_device × Rth_jc
    t_j_new ← clamp(t_j_new, Tamb, 250°C)

    # Step 4: 收敛检查
    if max|t_j_new - t_j_prev| < 0.1:
        return converged

    t_j_prev ← t_j_new

return not_converged (after 20 iterations)
```

## 关键设计决策

### 1. 温度钳位
线性温度插值在 [25°C, 200°C] 范围内钳位。当初始损耗估计过高导致 Tj 热失控时，钳位防止 Vce(sat) 和 Vf 变成非物理负值。

### 2. 开关能量单位处理
数据表中的开关能量以 mJ 为单位。计算 P_sw = f_sw × E_avg 时需要除以 1000 转换为 W。

### 3. Rth_ch 为模块级参数
外壳到散热器的热阻 (Rth_ch) 应用于整个模块，而非单个器件。所有器件的壳温相同：T_case = T_heatsink + P_module_total × Rth_ch。

### 4. 开关能量查找表
Eon、Eoff 作为电流的函数通过分段线性插值（log-log 空间）获得，超出范围的电流使用幂律外推。

### 5. 数值积分
导通损耗通过 1000 点梯形积分计算一个完整基波周期。开关损耗通过 200 点采样开关时刻的瞬时电流计算。

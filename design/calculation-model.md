# 损耗计算模型设计

> 版本: v1.0.0 | 日期: 2026-05-14

## 1. 符号约定

| 符号 | 含义 | 单位 |
|------|------|------|
| Vdc | 直流母线电压 | V |
| I_peak | 输出相电流峰值 | A |
| I_rms | 输出相电流有效值 | A |
| f_out | 输出基波频率 | Hz |
| f_sw | 开关频率（载波频率） | Hz |
| m | 调制比 (0~1.15) | — |
| cos φ | 负载功率因数 | — |
| θ | 电角度 ωt | rad |
| T_j | 结温 | °C |
| T_amb | 环境温度 | °C |
| Rth_jc | 结到壳热阻 | K/W |
| Rth_ch | 壳到散热器热阻 | K/W |
| Rth_ha | 散热器到环境热阻 | K/W |

## 2. SPWM 调制模型

### 2.1 占空比

上管占空比：
```
D_high(θ) = 0.5 × (1 + m × sin(θ))
```

下管占空比：
```
D_low(θ) = 0.5 × (1 - m × sin(θ)) = 1 - D_high(θ)
```

### 2.2 输出电流

```
i(θ) = I_peak × sin(θ - φ)
```
其中 φ = arccos(功率因数)，感性负载 φ > 0。

### 2.3 导通器件判定

| 条件 | 导通器件 |
|------|---------|
| D_high=1, i>0 | 上管 IGBT |
| D_high=1, i<0 | 上管二极管 |
| D_low=1, i<0 | 下管 IGBT |
| D_low=1, i>0 | 下管二极管 |

## 3. 导通损耗

### 3.1 IGBT 导通损耗

单管平均导通损耗（数值积分）：
```
P_cond_IGBT = (1/2π) × ∫₀²ᵖ Vce(sat)(Tj) × i(θ) × D(θ) × s(i) dθ
```
其中 s(i) 为导通指示函数（IGBT 导通时=1，否则=0）。

### 3.2 Vce(sat) 温度模型

线性插值，钳位 [25°C, 200°C]：
```
Vce(sat)(Tj) = Vce(sat)@25°C + [Vce(sat)@125°C - Vce(sat)@25°C] × (T_clamped - 25) / 100
T_clamped = clamp(Tj, 25, 200)
```

### 3.3 SiC MOSFET 导通损耗

```
P_cond_SiC = (1/2π) × ∫₀²ᵖ Rds(on)(Tj) × i²(θ) × D(θ) × s(i) dθ
```
Rds(on) 温度线性插值同 Vce(sat)。

### 3.4 二极管导通损耗

```
P_cond_diode = (1/2π) × ∫₀²ᵖ Vf(Tj) × |i(θ)| × (1-D(θ)) × s_diode(i) dθ
```
Vf 温度线性插值同 Vce(sat)。

### 3.5 数值积分实现

使用梯形法则，n=1000 点采样一个基波周期：
```
∫ f(θ) dθ ≈ (2π/n) × Σ f(θ_k)
```
其中 θ_k = 2πk/n, k = 0, ..., n-1。

## 4. 开关损耗

### 4.1 开关能量模型

从数据表曲线查表获得 Eon(Ic)、Eoff(Ic)、Err(If)。

**单点数据**：强制过原点线性缩放
```
E(I) = E_ref × I / I_ref
```

**多点数据**：分段线性插值（np.interp），外推使用幂律
```
E(I) = E_ref × (I / I_ref)^k
k = ln(E₂/E₁) / ln(I₂/I₁)
```

### 4.2 能量缩放

查表得到的是参考条件下的能量，需缩放到实际工况：
```
E = E_lookup(I) × (Vdc / Vdc_ref)^Kv × [1 + α_T × (Tj - T_ref)]
```
其中 Kv=1.0, α_T=0.003 K⁻¹, T_ref=125°C。

电流缩放因子 Ki=0（因为查表已包含电流依赖）。

### 4.3 开关损耗公式

每一相（上下管 2 个 IGBT + 2 个二极管）：

```
P_sw_IGBT_per_leg = 2 × f_sw × (Eon_avg + Eoff_avg) / 1000   [W]
P_sw_diode_per_leg = 2 × f_sw × Err_avg / 1000                [W]
```

除以 1000 是因为能量单位为 mJ。

Eon_avg 为所有开关时刻 Eon 的平均值（200 点采样基波周期）：
```
Eon_avg = (1/n) × Σ Eon(|i(θ_k)|)
```

### 4.4 三相总开关损耗

```
P_sw_IGBT_total = 3 × P_sw_IGBT_per_leg
P_sw_diode_total = 3 × P_sw_diode_per_leg
```

## 5. 热模型

### 5.1 热网络

```
T_heatsink = T_amb + P_total_module × Rth_ha
T_case     = T_heatsink + P_total_module × Rth_ch    ← 模块级，所有器件共享
T_j_IGBT   = T_case + P_IGBT × Rth_jc_IGBT
T_j_diode  = T_case + P_diode × Rth_jc_diode
```

### 5.2 热迭代算法

```
初始化: Tj_guess = T_amb + 40°C

循环 iter = 1..20:
    1. 以当前 Tj 计算 Vce(sat), Vf, Rds(on)
    2. 计算导通损耗和开关损耗
    3. 由损耗计算新 Tj
    4. 钳位 Tj ∈ [T_amb, 250°C]
    5. 若 max|ΔTj| < 0.1°C → 收敛退出
```

### 5.3 收敛性

- 温度正反馈：Tj↑ → Vce(sat)↑ → 损耗↑ → Tj↑（正反馈）
- 温度负反馈：Tj↑ → Eon/Eoff↓（对 IGBT，α_T 可正可负）
- 钳位保证不会热失控发散
- 典型收敛：3-6 次迭代

## 6. 参数扫描（特性曲线）

### 6.1 损耗 vs 输出电流

固定 Vdc, f_sw, cosφ，I_rms 从 i_min 扫到 i_max（50 点）。每个点进行一次完整的损耗+热迭代计算。

### 6.2 损耗 vs 开关频率

固定 Vdc, I_rms, cosφ，f_sw 从 f_min 扫到 f_max。

### 6.3 损耗 vs 功率因数

固定 Vdc, I_rms, f_sw，cosφ 从 0.1 扫到 1.0。

## 7. 已知局限

| 局限 | 影响 | 计划修复版本 |
|------|------|-------------|
| 仅支持 SPWM | SVPWM 损耗分布略有不同 | v1.1.0 |
| 热模型为稳态 | 未考虑瞬态热阻抗 | v1.2.0 |
| Vce(sat) 线性温度插值 | 实际可能是二次曲线 | v1.1.0 |
| 无多模块并联 | 大功率需手动换算 | v2.0.0 |
| 无死区时间效应 | 对损耗影响通常 <1% | 延后 |

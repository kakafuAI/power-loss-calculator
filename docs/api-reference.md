# API 接口文档

## 基础信息

- 基础 URL：`http://localhost:8000/api`
- 内容类型：`application/json`
- 字符编码：UTF-8

## 端点列表

### GET /api/health

健康检查。

**响应 200**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

### POST /api/calculate

执行三相两电平逆变器损耗计算。返回完整损耗分解、热迭代结果和计算步骤。

**请求体**
```json
{
  "config": {
    "device_type": "igbt_module",
    "module_name": "FS100R12KT4",
    "manufacturer": "Infineon",
    "vdc_rated": 1200,
    "ic_rated": 100,
    "num_parallel_chips": 1,
    "t_j_max": 150,
    "rth_ch_module": 0.02,
    "rth_ha": 0.08,
    "igbt": {
      "vce_sat_25": 1.7,
      "vce_sat_125": 2.0,
      "ic_nom": 100,
      "vce_rated": 1200,
      "eon_curve": {
        "vcc": 600, "rg": 10, "tj": 125,
        "points": [
          {"current": 10, "energy": 5.0},
          {"current": 50, "energy": 25.0},
          {"current": 100, "energy": 55.0}
        ]
      },
      "eoff_curve": {
        "vcc": 600, "rg": 10, "tj": 125,
        "points": [
          {"current": 10, "energy": 3.0},
          {"current": 50, "energy": 15.0},
          {"current": 100, "energy": 35.0}
        ]
      },
      "thermal": {"rth_jc": 0.24}
    },
    "diode": {
      "vf_25": 1.8,
      "vf_125": 1.6,
      "if_nom": 100,
      "err_curve": {
        "vcc": 600, "rg": 10, "tj": 125,
        "points": [
          {"current": 10, "energy": 2.0},
          {"current": 50, "energy": 10.0},
          {"current": 100, "energy": 22.0}
        ]
      },
      "qrr": 5.0,
      "thermal": {"rth_jc": 0.42}
    }
  },
  "conditions": {
    "vdc": 600,
    "i_out_rms": 50,
    "f_out": 50,
    "f_sw": 4000,
    "modulation_index": 1.0,
    "power_factor": 0.85,
    "modulation": "spwm",
    "t_ambient": 40
  }
}
```

**响应 200**
```json
{
  "device_type": "igbt_module",
  "module_name": "FS100R12KT4",
  "conditions": { "... 回显输入条件 ..." },
  "p_total_loss": 897.03,
  "p_igbt_cond": 253.39,
  "p_igbt_sw": 497.44,
  "p_diode_cond": 22.73,
  "p_diode_sw": 123.46,
  "p_brake_loss": 0.0,
  "efficiency": 96.79,
  "p_out": 27046.83,
  "t_j_max": 159.74,
  "t_j_max_device": "IGBT_H_U",
  "t_case_est": 141.73,
  "t_heatsink_est": 123.79,
  "iteration_count": 6,
  "converged": true,
  "devices": [
    {
      "name": "IGBT_H_U",
      "p_cond": 42.23,
      "p_sw": 82.91,
      "p_total": 125.14,
      "t_j": 159.74,
      "type": "IGBT"
    }
  ],
  "calculation_steps": [
    {
      "title": "输入参数",
      "type": "input",
      "data": { "直流母线电压 Vdc": "600 V", ... }
    },
    {
      "title": "导通损耗计算",
      "type": "calculation",
      "formula": "Pcond_IGBT = Vce(sat)(Tj) × Ic × D(θ), 数值积分",
      "data": { ... }
    },
    {
      "title": "热迭代收敛过程 (6 次迭代)",
      "type": "thermal",
      "data": [
        {"iteration": 1, "t_heatsink": 123.79, ...}
      ]
    },
    {
      "title": "总损耗汇总",
      "type": "summary",
      "data": { ... }
    }
  ],
  "per_leg": {
    "p_igbt_cond": 84.46,
    "p_igbt_sw": 165.81,
    "p_diode_cond": 7.58,
    "p_diode_sw": 41.15,
    "i_igbt_avg": 40.14,
    "i_igbt_rms": 48.05,
    "i_diode_avg": 4.83,
    "i_diode_rms": 13.74
  }
}
```

---

### POST /api/calculate/curve

参数扫描生成特性曲线。

**请求体**
```json
{
  "config": { "... 同上 ..." },
  "conditions": { "... 同上 ..." },
  "sweep_param": "i_out",
  "sweep_start": 1.0,
  "sweep_end": 100.0,
  "sweep_points": 50
}
```

`sweep_param` 可选值：`"i_out"`, `"f_sw"`, `"cos_phi"`

**响应 200**
```json
{
  "curves": [
    {
      "name": "Total Loss",
      "x_label": "Output RMS Current (A)",
      "y_label": "Loss (W)",
      "points": [
        {"x": 1.0, "y": 15.2},
        {"x": 50.0, "y": 897.0},
        {"x": 100.0, "y": 2456.3}
      ]
    }
  ]
}
```

---

### POST /api/datasheet/parse

上传 PDF 规格书并提取参数。

**请求** (`multipart/form-data`)
- `file`: PDF 文件
- `device_type`: `"igbt_module"` | `"sic_module"` | 等

**响应 200**
```json
{
  "file_name": "FS100R12KT4_datasheet.pdf",
  "page_count": 12,
  "metadata": {
    "part_number": "FS100R12KT4",
    "manufacturer": "Infineon",
    "confidence": {
      "part_number": 0.8,
      "manufacturer": 0.9
    }
  },
  "parameters": {
    "vce_sat_25": 1.7,
    "vce_sat_125": 2.05,
    "vce_rated": 1200,
    "ic_nom": 100,
    "vf_25": 1.8,
    "vf_125": 1.65,
    "eon": 15.0,
    "eoff": 10.0,
    "err": 8.0,
    "rth_jc_igbt": 0.24,
    "rth_jc_diode": 0.42,
    "confidence": {
      "vce_sat_25": 0.85,
      "vce_sat_125": 0.70,
      "vce_rated": 0.90,
      "eon": 0.85,
      "eoff": 0.85,
      "err": 0.80,
      "rth_jc_igbt": 0.80
    }
  },
  "raw_text_sample": "FS100R12KT4\nTechnischer Information / Technical Information\nIGBT-Module\n..."
}
```

---

### POST /api/export/excel

导出 Excel 工作簿。

**请求体**：完整的 CalculationResult JSON

**响应**：`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 二进制流

Excel 工作表：
1. **Summary** — 损耗汇总、效率、结温、运行条件
2. **Device Details** — 所有器件的详细损耗表
3. **Calculation Steps** — 中间计算步骤和热迭代日志

---

### POST /api/export/csv

导出 CSV 文件。

**请求体**：完整的 CalculationResult JSON

**响应**：`text/csv` 文本流

包含：汇总参数行 + 器件详细数据行

---

## 错误响应

所有端点统一错误格式：

```json
{
  "detail": "错误描述信息"
}
```

HTTP 状态码：
- `400` — 请求参数错误
- `500` — 服务器内部错误（计算失败、PDF 解析失败等）

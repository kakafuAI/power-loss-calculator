# Changelog

## [1.0.0] — 2026-05-14

### Added
- 三相两电平逆变器损耗计算引擎（导通损耗 + 开关损耗 + 热迭代）
- 支持 IGBT PIM 模块、IPM 模块、IGBT 单管、SiC 模块、SiC 单管
- PDF 规格书自动参数提取（多品牌正则匹配 + 置信度评分）
- React Web 界面：4 步向导（器件选择 → 参数设置 → 工况设置 → 计算结果）
- 损耗分布饼图、器件损耗柱状图、调制波形图、特性曲线
- 中间计算过程展示（7 步详情 + 热迭代收敛日志）
- Excel / CSV 结果导出
- FastAPI REST API（/calculate, /calculate/curve, /datasheet/parse, /export/*）

### Design Documents
- design/requirements.md — 需求规格说明书
- design/architecture-design.md — 系统架构设计
- design/calculation-model.md — 损耗计算模型数学推导
- design/ui-design.md — 界面设计文档

### Fixed (during v1.0 development)
- 开关损耗 mJ→W 单位转换（除以 1000）
- 热模型 Rth_ch 模块级共享壳温
- 温度线性插值钳位 [25°C, 200°C] 防热失控发散
- 单数据点能量查找线性缩放（插入原点，修复轻载严重高估）
- 上下管开关损耗倍数（n_dev_per_leg=2，修复少算一半）
- echarts-for-react 依赖 tslib 安装

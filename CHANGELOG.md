# Changelog

## [1.2.0] — 2026-05-14

### Added
- **SQLite 数据持久化**: 5 表数据库（器件库、计算历史、对比分析、数据表缓存、知识库）
- **20+ 内置标杆模块**: Infineon/Mitsubishi/Fuji/Semikron/Wolfspeed/Rohm 等主流型号完整参数
- **交互式概念图解**: 7 个 SVG 动画组件（调制比、功率因数、导通损耗、开关损耗、二极管续流、热阻网络、热迭代）
- **增强 PDF 解析**: 新增 Rg_int, Tj_max, 开关时间, 输入电容, 多点开关能量曲线, 表格感知解析, SHA256 缓存
- **对比分析引擎**: 自动异常检测（物理合理性、历史偏差、跨器件偏差）、差异可视化
- **知识库系统**: 参数修正记录、验证计数、可信度评分
- **侧边栏导航**: 损耗计算、器件库、概念图解、计算历史、对比分析 5 个页面
- **器件库浏览**: 搜索、筛选、使用内置/自定义器件
- **计算历史**: 持久化记录、星级评分、异常标记、可展开工况详情
- **ErrorBoundary**: 全局错误回退 UI，防止单组件崩溃导致空白页

### Fixed
- 波形标签页 `dutyData` 未定义导致崩溃并卸载整个 React 树
- `.npmrc` prefix 冲突导致 npm 依赖安装到错误路径

### Changed
- App.tsx 从单一 4 步向导重构为侧边栏多页面导航
- API 版本号更新为 1.2.0
- 前端新增 3 个 npm 依赖: react-router-dom, @ant-design/icons (已有), axios (已有)

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

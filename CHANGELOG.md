# Changelog

## [1.3.0] — 2026-05-16

### Added
- **DeepSeek LLM PDF 参数提取**: 基于大模型的规格书解析引擎 (llm_parser.py)，兼容 OpenAI SDK
  - 自动提取 IGBT/SiC 全部电气和热参数，含多品牌格式适配
  - JSON Schema 约束输出，置信度评分
  - 失败自动回退 regex 解析器
  - DEEPSEEK_API_KEY 通过 backend/.env 配置，启动时自动加载

### Fixed
- **器件库选型后计算报错**: 内置器件 points 格式 `[[x,y]]` → `[{current,energy}]`，前后端统一归一化兼容
- **开关损耗始终为 0**: `_normalize_points` 不识别 Pydantic SwitchingPoint 对象，新增 `hasattr` 检测
- **PDF 提取开关损耗参数缺失**: `handleUpload` 未将单点能量值映射到曲线 points 数组
- **计算历史未记录**: `saveHistory` 前后端字段名不匹配（`config`→`device_name` 等）
- **对比分析失败**: `selectedDevice.device_name`→`name` 字段修正；芯片型号未显示
- **LLM 元数据缺失**: 提取 prompt 增加 `part_number` / `manufacturer` 字段

### SiC/IGBT 全项目区分
- **后端 topology.py**: 器件命名 `IGBT_H_U`→`SiC_MOS_H_U`，type 字段 `"IGBT"`→`"SiC MOSFET"` / `"Body Diode"`
- **后端 topology.py**: 计算步骤标签全部 SiC 感知（`Rds(on)`/`Vsd`/`SiC MOSFET导通损耗`/`体二极管导通损耗`）
- **前端 ResultDashboard**: 11 处硬编码"IGBT"改为 `isSiC` 分支；选型建议文案 SiC 自适应
- **前端 LossPieChart**: 饼图标签区分 SiC MOSFET / 体二极管
- **前端 ThermalNetworkDiagram**: Vce 初始化从 `sic_mos.rds_on` 读取；显示标签动态切换
- **后端 models/calculation.py**: DeviceLoss 新增 `type` 字段

### Changed
- **参数面板合并**: 手动输入 + 规格书提取统一为单一视图，置信度颜色标识（绿≥80% / 橙 50-79% / 红 <50%）
- **工况智能初始化**: 器件选择后 `vdc` / `i_out_rms` 自动按器件额定值预设（50% 额定）
- **概念图解初始值**: 传入实际器件 config，滑块跟随器件参数同步
- **对比分析增强**: 可从历史自动加载最新结果，显示型号 + 制造商
- **raw_text_sample**: 扩展至 3000 字符

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

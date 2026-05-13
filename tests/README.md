# 测试

## 引擎单元测试 (`test_engine.py`)

测试后端计算引擎的核心函数，无需启动服务器。

```bash
cd tests
python3 test_engine.py
```

测试覆盖：
- **温度插值** — Vce(sat)、Vf、Rds(on) 的温度线性插值及钳位
- **导通损耗** — IGBT、SiC MOSFET、二极管导通损耗数值积分
- **开关损耗** — 能量查找表、能量缩放、开关损耗计算
- **完整计算** — 三相逆变器全损耗计算 + 热迭代收敛
- **特性曲线** — 参数扫描生成损耗/效率/结温曲线

## API 集成测试 (`test_api.py`)

测试所有 REST API 端点，需要后端服务器运行。

```bash
# 先启动后端
cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# 运行测试
cd tests
python3 test_api.py
```

测试覆盖：
- **健康检查** — GET /api/health
- **损耗计算** — POST /api/calculate（验证响应结构）
- **特性曲线** — POST /api/calculate/curve（参数扫描）
- **Excel 导出** — POST /api/export/excel（二进制文件验证）
- **CSV 导出** — POST /api/export/csv（文本内容验证）

## 交叉验证

工具的计算结果可与以下参考工具交叉验证：

- **Infineon IPOSIM** — 使用相同的器件参数和工况对比总损耗和结温
- **Mitsubishi Melcosim** — 验证三相逆变器拓扑损耗分布
- **手动计算** — 对简单工况（纯电阻负载、低开关频率）进行手工验算

典型偏差应在以下范围：
- 导通损耗：< 5%（数值积分精度）
- 开关损耗：< 10%（能量缩放模型差异）
- 结温：< 5%（热迭代收敛容差）

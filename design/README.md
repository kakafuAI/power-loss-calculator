# 设计文档

> 版本: v1.0.0 | 日期: 2026-05-14

## 文档索引

| 文档 | 内容 | 受众 |
|------|------|------|
| [requirements.md](requirements.md) | 需求规格说明书 — 功能需求、非功能需求、版本规划 | PM / 开发者 |
| [architecture-design.md](architecture-design.md) | 系统架构设计 — 分层架构、数据流、关键设计决策 | 开发者 |
| [calculation-model.md](calculation-model.md) | 损耗计算模型 — 数学公式推导、热迭代算法 | 算法工程师 / 开发者 |
| [ui-design.md](ui-design.md) | 界面设计 — 信息架构、组件树、交互规范 | 前端开发者 / 设计师 |

## 与代码的关系

```
design/                         ← 设计文档（本目录）
  ├── requirements.md           → 对应 frontend/src/types/ (数据模型)
  ├── architecture-design.md    → 对应 backend/app/ (后端架构)
  │                             → 对应 frontend/src/ (前端架构)
  ├── calculation-model.md      → 对应 backend/app/engine/ (计算引擎)
  └── ui-design.md              → 对应 frontend/src/components/ (UI 组件)

docs/                           ← 用户文档
  ├── usage-guide.md            → 使用指南
  └── api-reference.md          → API 接口文档
```

## 版本管理

设计文档与代码在同一 git 仓库中统一版本管理。每次发版：

1. 更新设计文档以反映实际实现
2. 更新文档头部的版本号和日期
3. `git commit` 与代码变更一起提交
4. `git tag vX.Y.Z` 标记版本

查看特定版本的设计文档：
```bash
git show v1.0.0:design/calculation-model.md
```

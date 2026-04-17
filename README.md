# Open Regression Copilot

面向测试团队的开源 AI 自动化测试平台。

当前版本聚焦一件事：

**从网页平台流量中自动发现接口，生成接口测试用例，并执行回归测试。**

这不是一个只会“生成代码”的 AI 工具，而是一个更适合测试团队使用的测试工作台：

- 导入 HAR 或请求样本
- 自动识别业务接口
- 自动生成接口测试用例
- 执行测试并输出报告
- 给出失败原因解释
- 支持本地运行与后续自托管扩展

## 当前已实现

- 中文控制台界面
- 左侧菜单栏 + 右侧功能区
- 项目配置
- 环境配置
- HAR 文本导入
- HAR 文件导入
- 请求 JSON 样本导入
- 接口自动归并
- 基础请求 / 响应结构识别
- 自动生成测试用例
- 自动执行测试
- 失败解释
- 本地状态持久化

## 适合谁用

- 手工测试工程师
- 自动化测试工程师
- QA 负责人
- 想搭建内部自动化测试平台的小团队

## 产品目标

让测试团队不需要从零写大量脚本，也能逐步把“网页业务流程”沉淀成“可运行、可维护、可复用”的测试资产。

## 本地启动

要求：

- Node.js 20+
- npm 10+

安装依赖：

```bash
npm install
```

启动后端服务：

```bash
npm run dev:api
```

启动前端控制台：

```bash
npm run dev:web
```

打开：

```text
http://localhost:5173
```

接口地址：

```text
http://localhost:4318
```

## 当前功能流程

1. 配置项目名称、环境、Base URL、认证方式
2. 上传 HAR 文件，或粘贴请求样本
3. 平台自动识别业务接口
4. 平台自动生成测试用例
5. 点击运行测试
6. 查看通过 / 失败 / 跳过结果
7. 查看失败原因和响应内容

## 项目结构

```text
open-regression-copilot/
  apps/
    api/        本地 API 服务
    web/        前端控制台
  docs/         产品文档、架构文档、路线图
```

## 常用命令

```bash
npm run dev:api
npm run dev:web
npm run check
npm run build
```

## 下一步路线

接下来会继续补这些能力：

- Playwright 网页录制
- 从网页操作自动抓接口
- 测试历史记录
- SQLite / PostgreSQL 持久化
- GitHub 集成
- Docker Compose 部署
- 更完整的测试报告

## 安全提醒

当前版本还是本地 MVP，请不要直接拿生产环境做测试。

建议只在以下场景使用：

- 本地环境
- 测试环境
- 预发环境
- Demo 环境

默认会跳过高风险接口测试，但你仍然需要自己确认环境安全。

## 文档

- [从这里开始](./docs/START_HERE.md)
- [下一步行动](./docs/NEXT_ACTIONS.md)
- [产品需求文档](./docs/PRD.md)
- [技术架构](./docs/ARCHITECTURE.md)
- [接口测试策略](./docs/API_TESTING_STRATEGY.md)
- [Flow Spec 设计](./docs/FLOW_SPEC.md)
- [路线图](./docs/ROADMAP.md)
- [开源计划](./docs/OPEN_SOURCE_PLAN.md)

## 开源协议

Apache-2.0


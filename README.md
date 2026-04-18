<div align="center">
  <img src="./assets/brand/logo.svg" alt="AITestAutomate Logo" width="140" />
  <h1>AITestAutomate</h1>
  <p><strong>面向测试团队的开源 AI 自动化测试平台，支持接口发现、测试用例生成与回归执行。</strong></p>
  <p>
    <a href="https://github.com/StarSure/AITestAutomate/blob/main/README.md">中文</a>
    ·
    <a href="https://github.com/StarSure/AITestAutomate/blob/main/README_EN.md">English</a>
    ·
    <a href="https://github.com/StarSure/AITestAutomate#本地启动">快速开始</a>
    ·
    <a href="https://github.com/StarSure/AITestAutomate/tree/main/docs">完整文档</a>
    ·
    <a href="https://github.com/StarSure/AITestAutomate/blob/main/CHANGELOG.md">更新日志</a>
    ·
    <a href="https://github.com/StarSure/AITestAutomate/blob/main/docs/FAQ.md">FAQ</a>
  </p>
  <p>
    <img src="https://img.shields.io/github/license/StarSure/AITestAutomate?style=for-the-badge" alt="license" />
    <img src="https://img.shields.io/badge/Node.js-20%2B-4b8b3b?style=for-the-badge" alt="node" />
    <img src="https://img.shields.io/badge/SQLite-enabled-2f6d99?style=for-the-badge" alt="sqlite" />
    <img src="https://img.shields.io/badge/Docker-ready-1d63ed?style=for-the-badge" alt="docker" />
    <img src="https://img.shields.io/github/stars/StarSure/AITestAutomate?style=for-the-badge" alt="stars" />
  </p>
</div>

---

## 开发状态

- 当前阶段：`MVP`
- 当前重点：接口发现、测试生成、回归执行
- 当前形态：本地可运行，可 Docker 部署，默认使用 SQLite 持久化

---

## 重要里程碑

- `2026-04-17`：公开发布第一版 MVP
- `2026-04-17`：完成中文控制台与 GitHub 开源仓库初始化
- `2026-04-17`：补充项目截图、双语 README、FAQ 与更新日志
- `2026-04-17`：完成品牌升级为 AITestAutomate，并接入 SQLite 与 Docker

---

## 项目截图

![平台总览](./assets/screenshots/dashboard-overview.png)

---

## 项目简介

AITestAutomate 不是一个只会“生成代码”的 AI 工具，而是一个更适合测试团队落地使用的自动化测试工作台。

它当前已经支持：

- 直接输入网页地址进行抓取
- 自动尝试登录并采集页面请求
- 自动识别页面元素
- 网页抓取任务状态跟踪
- 导入 OpenAPI / Swagger
- 导入 Postman Collection
- 导入 HAR 文件
- 导入 cURL
- 导入请求样本
- 自动识别业务接口
- 自动归并接口资产
- 人工确认接口资产后生成测试用例
- 自动生成接口测试用例
- 执行测试并输出报告
- 保存历史执行报告
- 展示失败原因和响应详情
- 使用 SQLite 持久化工作区状态
- 使用 Docker 一键启动

---

## 为什么做这个项目

很多测试团队知道业务流程，但并不掌握网页背后全部接口，也没有足够时间把这些流程沉淀成长期可维护的自动化测试资产。

这个项目想解决的问题是：

- 回归测试依赖人工重复执行
- 自动化脚本维护成本高
- 接口资产分散，没有统一沉淀
- 失败后排查成本高
- 很难把测试流程平台化

---

## 当前能力

### 1. 中文控制台

- 左侧菜单栏
- 右侧功能区
- 简洁的控制台总览与快捷入口
- 更接近真实平台型工具的交互结构

### 2. 项目配置

- 项目名称
- 项目描述
- Base URL
- 环境名称
- 认证方式
- 令牌占位符

### 3. 接口发现

- 支持直接输入网页地址进行抓取
- 支持网页抓取任务状态展示
- 支持自动登录尝试
- 支持页面元素抓取
- 支持 OpenAPI / Swagger 导入
- 支持 Postman Collection 导入
- 支持 HAR 文本导入
- 支持 HAR 文件导入
- 支持 cURL 导入
- 支持请求 JSON 样本导入
- 自动过滤静态资源和噪声请求
- 自动识别业务接口
- 支持勾选确认接口资产，再生成测试用例

### 4. 测试生成

- 自动生成接口测试用例
- 根据选中的接口资产生成用例
- 自动判断接口风险级别
- 高风险接口默认不直接执行

### 5. 执行报告

- 展示通过 / 失败 / 跳过
- 保存历史执行记录
- 支持查看每次执行的报告明细
- 展示响应内容
- 给出失败解释

### 6. 工程化能力

- SQLite 持久化
- Dockerfile
- docker-compose
- 后端直接托管前端静态资源

---

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

---

## Docker 启动

直接运行：

```bash
docker compose up --build
```

启动后访问：

```text
http://localhost:4318
```

说明：

- Docker 模式下后端会直接托管前端页面
- SQLite 数据文件保存在 `.data/aitestautomate.db`

---

## 当前功能流程

1. 配置项目名称、环境、Base URL、认证方式
2. 导入 OpenAPI / Postman / HAR / cURL / 请求样本，或直接输入网页地址抓取
3. 平台自动识别业务接口和页面元素
4. 勾选确认要纳入回归的接口资产
5. 平台根据确认后的接口生成测试用例
6. 点击运行测试
7. 查看历史报告、通过 / 失败 / 跳过结果、失败原因和响应内容

---

## 项目结构

```text
AITestAutomate/
  apps/
    api/        本地 API 服务
    web/        前端控制台
  docs/         产品文档、架构文档、路线图
  assets/       README 展示资源
  .data/        SQLite 数据目录
```

---

## 常用命令

```bash
npm run dev:api
npm run dev:web
npm run check
npm run build
docker compose up --build
```

---

## 下一步路线

接下来会继续补这些能力：

- Apifox 导入
- 更稳定的 Playwright 网页录制
- 登录后业务接口的深度采集
- 更完整的测试历史趋势
- GitHub 集成
- 更完整的测试报告

---

## 安全提醒

当前版本还是早期 MVP，请不要直接拿生产环境做测试。

建议只在以下场景使用：

- 本地环境
- 测试环境
- 预发环境
- Demo 环境

默认会跳过高风险接口测试，但你仍然需要自己确认环境安全。

---

## 文档

- [从这里开始](./docs/START_HERE.md)
- [下一步行动](./docs/NEXT_ACTIONS.md)
- [产品需求文档](./docs/PRD.md)
- [技术架构](./docs/ARCHITECTURE.md)
- [接口测试策略](./docs/API_TESTING_STRATEGY.md)
- [Flow Spec 设计](./docs/FLOW_SPEC.md)
- [常见问题](./docs/FAQ.md)
- [路线图](./docs/ROADMAP.md)
- [开源计划](./docs/OPEN_SOURCE_PLAN.md)
- [GitHub 发布计划](./docs/GITHUB_RELEASE_PLAN.md)
- [发布检查清单](./docs/RELEASE_CHECKLIST.md)
- [更新日志](./CHANGELOG.md)

---

## 开源协议

Apache-2.0

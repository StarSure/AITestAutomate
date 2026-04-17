# GitHub 发布计划

这份文档是给项目公开发布时用的。

## 仓库名称建议

推荐：

- `open-regression-copilot`

也可以考虑：

- `ai-regression-lab`
- `qa-api-copilot`
- `open-qa-regression`

如果你想更像平台名，继续用 `open-regression-copilot` 最稳。

## GitHub 仓库简介

可以直接用这一句：

> 面向测试团队的开源 AI 自动化测试平台，支持接口发现、测试用例生成与回归执行。

英文简介可用：

> Open-source AI testing platform for QA teams with API discovery, test generation, and regression execution.

## GitHub Topics 建议

建议添加这些 topics：

- `ai-testing`
- `api-testing`
- `regression-testing`
- `qa`
- `playwright`
- `test-automation`
- `open-source`

## 首版截图建议

建议在 README 后续加 3 张图：

1. 项目总览页
2. 接口发现页
3. 执行报告页

## 首版发布文案

中文：

> Open Regression Copilot 是一个面向测试团队的开源 AI 自动化测试平台。第一版先聚焦接口测试场景，支持从网页流量中自动发现接口、生成测试用例、执行测试并输出报告。欢迎试用、提 issue 和一起共建。

英文：

> Open Regression Copilot is an open-source AI testing platform for QA teams. The first version focuses on API testing workflows: discover APIs from web traffic, generate test cases, run regression checks, and review reports. Feedback and contributions are welcome.

## 发布前检查清单

- README 已更新
- LICENSE 已添加
- CONTRIBUTING 已添加
- SECURITY 已添加
- CODE_OF_CONDUCT 已添加
- 页面截图已准备
- 项目可本地启动
- `npm run check` 通过
- `npm run build` 通过
- 没有提交敏感信息

## 发布顺序建议

1. 先创建 GitHub 仓库
2. 提交当前 MVP 代码
3. 补截图
4. 写第一版发布说明
5. 发到测试、开发、开源社区收集反馈


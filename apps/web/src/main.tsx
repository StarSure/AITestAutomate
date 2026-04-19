import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  Braces,
  CheckCircle2,
  FileUp,
  FlaskConical,
  FolderCog,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Play,
  Radar,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Upload,
  Workflow,
  XCircle
} from "lucide-react";
import "./styles.css";

type Project = {
  name: string;
  description: string;
  baseUrl: string;
  environmentName: string;
  authMode: "none" | "bearer" | "cookie" | "apiKey";
  tokenPlaceholder: string;
};

type Endpoint = {
  id: string;
  method: string;
  path: string;
  displayName: string;
  baseUrl: string;
  risk: "low" | "medium" | "high";
  authRequired: boolean;
  observedCount: number;
  statuses: number[];
  queryParams: Record<string, string>;
  requestSchema: {
    type: string;
    fields?: Record<string, string>;
  };
  responseSchema: {
    type: string;
    fields?: Record<string, string>;
  };
  businessGuess: string;
};

type TestCase = {
  id: string;
  endpointId: string;
  name: string;
  type: string;
  method: string;
  url: string;
  risk: "low" | "medium" | "high";
  enabled: boolean;
};

type RunResult = {
  id: string;
  testCaseId: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  request: {
    method: string;
    url: string;
  };
  response?: {
    status: number;
    bodyPreview: string;
  };
  failureCategory?: string;
  aiExplanation: string;
};

type RunHistoryItem = {
  id: string;
  startedAt: string;
  finishedAt: string;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  results: RunResult[];
};

type CaptureTask = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  message: string;
  url: string;
  startedAt: string;
  finishedAt?: string;
  finalUrl?: string;
  title?: string;
  loginAttempted?: boolean;
  importedRequests?: number;
  capturedElements?: number;
  error?: string;
};

type Workspace = {
  project: Project;
  summary: {
    requests: number;
    endpoints: number;
    testCases: number;
    lastRun: number;
    updatedAt: string;
  };
  endpoints: Endpoint[];
  selectedEndpointIds: string[];
  testCases: TestCase[];
  lastRun: RunResult[];
  runHistory: RunHistoryItem[];
  capturedElements?: Array<{
    id: string;
    tag: string;
    text: string;
    role: string | null;
    name: string | null;
    placeholder: string | null;
    selectorHint: string;
  }>;
};

type NavKey = "dashboard" | "project" | "discover" | "capture" | "cases" | "reports";
type ImportMode = "openapi" | "postman" | "har" | "curl" | "manual";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4318";
const githubRepoUrl = "https://github.com/StarSure/AITestAutomate";

const navItems: Array<{ key: NavKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "总览", icon: <LayoutDashboard size={18} /> },
  { key: "project", label: "项目配置", icon: <Settings2 size={18} /> },
  { key: "discover", label: "接口发现", icon: <Upload size={18} /> },
  { key: "capture", label: "网页抓取", icon: <Radar size={18} /> },
  { key: "cases", label: "测试用例", icon: <FlaskConical size={18} /> },
  { key: "reports", label: "执行报告", icon: <Workflow size={18} /> }
];

function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [selectedNav, setSelectedNav] = useState<NavKey>("dashboard");
  const [importMode, setImportMode] = useState<ImportMode>("openapi");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [captureTask, setCaptureTask] = useState<CaptureTask | null>(null);
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureUsername, setCaptureUsername] = useState("");
  const [capturePassword, setCapturePassword] = useState("");
  const [openApiText, setOpenApiText] = useState(defaultOpenApiText);
  const [postmanText, setPostmanText] = useState(defaultPostmanText);
  const [harText, setHarText] = useState("");
  const [curlText, setCurlText] = useState(defaultCurlText);
  const [manualText, setManualText] = useState(defaultManualJson);
  const [statusMessage, setStatusMessage] = useState("准备就绪，可以开始导入接口流量。");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (!captureTask || !["queued", "running"].includes(captureTask.status)) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void syncCaptureTask(captureTask.id);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [captureTask]);

  const activeEndpoint = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return workspace.endpoints.find((endpoint) => endpoint.id === selectedEndpoint) ?? workspace.endpoints[0] ?? null;
  }, [selectedEndpoint, workspace]);

  const passed = workspace?.lastRun.filter((result) => result.status === "passed").length ?? 0;
  const failed = workspace?.lastRun.filter((result) => result.status === "failed").length ?? 0;
  const skipped = workspace?.lastRun.filter((result) => result.status === "skipped").length ?? 0;
  const activeRun = useMemo(() => {
    const history = workspace?.runHistory ?? [];
    return history.find((run) => run.id === selectedRunId) ?? history[0] ?? null;
  }, [selectedRunId, workspace]);

  async function loadWorkspace() {
    const response = await fetch(`${apiBase}/api/workspace`);
    const data = (await response.json()) as Workspace;
    setWorkspace(data);
    setProjectDraft(data.project);
    setSelectedEndpoint((current) => current ?? data.endpoints[0]?.id ?? null);
    setSelectedEndpointIds(data.selectedEndpointIds ?? data.endpoints.map((endpoint) => endpoint.id));
    setSelectedRunId((current) => current ?? data.runHistory?.[0]?.id ?? null);
  }

  async function resetSample() {
    await action("工作区已刷新。", async () => {
      await fetch(`${apiBase}/api/sample/reset`, { method: "POST" });
      await loadWorkspace();
    });
  }

  async function saveProject() {
    if (!projectDraft) {
      return;
    }

    await action("项目配置已保存。", async () => {
      await fetch(`${apiBase}/api/project`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectDraft)
      });
      await loadWorkspace();
    });
  }

  async function importHar() {
    await action("HAR 已导入，并完成接口发现。", async () => {
      const parsed = JSON.parse(harText);
      await fetch(`${apiBase}/api/discover/har`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed)
      });
      await loadWorkspace();
    });
  }

  async function importOpenApi() {
    await action("OpenAPI 已导入，并完成接口发现。", async () => {
      await fetch(`${apiBase}/api/import/openapi`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: openApiText })
      });
      await loadWorkspace();
    });
  }

  async function importPostman() {
    await action("Postman Collection 已导入，并完成接口发现。", async () => {
      await fetch(`${apiBase}/api/import/postman`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: postmanText })
      });
      await loadWorkspace();
    });
  }

  async function importCurl() {
    await action("cURL 已导入，并完成接口发现。", async () => {
      await fetch(`${apiBase}/api/import/curl`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: curlText })
      });
      await loadWorkspace();
    });
  }

  async function importManual() {
    await action("手动请求样本已导入，并完成接口发现。", async () => {
      const parsed = JSON.parse(manualText);
      await fetch(`${apiBase}/api/discover/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed)
      });
      await loadWorkspace();
    });
  }

  async function runTests() {
    await action("测试执行完成，可以查看报告。", async () => {
      const response = await fetch(`${apiBase}/api/tests/run`, { method: "POST" });
      const data = (await response.json()) as { run?: RunHistoryItem };
      setSelectedRunId(data.run?.id ?? null);
      await loadWorkspace();
      setSelectedNav("reports");
    });
  }

  async function captureWebPage() {
    setBusy(true);
    setStatusMessage("正在创建网页抓取任务...");

    try {
      const response = await fetch(`${apiBase}/api/capture/web`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: captureUrl,
          username: captureUsername,
          password: capturePassword
        })
      });
      const data = (await response.json()) as { task: CaptureTask };
      setCaptureTask(data.task);
      setStatusMessage(data.task.message);
      setSelectedNav("capture");
    } catch (error) {
      setBusy(false);
      setStatusMessage(`抓取任务创建失败：${String(error)}`);
    }
  }

  async function syncCaptureTask(taskId: string) {
    const response = await fetch(`${apiBase}/api/capture/tasks/${taskId}`);
    const data = (await response.json()) as { task: CaptureTask };
    setCaptureTask(data.task);
    setStatusMessage(data.task.message);

    if (data.task.status === "completed") {
      setBusy(false);
      await loadWorkspace();
    }

    if (data.task.status === "failed") {
      setBusy(false);
    }
  }

  async function saveEndpointSelection() {
    await action("接口确认完成，已重新生成测试用例。", async () => {
      const response = await fetch(`${apiBase}/api/endpoints/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpointIds: selectedEndpointIds })
      });
      const data = (await response.json()) as { workspace?: Workspace };
      await loadWorkspace();
      if (data.workspace?.testCases.length) {
        setSelectedNav("cases");
      }
    });
  }

  function toggleEndpointSelection(endpointId: string) {
    setSelectedEndpointIds((current) =>
      current.includes(endpointId) ? current.filter((id) => id !== endpointId) : [...current, endpointId]
    );
  }

  async function loadHarFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setHarText(text);
    setStatusMessage(`已加载 HAR 文件：${file.name}`);
  }

  async function action(message: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatusMessage("处理中...");

    try {
      await fn();
      setStatusMessage(message);
    } catch (error) {
      setStatusMessage(`执行失败：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">
            <Radar size={18} />
          </span>
          <div>
            <strong>AI测试平台</strong>
            <small>AITestAutomate</small>
          </div>
        </div>

        <div className="sidebar-project">
          <span className="sidebar-label">当前项目</span>
          <strong>AITestAutomate</strong>
          <small>{workspace?.project.environmentName ?? "-"}</small>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${selectedNav === item.key ? "active" : ""}`}
              onClick={() => setSelectedNav(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="sidebar-label">状态</span>
            <p>{statusMessage}</p>
          </div>
          <a href={githubRepoUrl} target="_blank" rel="noreferrer" className="sidebar-link">
            <GitBranch size={16} />
            打开 GitHub 仓库
          </a>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-copy">
            <h1>{navItems.find((item) => item.key === selectedNav)?.label ?? "总览"}</h1>
            <p>{busy ? "系统处理中..." : `最近更新时间：${formatDate(workspace?.summary.updatedAt)}`}</p>
          </div>
          <div className="header-actions">
            <button className="secondary-button" onClick={resetSample} disabled={busy}>
              <RotateCcw size={16} />
              刷新工作区
            </button>
            <button className="primary-button" onClick={runTests} disabled={busy}>
              <Play size={16} />
              运行测试
            </button>
          </div>
        </header>

        <section className="summary-row">
          <MetricCard title="采集请求" value={workspace?.summary.requests ?? 0} icon={<Upload size={18} />} />
          <MetricCard title="识别接口" value={workspace?.summary.endpoints ?? 0} icon={<Braces size={18} />} />
          <MetricCard title="生成用例" value={workspace?.summary.testCases ?? 0} icon={<FlaskConical size={18} />} />
          <MetricCard title="最近执行" value={`${passed}/${failed}/${skipped}`} icon={<Gauge size={18} />} note="通过 / 失败 / 跳过" />
        </section>

        {selectedNav === "dashboard" ? (
          <section className="content-grid two-col">
            <Panel title="平台说明" icon={<Bot size={18} />}>
              <div className="info-block">
                <p>当前版本先聚焦接口自动化测试，优先服务测试团队做回归。</p>
                <p>支持 OpenAPI、Postman、HAR、cURL、请求样本导入，也支持直接输入网页地址进行抓取。</p>
                <p>后续会继续增强页面录制、登录态复用、定时任务和团队协作能力。</p>
              </div>
            </Panel>

            <Panel title="工作区概览" icon={<FolderCog size={18} />}>
              <div className="kv-list">
                <Kv label="项目名称" value={workspace?.project.name ?? "-"} />
                <Kv label="环境" value={workspace?.project.environmentName ?? "-"} />
                <Kv label="Base URL" value={workspace?.project.baseUrl ?? "-"} />
                <Kv label="认证方式" value={workspace?.project.authMode ?? "-"} />
                <Kv label="最近更新时间" value={formatDate(workspace?.summary.updatedAt)} />
              </div>
            </Panel>

            <Panel title="当前选中接口" icon={<ShieldCheck size={18} />}>
              {activeEndpoint ? <EndpointOverview endpoint={activeEndpoint} /> : <EmptyText text="暂无接口数据。" />}
            </Panel>

            <Panel title="本地服务" icon={<CheckCircle2 size={18} />}>
              <div className="info-block">
                <p>前端地址：`http://localhost:5173/`</p>
                <p>接口地址：`http://localhost:4318/`</p>
                <p>状态持久化文件：`.data/aitestautomate.db`</p>
              </div>
            </Panel>
          </section>
        ) : null}

        {selectedNav === "project" ? (
          <section className="content-grid one-col">
            <Panel title="项目配置" icon={<Settings2 size={18} />}>
              {projectDraft ? (
                <div className="project-form">
                  <FormField label="项目名称">
                    <input value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
                  </FormField>
                  <FormField label="项目描述">
                    <textarea
                      className="text-input large"
                      value={projectDraft.description}
                      onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })}
                    />
                  </FormField>
                  <div className="form-grid">
                    <FormField label="Base URL">
                      <input
                        value={projectDraft.baseUrl}
                        onChange={(event) => setProjectDraft({ ...projectDraft, baseUrl: event.target.value })}
                      />
                    </FormField>
                    <FormField label="环境名称">
                      <input
                        value={projectDraft.environmentName}
                        onChange={(event) => setProjectDraft({ ...projectDraft, environmentName: event.target.value })}
                      />
                    </FormField>
                  </div>
                  <div className="form-grid">
                    <FormField label="认证方式">
                      <select
                        value={projectDraft.authMode}
                        onChange={(event) =>
                          setProjectDraft({
                            ...projectDraft,
                            authMode: event.target.value as Project["authMode"]
                          })
                        }
                      >
                        <option value="none">none</option>
                        <option value="bearer">bearer</option>
                        <option value="cookie">cookie</option>
                        <option value="apiKey">apiKey</option>
                      </select>
                    </FormField>
                    <FormField label="令牌占位符">
                      <input
                        value={projectDraft.tokenPlaceholder}
                        onChange={(event) => setProjectDraft({ ...projectDraft, tokenPlaceholder: event.target.value })}
                      />
                    </FormField>
                  </div>
                  <button className="primary-button inline-button" onClick={saveProject} disabled={busy}>
                    <Save size={16} />
                    保存配置
                  </button>
                </div>
              ) : null}
            </Panel>
          </section>
        ) : null}

        {selectedNav === "discover" ? (
          <section className="content-grid two-col">
            <Panel title="接口导入" icon={<Upload size={18} />}>
              <div className="info-block">
                <p>支持多种常见导入方式，适合不同团队的现有资产。</p>
              </div>

              <div className="import-tabs">
                <button className={`import-tab ${importMode === "openapi" ? "active" : ""}`} onClick={() => setImportMode("openapi")}>
                  OpenAPI
                </button>
                <button className={`import-tab ${importMode === "postman" ? "active" : ""}`} onClick={() => setImportMode("postman")}>
                  Postman
                </button>
                <button className={`import-tab ${importMode === "har" ? "active" : ""}`} onClick={() => setImportMode("har")}>
                  HAR
                </button>
                <button className={`import-tab ${importMode === "curl" ? "active" : ""}`} onClick={() => setImportMode("curl")}>
                  cURL
                </button>
                <button className={`import-tab ${importMode === "manual" ? "active" : ""}`} onClick={() => setImportMode("manual")}>
                  手动 JSON
                </button>
              </div>

              {importMode === "openapi" ? (
                <>
                  <label className="field-label">OpenAPI / Swagger 内容</label>
                  <textarea
                    value={openApiText}
                    onChange={(event) => setOpenApiText(event.target.value)}
                    className="code-input"
                    placeholder="支持 JSON 或 YAML"
                  />
                  <button className="primary-button inline-button" onClick={importOpenApi} disabled={busy}>
                    导入 OpenAPI
                  </button>
                </>
              ) : null}

              {importMode === "postman" ? (
                <>
                  <label className="field-label">Postman Collection 内容</label>
                  <textarea
                    value={postmanText}
                    onChange={(event) => setPostmanText(event.target.value)}
                    className="code-input"
                    placeholder="粘贴 Postman Collection JSON"
                  />
                  <button className="primary-button inline-button" onClick={importPostman} disabled={busy}>
                    导入 Postman
                  </button>
                </>
              ) : null}

              {importMode === "har" ? (
                <>
                  <label className="upload-button">
                    <FileUp size={16} />
                    选择 HAR 文件
                    <input type="file" accept=".har,.json,application/json" onChange={loadHarFile} />
                  </label>
                  <label className="field-label">HAR 内容</label>
                  <textarea
                    value={harText}
                    onChange={(event) => setHarText(event.target.value)}
                    className="code-input compact"
                    placeholder="将浏览器导出的 HAR 文件内容粘贴到这里"
                  />
                  <button className="secondary-button inline-button" onClick={importHar} disabled={busy || !harText.trim()}>
                    导入 HAR
                  </button>
                </>
              ) : null}

              {importMode === "curl" ? (
                <>
                  <label className="field-label">cURL 命令</label>
                  <textarea
                    value={curlText}
                    onChange={(event) => setCurlText(event.target.value)}
                    className="code-input compact"
                    placeholder="粘贴 curl 命令"
                  />
                  <button className="primary-button inline-button" onClick={importCurl} disabled={busy}>
                    导入 cURL
                  </button>
                </>
              ) : null}

              {importMode === "manual" ? (
                <>
                  <label className="field-label">请求 JSON 样本</label>
                  <textarea value={manualText} onChange={(event) => setManualText(event.target.value)} className="code-input" />
                  <button className="primary-button inline-button" onClick={importManual} disabled={busy}>
                    导入请求样本
                  </button>
                </>
              ) : null}
            </Panel>

            <Panel title="接口发现结果" icon={<Braces size={18} />}>
              <div className="confirm-toolbar">
                <div>
                  <strong>接口资产确认</strong>
                  <small>已选择 {selectedEndpointIds.length} / {workspace?.endpoints.length ?? 0} 个接口生成测试用例</small>
                </div>
                <button className="primary-button inline-button" onClick={saveEndpointSelection} disabled={busy || selectedEndpointIds.length === 0}>
                  确认生成用例
                </button>
              </div>
              <div className="endpoint-list">
                {(workspace?.endpoints ?? []).map((endpoint) => (
                  <div
                    key={endpoint.id}
                    className={`endpoint-row ${activeEndpoint?.id === endpoint.id ? "active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEndpointIds.includes(endpoint.id)}
                      onChange={() => toggleEndpointSelection(endpoint.id)}
                      aria-label={`选择 ${endpoint.path}`}
                    />
                    <span className={`method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                    <button className="endpoint-main" onClick={() => setSelectedEndpoint(endpoint.id)}>
                      <strong>{endpoint.path}</strong>
                      <small>{endpoint.displayName}</small>
                    </button>
                    <RiskBadge risk={endpoint.risk} />
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {selectedNav === "cases" ? (
          <section className="content-grid two-col">
            <Panel title="生成的测试用例" icon={<FlaskConical size={18} />}>
              <div className="test-list">
                {(workspace?.testCases ?? []).map((testCase) => (
                  <div key={testCase.id} className="test-card">
                    <div>
                      <strong>{testCase.name}</strong>
                      <small>
                        {testCase.method} {safePathname(testCase.url)}
                      </small>
                    </div>
                    <div className="test-meta">
                      <RiskBadge risk={testCase.risk} />
                      <span className={testCase.enabled ? "enabled" : "disabled"}>{testCase.enabled ? "启用" : "待审核"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="接口详情" icon={<ShieldCheck size={18} />}>
              {activeEndpoint ? <EndpointOverview endpoint={activeEndpoint} /> : <EmptyText text="请先选择一个接口。" />}
            </Panel>
          </section>
        ) : null}

        {selectedNav === "reports" ? (
          <section className="content-grid two-col reports-grid">
            <Panel title="历史记录" icon={<Workflow size={18} />} action={<button className="primary-button inline-button" onClick={runTests} disabled={busy}><Play size={16} />运行测试</button>}>
              <div className="run-history-list">
                {(workspace?.runHistory ?? []).length === 0 ? (
                  <EmptyText text="还没有历史报告，点击“运行测试”生成第一条记录。" />
                ) : (
                  workspace?.runHistory.map((run) => (
                    <button
                      key={run.id}
                      className={`history-row ${activeRun?.id === run.id ? "active" : ""}`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <span>
                        <strong>{formatDate(run.finishedAt)}</strong>
                        <small>{run.summary.total} 条用例</small>
                      </span>
                      <span className="history-summary">
                        <b>{run.summary.passed}</b>/<b>{run.summary.failed}</b>/<b>{run.summary.skipped}</b>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="报告明细" icon={<ShieldCheck size={18} />}>
              {activeRun ? (
                <div className="run-list">
                  <div className="report-summary-card">
                    <strong>本次执行</strong>
                    <span>通过 {activeRun.summary.passed} · 失败 {activeRun.summary.failed} · 跳过 {activeRun.summary.skipped}</span>
                  </div>
                  {activeRun.results.map((result) => <RunResultCard key={result.id} result={result} />)}
                </div>
              ) : (
                <EmptyText text="还没有可查看的报告。" />
              )}
            </Panel>

            <Panel title="最近一次报告" icon={<Gauge size={18} />}>
              <div className="run-list">
                {(workspace?.lastRun ?? []).length === 0 ? (
                  <EmptyText text="还没有执行记录，点击“运行测试”开始。" />
                ) : (
                  workspace?.lastRun.map((result) => <RunResultCard key={result.id} result={result} />)
                )}
              </div>
            </Panel>
          </section>
        ) : null}

        {selectedNav === "capture" ? (
          <section className="content-grid two-col">
            <Panel title="网页抓取" icon={<Radar size={18} />} action={<button className="primary-button inline-button" onClick={captureWebPage} disabled={busy}><Play size={16} />开始抓取</button>}>
              <div className="project-form">
                <FormField label="目标地址">
                  <input
                    value={captureUrl}
                    onChange={(event) => setCaptureUrl(event.target.value)}
                    placeholder="请输入要抓取的网页地址"
                  />
                </FormField>
                <div className="form-grid">
                  <FormField label="用户名">
                    <input
                      value={captureUsername}
                      onChange={(event) => setCaptureUsername(event.target.value)}
                      placeholder="选填"
                    />
                  </FormField>
                  <FormField label="密码">
                    <input
                      type="password"
                      value={capturePassword}
                      onChange={(event) => setCapturePassword(event.target.value)}
                      placeholder="选填"
                    />
                  </FormField>
                </div>
                {captureTask ? <CaptureTaskCard task={captureTask} /> : null}
              </div>
            </Panel>

            <Panel title="抓取结果" icon={<Braces size={18} />}>
              <div className="capture-summary-grid">
                <div className="mini-stat">
                  <span>接口</span>
                  <strong>{workspace?.summary.endpoints ?? 0}</strong>
                </div>
                <div className="mini-stat">
                  <span>元素</span>
                  <strong>{workspace?.capturedElements?.length ?? 0}</strong>
                </div>
              </div>
              <div className="test-list">
                {(workspace?.capturedElements ?? []).length === 0 ? (
                  <EmptyText text="还没有抓到页面元素，请先执行网页抓取。" />
                ) : (
                  workspace?.capturedElements?.slice(0, 30).map((element) => (
                    <div key={element.id} className="test-card">
                      <div>
                        <strong>{element.tag}</strong>
                        <small>{element.selectorHint}</small>
                      </div>
                      <div className="test-meta">
                        <span className="enabled">{element.text || element.placeholder || element.name || "无文本"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Panel({
  title,
  icon,
  children,
  action
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel simple-panel">
      <div className="panel-heading">
        <div className="panel-title">
          {icon}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  icon,
  note
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="metric-card compact-card">
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <small>{title}</small>
      </div>
      <strong>{value}</strong>
      {note ? <em>{note}</em> : null}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const map = {
    low: "低风险",
    medium: "中风险",
    high: "高风险"
  };

  return <span className={`risk risk-${risk}`}>{map[risk]}</span>;
}

function CaptureTaskCard({ task }: { task: CaptureTask }) {
  const statusMap = {
    queued: "排队中",
    running: "抓取中",
    completed: "已完成",
    failed: "失败"
  };

  return (
    <div className={`capture-task capture-${task.status}`}>
      <div className="run-title">
        {task.status === "failed" ? <XCircle size={18} /> : task.status === "completed" ? <CheckCircle2 size={18} /> : <Radar size={18} />}
        <div>
          <strong>{statusMap[task.status]}</strong>
          <small>{task.message}</small>
        </div>
        <span>{task.id}</span>
      </div>
      <div className="kv-list compact-kv">
        <Kv label="目标地址" value={task.url} />
        <Kv label="开始时间" value={formatDate(task.startedAt)} />
        {task.finalUrl ? <Kv label="最终地址" value={task.finalUrl} /> : null}
        {task.importedRequests !== undefined ? <Kv label="捕获请求" value={String(task.importedRequests)} /> : null}
        {task.capturedElements !== undefined ? <Kv label="捕获元素" value={String(task.capturedElements)} /> : null}
      </div>
      {task.error ? <p>{task.error}</p> : null}
    </div>
  );
}

function EndpointOverview({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="endpoint-detail">
      <div className="detail-line">
        <span>接口地址</span>
        <code>
          {endpoint.method} {endpoint.path}
        </code>
      </div>
      <div className="detail-line">
        <span>Base URL</span>
        <code>{endpoint.baseUrl}</code>
      </div>
      <div className="detail-line">
        <span>AI 判断</span>
        <p>{endpoint.businessGuess}</p>
      </div>
      <div className="detail-line">
        <span>观测情况</span>
        <p>
          共发现 {endpoint.observedCount} 次，请求状态码：{endpoint.statuses.join(", ") || "未知"}
        </p>
      </div>
      <div className="schema-grid">
        <SchemaCard title="请求结构" schema={endpoint.requestSchema} />
        <SchemaCard title="响应结构" schema={endpoint.responseSchema} />
      </div>
    </div>
  );
}

function SchemaCard({ title, schema }: { title: string; schema: Endpoint["requestSchema"] }) {
  const fields = Object.entries(schema.fields ?? {});

  return (
    <div className="schema-card">
      <strong>{title}</strong>
      <span>{schema.type}</span>
      {fields.length > 0 ? (
        <ul>
          {fields.map(([key, value]) => (
            <li key={key}>
              <code>{key}</code>
              <small>{value}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>没有识别到结构化字段。</p>
      )}
    </div>
  );
}

function RunResultCard({ result }: { result: RunResult }) {
  const Icon = result.status === "passed" ? CheckCircle2 : result.status === "failed" ? XCircle : AlertTriangle;
  const label = result.status === "passed" ? "通过" : result.status === "failed" ? "失败" : "跳过";

  return (
    <article className={`run-card run-${result.status}`}>
      <div className="run-title">
        <Icon size={18} />
        <div>
          <strong>{result.name}</strong>
          <small>
            {result.request.method} {safePathname(result.request.url)} · {result.durationMs}ms
          </small>
        </div>
        <span>{label}</span>
      </div>
      {result.response ? (
        <div className="response-preview">
          <code>状态码 {result.response.status}</code>
          <pre>{result.response.bodyPreview}</pre>
        </div>
      ) : null}
      <p>{result.aiExplanation}</p>
    </article>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="empty-inline">{text}</div>;
}

function safePathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function formatDate(value?: string) {
  if (!value) {
    return "刚刚";
  }

  return new Date(value).toLocaleString("zh-CN");
}

const defaultManualJson = JSON.stringify(
  {
    requests: [
      {
        method: "POST",
        url: "https://demo-shop.local/api/login",
        status: 200,
        requestHeaders: {
          "content-type": "application/json"
        },
        responseHeaders: {
          "content-type": "application/json"
        },
        requestBody: {
          email: "{{TEST_USER_EMAIL}}",
          password: "{{TEST_USER_PASSWORD}}"
        },
        responseBody: {
          token: "sample-token",
          user: {
            id: "u_1001"
          }
        }
      },
      {
        method: "GET",
        url: "https://demo-shop.local/api/orders?page=1",
        status: 200,
        requestHeaders: {
          authorization: "Bearer {{TEST_USER_TOKEN}}"
        },
        responseHeaders: {
          "content-type": "application/json"
        },
        responseBody: {
          items: [
            {
              orderId: "o_1001",
              status: "created"
            }
          ]
        }
      }
    ]
  },
  null,
  2
);

const defaultCurlText = `curl -X POST "https://demo-shop.local/api/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"{{TEST_USER_EMAIL}}","password":"{{TEST_USER_PASSWORD}}"}'`;

const defaultOpenApiText = `openapi: 3.0.0
info:
  title: Demo API
  version: 1.0.0
servers:
  - url: https://demo-shop.local
paths:
  /api/login:
    post:
      summary: User login
      requestBody:
        content:
          application/json:
            example:
              email: "{{TEST_USER_EMAIL}}"
              password: "{{TEST_USER_PASSWORD}}"
      responses:
        "200":
          content:
            application/json:
              example:
                token: "sample-token"
                user:
                  id: "u_1001"`;

const defaultPostmanText = JSON.stringify(
  {
    info: {
      name: "Demo Collection"
    },
    item: [
      {
        name: "Login",
        request: {
          method: "POST",
          header: [
            {
              key: "Content-Type",
              value: "application/json"
            }
          ],
          url: {
            raw: "https://demo-shop.local/api/login"
          },
          body: {
            raw: JSON.stringify({
              email: "{{TEST_USER_EMAIL}}",
              password: "{{TEST_USER_PASSWORD}}"
            })
          }
        },
        response: [
          {
            code: 200,
            body: JSON.stringify({
              token: "sample-token"
            })
          }
        ]
      }
    ]
  },
  null,
  2
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

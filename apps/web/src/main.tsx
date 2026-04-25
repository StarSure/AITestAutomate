import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  Braces,
  Bug,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
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
  Wrench
} from "lucide-react";
import "./styles.css";

type Project = {
  name: string;
  description: string;
  baseUrl: string;
  environmentName: string;
  authMode: "none" | "bearer" | "cookie" | "apiKey";
  tokenPlaceholder: string;
  owner: string;
  notificationChannel: string;
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
  reviewStatus: "draft" | "ready" | "blocked";
  owner: string;
  notes: string;
  lastReviewedAt?: string;
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
  planId?: string;
  planName?: string;
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

type TestPlan = {
  id: string;
  name: string;
  description: string;
  environmentName: string;
  owner: string;
  triggerMode: "manual" | "scheduled" | "ci";
  cadence: string;
  status: "active" | "draft";
  caseIds: string[];
  lastRunId?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunSummary?: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
};

type Defect = {
  id: string;
  title: string;
  status: "open" | "triaged" | "resolved";
  severity: "low" | "medium" | "high";
  planId?: string;
  sourceRunId: string;
  testCaseId: string;
  endpointId: string;
  summary: string;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
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
    readyCases: number;
    plans: number;
    openDefects: number;
    lastRun: number;
    updatedAt: string;
  };
  workflow: {
    projectReady: boolean;
    assetsReady: boolean;
    casesReady: boolean;
    planReady: boolean;
    defectsOpen: number;
  };
  endpoints: Endpoint[];
  selectedEndpointIds: string[];
  testCases: TestCase[];
  testPlans: TestPlan[];
  selectedPlanId?: string;
  currentPlan?: TestPlan | null;
  lastRun: RunResult[];
  runHistory: RunHistoryItem[];
  defects: Defect[];
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

type NavKey = "dashboard" | "project" | "discover" | "cases" | "plans" | "reports" | "defects" | "capture";
type ImportMode = "openapi" | "postman" | "har" | "curl" | "manual";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4318";
const githubRepoUrl = "https://github.com/StarSure/AITestAutomate";

const navItems: Array<{ key: NavKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "流程总览", icon: <LayoutDashboard size={18} /> },
  { key: "project", label: "项目配置", icon: <Settings2 size={18} /> },
  { key: "discover", label: "接口发现", icon: <Upload size={18} /> },
  { key: "cases", label: "测试资产", icon: <FlaskConical size={18} /> },
  { key: "plans", label: "任务中心", icon: <ClipboardList size={18} /> },
  { key: "reports", label: "执行报告", icon: <Workflow size={18} /> },
  { key: "defects", label: "缺陷闭环", icon: <Bug size={18} /> },
  { key: "capture", label: "网页抓取", icon: <Radar size={18} /> }
];

function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [selectedNav, setSelectedNav] = useState<NavKey>("dashboard");
  const [importMode, setImportMode] = useState<ImportMode>("openapi");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<string[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDraft, setCaseDraft] = useState<TestCase | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState<TestPlan | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [captureTask, setCaptureTask] = useState<CaptureTask | null>(null);
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureUsername, setCaptureUsername] = useState("");
  const [capturePassword, setCapturePassword] = useState("");
  const [openApiText, setOpenApiText] = useState(defaultOpenApiText);
  const [postmanText, setPostmanText] = useState(defaultPostmanText);
  const [harText, setHarText] = useState("");
  const [curlText, setCurlText] = useState(defaultCurlText);
  const [manualText, setManualText] = useState(defaultManualJson);
  const [statusMessage, setStatusMessage] = useState("准备就绪，可以从项目配置开始。");
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

  const activeCase = useMemo(() => {
    if (!workspace) {
      return null;
    }
    return workspace.testCases.find((testCase) => testCase.id === selectedCaseId) ?? workspace.testCases[0] ?? null;
  }, [selectedCaseId, workspace]);

  const activePlan = useMemo(() => {
    if (!workspace) {
      return null;
    }
    return workspace.testPlans.find((plan) => plan.id === selectedPlanId) ?? workspace.currentPlan ?? workspace.testPlans[0] ?? null;
  }, [selectedPlanId, workspace]);

  const activeRun = useMemo(() => {
    const history = workspace?.runHistory ?? [];
    return history.find((run) => run.id === selectedRunId) ?? history[0] ?? null;
  }, [selectedRunId, workspace]);

  const activeDefect = useMemo(() => {
    const defects = workspace?.defects ?? [];
    return defects.find((defect) => defect.id === selectedDefectId) ?? defects[0] ?? null;
  }, [selectedDefectId, workspace]);

  useEffect(() => {
    if (activeCase) {
      setCaseDraft(activeCase);
    }
  }, [activeCase?.id]);

  useEffect(() => {
    if (activePlan) {
      setPlanDraft(activePlan);
    }
  }, [activePlan?.id]);

  const passed = activeRun?.summary.passed ?? workspace?.lastRun.filter((result) => result.status === "passed").length ?? 0;
  const failed = activeRun?.summary.failed ?? workspace?.lastRun.filter((result) => result.status === "failed").length ?? 0;
  const skipped = activeRun?.summary.skipped ?? workspace?.lastRun.filter((result) => result.status === "skipped").length ?? 0;

  async function loadWorkspace() {
    const data = (await apiRequest("/api/workspace")) as Workspace;
    setWorkspace(data);
    setProjectDraft(data.project);
    setSelectedEndpoint((current) => pickExisting(current, data.endpoints.map((endpoint) => endpoint.id)) ?? data.endpoints[0]?.id ?? null);
    setSelectedEndpointIds(data.selectedEndpointIds ?? data.endpoints.map((endpoint) => endpoint.id));
    setSelectedCaseId((current) => pickExisting(current, data.testCases.map((testCase) => testCase.id)) ?? data.testCases[0]?.id ?? null);
    setSelectedPlanId((current) => pickExisting(current, data.testPlans.map((plan) => plan.id)) ?? data.selectedPlanId ?? data.testPlans[0]?.id ?? null);
    setSelectedRunId((current) => pickExisting(current, data.runHistory.map((run) => run.id)) ?? data.runHistory[0]?.id ?? null);
    setSelectedDefectId((current) => pickExisting(current, data.defects.map((defect) => defect.id)) ?? data.defects[0]?.id ?? null);
  }

  async function resetWorkspace() {
    await action("工作区已基于当前资产重新构建。", async () => {
      await apiRequest("/api/sample/reset", { method: "POST" });
      await loadWorkspace();
    });
  }

  async function saveProject() {
    if (!projectDraft) {
      return;
    }

    await action("项目配置已保存。", async () => {
      await apiRequest("/api/project", {
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
      await apiRequest("/api/discover/har", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed)
      });
      await loadWorkspace();
    });
  }

  async function importOpenApi() {
    await action("OpenAPI 已导入，并完成接口发现。", async () => {
      await apiRequest("/api/import/openapi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: openApiText })
      });
      await loadWorkspace();
    });
  }

  async function importPostman() {
    await action("Postman Collection 已导入，并完成接口发现。", async () => {
      await apiRequest("/api/import/postman", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: postmanText })
      });
      await loadWorkspace();
    });
  }

  async function importCurl() {
    await action("cURL 已导入，并完成接口发现。", async () => {
      await apiRequest("/api/import/curl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: curlText })
      });
      await loadWorkspace();
    });
  }

  async function importManual() {
    await action("请求样本已导入，并完成接口发现。", async () => {
      const parsed = JSON.parse(manualText);
      await apiRequest("/api/discover/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed)
      });
      await loadWorkspace();
    });
  }

  async function saveEndpointSelection() {
    await action("接口资产确认完成，测试用例已更新。", async () => {
      await apiRequest("/api/endpoints/selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpointIds: selectedEndpointIds })
      });
      await loadWorkspace();
      setSelectedNav("cases");
    });
  }

  function toggleEndpointSelection(endpointId: string) {
    setSelectedEndpointIds((current) =>
      current.includes(endpointId) ? current.filter((id) => id !== endpointId) : [...current, endpointId]
    );
  }

  async function saveCase() {
    if (!caseDraft) {
      return;
    }

    await action("测试用例已更新。", async () => {
      await apiRequest(`/api/testcases/${caseDraft.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: caseDraft.enabled,
          reviewStatus: caseDraft.reviewStatus,
          owner: caseDraft.owner,
          notes: caseDraft.notes
        })
      });
      await loadWorkspace();
    });
  }

  async function selectPlan(planId: string) {
    setSelectedPlanId(planId);
    await apiRequest(`/api/plans/${planId}/select`, { method: "POST" });
    await loadWorkspace();
  }

  async function savePlan() {
    if (!planDraft) {
      return;
    }

    await action("测试计划已保存。", async () => {
      await apiRequest("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(planDraft)
      });
      await loadWorkspace();
    });
  }

  function togglePlanCase(caseId: string) {
    if (!planDraft) {
      return;
    }
    const exists = planDraft.caseIds.includes(caseId);
    setPlanDraft({
      ...planDraft,
      caseIds: exists ? planDraft.caseIds.filter((id) => id !== caseId) : [...planDraft.caseIds, caseId]
    });
  }

  async function runPlan(planId?: string) {
    const targetPlanId = planId ?? activePlan?.id;
    if (!targetPlanId) {
      return;
    }

    await action("计划执行完成，可以查看报告和缺陷闭环。", async () => {
      const data = (await apiRequest(`/api/plans/${targetPlanId}/run`, { method: "POST" })) as { run?: RunHistoryItem };
      await loadWorkspace();
      if (data.run?.id) {
        setSelectedRunId(data.run.id);
      }
      setSelectedNav("reports");
    });
  }

  async function updateDefectStatus(defectId: string, status: Defect["status"]) {
    await action(`缺陷状态已更新为 ${defectStatusLabel(status)}。`, async () => {
      await apiRequest(`/api/defects/${defectId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      await loadWorkspace();
      setSelectedNav("defects");
    });
  }

  async function captureWebPage() {
    setBusy(true);
    setStatusMessage("正在创建网页抓取任务...");

    try {
      const data = (await apiRequest("/api/capture/web", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: captureUrl,
          username: captureUsername,
          password: capturePassword
        })
      })) as { task: CaptureTask };
      setCaptureTask(data.task);
      setStatusMessage(data.task.message);
      setSelectedNav("capture");
    } catch (error) {
      setBusy(false);
      setStatusMessage(`抓取任务创建失败：${String(error)}`);
    }
  }

  async function syncCaptureTask(taskId: string) {
    const data = (await apiRequest(`/api/capture/tasks/${taskId}`)) as { task: CaptureTask };
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

  const selectedPlanCaseSet = new Set(planDraft?.caseIds ?? []);

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
          <strong>{workspace?.project.name ?? "AITestAutomate"}</strong>
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
            <h1>{navItems.find((item) => item.key === selectedNav)?.label ?? "流程总览"}</h1>
            <p>{busy ? "系统处理中..." : `最近更新时间：${formatDate(workspace?.summary.updatedAt)}`}</p>
          </div>
          <div className="header-actions">
            <button className="secondary-button" onClick={resetWorkspace} disabled={busy}>
              <RotateCcw size={16} />
              重建工作区
            </button>
            <button className="primary-button" onClick={() => void runPlan()} disabled={busy || !activePlan}>
              <Play size={16} />
              运行当前计划
            </button>
          </div>
        </header>

        <section className="summary-row summary-row-wide">
          <MetricCard title="采集请求" value={workspace?.summary.requests ?? 0} icon={<Upload size={18} />} />
          <MetricCard title="识别接口" value={workspace?.summary.endpoints ?? 0} icon={<Braces size={18} />} />
          <MetricCard title="测试用例" value={workspace?.summary.testCases ?? 0} icon={<FlaskConical size={18} />} />
          <MetricCard title="已就绪用例" value={workspace?.summary.readyCases ?? 0} icon={<ShieldCheck size={18} />} />
          <MetricCard title="执行计划" value={workspace?.summary.plans ?? 0} icon={<ClipboardList size={18} />} />
          <MetricCard title="未关闭缺陷" value={workspace?.summary.openDefects ?? 0} icon={<Bug size={18} />} />
        </section>

        {selectedNav === "dashboard" ? (
          <section className="content-grid two-col">
            <Panel title="流程主链路" icon={<Workflow size={18} />}>
              <div className="workflow-grid">
                <WorkflowStep title="1. 项目配置" ready={workspace?.workflow.projectReady ?? false} hint="环境、认证、负责人、通知渠道" />
                <WorkflowStep title="2. 接口资产" ready={workspace?.workflow.assetsReady ?? false} hint="导入 OpenAPI / Postman / HAR / cURL / 样本" />
                <WorkflowStep title="3. 用例审核" ready={workspace?.workflow.casesReady ?? false} hint="确认用例归属、状态和风险" />
                <WorkflowStep title="4. 执行计划" ready={workspace?.workflow.planReady ?? false} hint="把 ready 用例编排进计划并设置触发方式" />
                <WorkflowStep
                  title="5. 缺陷闭环"
                  ready={(workspace?.workflow.defectsOpen ?? 0) === 0}
                  hint={(workspace?.workflow.defectsOpen ?? 0) > 0 ? `还有 ${workspace?.workflow.defectsOpen} 条缺陷待处理` : "当前没有未关闭缺陷"}
                />
              </div>
            </Panel>

            <Panel title="当前执行面" icon={<Gauge size={18} />}>
              <div className="kv-list">
                <Kv label="当前计划" value={activePlan?.name ?? "未选择"} />
                <Kv label="计划环境" value={activePlan?.environmentName ?? "-"} />
                <Kv label="计划负责人" value={activePlan?.owner ?? "-"} />
                <Kv label="计划触发方式" value={triggerModeLabel(activePlan?.triggerMode)} />
                <Kv label="下次执行" value={formatDate(activePlan?.nextRunAt)} />
                <Kv label="最近执行" value={activeRun ? `${activeRun.summary.passed}/${activeRun.summary.failed}/${activeRun.summary.skipped}` : "暂无"} />
              </div>
            </Panel>

            <Panel title="推荐下一步" icon={<Bot size={18} />}>
              <div className="info-block">
                {!workspace?.workflow.assetsReady ? <p>先去“接口发现”导入资产，平台才能生成可审核的测试用例。</p> : null}
                {workspace?.workflow.assetsReady && !workspace.workflow.casesReady ? <p>接口已识别，下一步去“测试资产”把关键用例调整为 ready 并分配负责人。</p> : null}
                {workspace?.workflow.casesReady && !workspace.workflow.planReady ? <p>用例已就绪，下一步去“任务中心”确认计划范围和执行节奏。</p> : null}
                {workspace?.workflow.planReady ? <p>主流程已经打通，现在可以直接运行当前计划并在“缺陷闭环”里跟进失败项。</p> : null}
              </div>
            </Panel>

            <Panel title="本地访问" icon={<CheckCircle2 size={18} />}>
              <div className="info-block">
                <p>平台地址：`http://localhost:4318/`</p>
                <p>开发前端：`http://localhost:5173/`</p>
                <p>GitHub 仓库：`StarSure/AITestAutomate`</p>
              </div>
            </Panel>
          </section>
        ) : null}

        {selectedNav === "project" ? (
          <section className="content-grid one-col">
            <Panel title="项目配置" icon={<Settings2 size={18} />}>
              {projectDraft ? (
                <div className="project-form">
                  <div className="form-grid">
                    <FormField label="项目名称">
                      <input value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
                    </FormField>
                    <FormField label="环境名称">
                      <input
                        value={projectDraft.environmentName}
                        onChange={(event) => setProjectDraft({ ...projectDraft, environmentName: event.target.value })}
                      />
                    </FormField>
                  </div>
                  <FormField label="项目描述">
                    <textarea
                      className="text-input large"
                      value={projectDraft.description}
                      onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })}
                    />
                  </FormField>
                  <div className="form-grid">
                    <FormField label="Base URL">
                      <input value={projectDraft.baseUrl} onChange={(event) => setProjectDraft({ ...projectDraft, baseUrl: event.target.value })} />
                    </FormField>
                    <FormField label="负责人">
                      <input value={projectDraft.owner} onChange={(event) => setProjectDraft({ ...projectDraft, owner: event.target.value })} />
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
                  <FormField label="通知渠道">
                    <input
                      value={projectDraft.notificationChannel}
                      onChange={(event) => setProjectDraft({ ...projectDraft, notificationChannel: event.target.value })}
                    />
                  </FormField>
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
                <p>这一页解决“资产从哪里来”。支持文档导入、抓包导入和手工样本补录。</p>
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
                  <textarea value={openApiText} onChange={(event) => setOpenApiText(event.target.value)} className="code-input" />
                  <button className="primary-button inline-button" onClick={importOpenApi} disabled={busy}>
                    导入 OpenAPI
                  </button>
                </>
              ) : null}

              {importMode === "postman" ? (
                <>
                  <label className="field-label">Postman Collection 内容</label>
                  <textarea value={postmanText} onChange={(event) => setPostmanText(event.target.value)} className="code-input" />
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
                  <textarea value={harText} onChange={(event) => setHarText(event.target.value)} className="code-input compact" />
                  <button className="secondary-button inline-button" onClick={importHar} disabled={busy || !harText.trim()}>
                    导入 HAR
                  </button>
                </>
              ) : null}

              {importMode === "curl" ? (
                <>
                  <label className="field-label">cURL 命令</label>
                  <textarea value={curlText} onChange={(event) => setCurlText(event.target.value)} className="code-input compact" />
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

            <Panel title="接口确认" icon={<Braces size={18} />}>
              <div className="confirm-toolbar">
                <div>
                  <strong>纳入测试资产的接口</strong>
                  <small>
                    已选择 {selectedEndpointIds.length} / {workspace?.endpoints.length ?? 0} 个接口
                  </small>
                </div>
                <button className="primary-button inline-button" onClick={saveEndpointSelection} disabled={busy || selectedEndpointIds.length === 0}>
                  确认生成用例
                </button>
              </div>

              <div className="endpoint-list">
                {(workspace?.endpoints ?? []).map((endpoint) => (
                  <div key={endpoint.id} className={`endpoint-row ${activeEndpoint?.id === endpoint.id ? "active" : ""}`}>
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
            <Panel title="测试资产清单" icon={<FlaskConical size={18} />}>
              <div className="test-list">
                {(workspace?.testCases ?? []).map((testCase) => (
                  <button key={testCase.id} className={`test-card selectable-card ${activeCase?.id === testCase.id ? "active" : ""}`} onClick={() => setSelectedCaseId(testCase.id)}>
                    <div>
                      <strong>{testCase.name}</strong>
                      <small>
                        {testCase.method} {safePathname(testCase.url)}
                      </small>
                    </div>
                    <div className="test-meta">
                      <ReviewBadge status={testCase.reviewStatus} />
                      <RiskBadge risk={testCase.risk} />
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="用例审核" icon={<ShieldCheck size={18} />}>
              {caseDraft ? (
                <div className="project-form">
                  <div className="info-block detail-card">
                    <strong>{caseDraft.name}</strong>
                    <small>
                      {caseDraft.method} {safePathname(caseDraft.url)}
                    </small>
                  </div>
                  <div className="form-grid">
                    <FormField label="审核状态">
                      <select
                        value={caseDraft.reviewStatus}
                        onChange={(event) => setCaseDraft({ ...caseDraft, reviewStatus: event.target.value as TestCase["reviewStatus"] })}
                      >
                        <option value="draft">draft</option>
                        <option value="ready">ready</option>
                        <option value="blocked">blocked</option>
                      </select>
                    </FormField>
                    <FormField label="负责人">
                      <input value={caseDraft.owner} onChange={(event) => setCaseDraft({ ...caseDraft, owner: event.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="审核备注">
                    <textarea className="text-input large" value={caseDraft.notes} onChange={(event) => setCaseDraft({ ...caseDraft, notes: event.target.value })} />
                  </FormField>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={caseDraft.enabled}
                      onChange={(event) => setCaseDraft({ ...caseDraft, enabled: event.target.checked })}
                    />
                    <span>允许纳入执行计划</span>
                  </label>
                  <div className="kv-list compact-kv">
                    <Kv label="最近审核时间" value={formatDate(caseDraft.lastReviewedAt)} />
                    <Kv label="关联接口" value={workspace?.endpoints.find((endpoint) => endpoint.id === caseDraft.endpointId)?.path ?? "-"} />
                  </div>
                  <button className="primary-button inline-button" onClick={saveCase} disabled={busy}>
                    <Save size={16} />
                    保存审核结果
                  </button>
                </div>
              ) : (
                <EmptyText text="请先选择一条测试用例。" />
              )}
            </Panel>
          </section>
        ) : null}

        {selectedNav === "plans" ? (
          <section className="content-grid two-col">
            <Panel
              title="执行计划"
              icon={<ClipboardList size={18} />}
              action={
                <button className="primary-button inline-button" onClick={() => void runPlan()} disabled={busy || !activePlan}>
                  <Play size={16} />
                  运行计划
                </button>
              }
            >
              <div className="run-history-list">
                {(workspace?.testPlans ?? []).map((plan) => (
                  <button key={plan.id} className={`history-row ${activePlan?.id === plan.id ? "active" : ""}`} onClick={() => void selectPlan(plan.id)}>
                    <span>
                      <strong>{plan.name}</strong>
                      <small>
                        {plan.caseIds.length} 条用例 · {triggerModeLabel(plan.triggerMode)} · 下次 {formatDate(plan.nextRunAt)}
                      </small>
                    </span>
                    <span className={`pill pill-${plan.status}`}>{plan.status}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="计划编排" icon={<Wrench size={18} />}>
              {planDraft ? (
                <div className="project-form">
                  <div className="form-grid">
                    <FormField label="计划名称">
                      <input value={planDraft.name} onChange={(event) => setPlanDraft({ ...planDraft, name: event.target.value })} />
                    </FormField>
                    <FormField label="环境">
                      <input value={planDraft.environmentName} onChange={(event) => setPlanDraft({ ...planDraft, environmentName: event.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="计划说明">
                    <textarea className="text-input large" value={planDraft.description} onChange={(event) => setPlanDraft({ ...planDraft, description: event.target.value })} />
                  </FormField>
                  <div className="form-grid">
                    <FormField label="负责人">
                      <input value={planDraft.owner} onChange={(event) => setPlanDraft({ ...planDraft, owner: event.target.value })} />
                    </FormField>
                    <FormField label="触发方式">
                      <select
                        value={planDraft.triggerMode}
                        onChange={(event) => setPlanDraft({ ...planDraft, triggerMode: event.target.value as TestPlan["triggerMode"] })}
                      >
                        <option value="manual">manual</option>
                        <option value="scheduled">scheduled</option>
                        <option value="ci">ci</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="form-grid">
                    <FormField label="执行节奏">
                      <input value={planDraft.cadence} onChange={(event) => setPlanDraft({ ...planDraft, cadence: event.target.value })} />
                    </FormField>
                    <FormField label="计划状态">
                      <select value={planDraft.status} onChange={(event) => setPlanDraft({ ...planDraft, status: event.target.value as TestPlan["status"] })}>
                        <option value="active">active</option>
                        <option value="draft">draft</option>
                      </select>
                    </FormField>
                  </div>

                  <div className="kv-list compact-kv">
                    <Kv label="最近执行时间" value={formatDate(planDraft.lastRunAt)} />
                    <Kv label="下次执行时间" value={formatDate(planDraft.nextRunAt)} />
                    <Kv
                      label="最近执行结果"
                      value={
                        planDraft.lastRunSummary
                          ? `${planDraft.lastRunSummary.passed}/${planDraft.lastRunSummary.failed}/${planDraft.lastRunSummary.skipped}`
                          : "暂无"
                      }
                    />
                  </div>

                  <div className="plan-case-picker">
                    <div className="confirm-toolbar slim-toolbar">
                      <div>
                        <strong>纳入计划的 ready 用例</strong>
                        <small>当前已选择 {planDraft.caseIds.length} 条</small>
                      </div>
                    </div>
                    <div className="check-list">
                      {(workspace?.testCases ?? []).map((testCase) => (
                        <label key={testCase.id} className={`check-item ${selectedPlanCaseSet.has(testCase.id) ? "active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selectedPlanCaseSet.has(testCase.id)}
                            onChange={() => togglePlanCase(testCase.id)}
                            disabled={testCase.reviewStatus !== "ready" || !testCase.enabled}
                          />
                          <span>
                            <strong>{testCase.name}</strong>
                            <small>
                              {reviewStatusLabel(testCase.reviewStatus)} · {testCase.owner || "未分配"}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button className="primary-button inline-button" onClick={savePlan} disabled={busy || planDraft.caseIds.length === 0}>
                    <Save size={16} />
                    保存计划
                  </button>
                </div>
              ) : (
                <EmptyText text="请先选择一个执行计划。" />
              )}
            </Panel>
          </section>
        ) : null}

        {selectedNav === "reports" ? (
          <section className="content-grid two-col reports-grid">
            <Panel
              title="历史记录"
              icon={<Workflow size={18} />}
              action={
                <button className="primary-button inline-button" onClick={() => void runPlan()} disabled={busy || !activePlan}>
                  <Play size={16} />
                  运行计划
                </button>
              }
            >
              <div className="run-history-list">
                {(workspace?.runHistory ?? []).length === 0 ? (
                  <EmptyText text="还没有历史报告，先运行一次计划。" />
                ) : (
                  workspace?.runHistory.map((run) => (
                    <button key={run.id} className={`history-row ${activeRun?.id === run.id ? "active" : ""}`} onClick={() => setSelectedRunId(run.id)}>
                      <span>
                        <strong>{run.planName ?? "未命名计划"}</strong>
                        <small>{formatDate(run.finishedAt)}</small>
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
                    <strong>{activeRun.planName ?? "未命名计划"}</strong>
                    <span>
                      通过 {activeRun.summary.passed} · 失败 {activeRun.summary.failed} · 跳过 {activeRun.summary.skipped}
                    </span>
                  </div>
                  {activeRun.results.map((result) => (
                    <RunResultCard key={result.id} result={result} />
                  ))}
                </div>
              ) : (
                <EmptyText text="还没有可查看的报告。" />
              )}
            </Panel>
          </section>
        ) : null}

        {selectedNav === "defects" ? (
          <section className="content-grid two-col">
            <Panel title="缺陷列表" icon={<Bug size={18} />}>
              <div className="run-history-list">
                {(workspace?.defects ?? []).length === 0 ? (
                  <EmptyText text="当前没有缺陷，说明最近一次回归比较健康。" />
                ) : (
                  workspace?.defects.map((defect) => (
                    <button key={defect.id} className={`history-row ${activeDefect?.id === defect.id ? "active" : ""}`} onClick={() => setSelectedDefectId(defect.id)}>
                      <span>
                        <strong>{defect.title}</strong>
                        <small>{formatDate(defect.updatedAt)}</small>
                      </span>
                      <span className={`pill pill-${defect.status}`}>{defectStatusLabel(defect.status)}</span>
                    </button>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="缺陷闭环" icon={<AlertTriangle size={18} />}>
              {activeDefect ? (
                <div className="project-form">
                  <div className="detail-card">
                    <strong>{activeDefect.title}</strong>
                    <p>{activeDefect.summary}</p>
                  </div>
                  <div className="kv-list">
                    <Kv label="严重级别" value={activeDefect.severity} />
                    <Kv label="负责人" value={activeDefect.assignee} />
                    <Kv label="来源计划" value={workspace?.testPlans.find((plan) => plan.id === activeDefect.planId)?.name ?? "-"} />
                    <Kv label="最后发现时间" value={formatDate(activeDefect.lastSeenAt)} />
                  </div>
                  <div className="header-actions">
                    <button className="secondary-button inline-button" onClick={() => void updateDefectStatus(activeDefect.id, "open")} disabled={busy}>
                      重新打开
                    </button>
                    <button className="secondary-button inline-button" onClick={() => void updateDefectStatus(activeDefect.id, "triaged")} disabled={busy}>
                      标记已分诊
                    </button>
                    <button className="primary-button inline-button" onClick={() => void updateDefectStatus(activeDefect.id, "resolved")} disabled={busy}>
                      标记已解决
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyText text="还没有缺陷详情可查看。" />
              )}
            </Panel>
          </section>
        ) : null}

        {selectedNav === "capture" ? (
          <section className="content-grid two-col">
            <Panel
              title="网页抓取"
              icon={<Radar size={18} />}
              action={
                <button className="primary-button inline-button" onClick={captureWebPage} disabled={busy || !captureUrl.trim()}>
                  <Play size={16} />
                  开始抓取
                </button>
              }
            >
              <div className="project-form">
                <FormField label="目标地址">
                  <input value={captureUrl} onChange={(event) => setCaptureUrl(event.target.value)} placeholder="请输入要抓取的网页地址" />
                </FormField>
                <div className="form-grid">
                  <FormField label="用户名">
                    <input value={captureUsername} onChange={(event) => setCaptureUsername(event.target.value)} placeholder="选填" />
                  </FormField>
                  <FormField label="密码">
                    <input type="password" value={capturePassword} onChange={(event) => setCapturePassword(event.target.value)} placeholder="选填" />
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

function MetricCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="metric-card compact-card">
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <small>{title}</small>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function WorkflowStep({ title, ready, hint }: { title: string; ready: boolean; hint: string }) {
  return (
    <div className={`workflow-step ${ready ? "ready" : "pending"}`}>
      <div className="run-title">
        {ready ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}
        <div>
          <strong>{title}</strong>
          <small>{hint}</small>
        </div>
      </div>
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

function ReviewBadge({ status }: { status: TestCase["reviewStatus"] }) {
  return <span className={`pill pill-${status}`}>{reviewStatusLabel(status)}</span>;
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
        {task.status === "failed" ? <AlertTriangle size={18} /> : task.status === "completed" ? <CheckCircle2 size={18} /> : <Radar size={18} />}
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

function RunResultCard({ result }: { result: RunResult }) {
  const Icon = result.status === "passed" ? CheckCircle2 : result.status === "failed" ? AlertTriangle : CircleDashed;
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

async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, init);
  const data = (await response.json().catch(() => ({}))) as { error?: unknown; message?: string };
  if (!response.ok) {
    throw new Error(extractError(data));
  }
  return data;
}

function extractError(data: { error?: unknown; message?: string }) {
  if (typeof data.error === "string") {
    return data.error;
  }
  if (data.message) {
    return data.message;
  }
  if (data.error && typeof data.error === "object") {
    return JSON.stringify(data.error);
  }
  return "Unknown error";
}

function reviewStatusLabel(status: TestCase["reviewStatus"]) {
  if (status === "ready") {
    return "ready";
  }
  if (status === "blocked") {
    return "blocked";
  }
  return "draft";
}

function triggerModeLabel(mode?: TestPlan["triggerMode"]) {
  if (mode === "scheduled") {
    return "scheduled";
  }
  if (mode === "ci") {
    return "ci";
  }
  return "manual";
}

function defectStatusLabel(status: Defect["status"]) {
  if (status === "triaged") {
    return "已分诊";
  }
  if (status === "resolved") {
    return "已解决";
  }
  return "待处理";
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

function pickExisting(current: string | null, values: string[]) {
  if (current && values.includes(current)) {
    return current;
  }
  return null;
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

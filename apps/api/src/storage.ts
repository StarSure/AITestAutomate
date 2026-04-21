import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { discoverEndpoints, generateTestCases } from "./discovery.js";
import { sampleRequests } from "./sampleData.js";
import type { ApiTestCase, DefectItem, ProjectSettings, RawRequest, TestPlan, TestRunHistoryItem, WorkspaceState } from "./types.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const dbPath = resolve(repoRoot, ".data", "aitestautomate.db");

const defaultProject: ProjectSettings = {
  name: "AITestAutomate",
  description: "面向测试团队的开源 AI 自动化测试平台。",
  baseUrl: "https://demo-shop.local",
  environmentName: "staging",
  authMode: "bearer",
  tokenPlaceholder: "{{TEST_USER_TOKEN}}",
  owner: "QA Platform",
  notificationChannel: "#quality-alerts"
};

let db: Database.Database | null = null;

export async function initStorage() {
  await mkdir(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      project_json TEXT NOT NULL,
      requests_json TEXT NOT NULL,
      last_run_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const existing = db.prepare("SELECT id FROM workspace WHERE id = 1").get() as { id: number } | undefined;
  if (!existing) {
    const initial = createWorkspace(sampleRequests, defaultProject);
    persistWorkspace(initial);
  }
}

export async function loadState(): Promise<WorkspaceState> {
  const row = getDb()
    .prepare("SELECT project_json, requests_json, last_run_json, updated_at FROM workspace WHERE id = 1")
    .get() as
    | {
        project_json: string;
        requests_json: string;
        last_run_json: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    const fresh = createWorkspace(sampleRequests, defaultProject);
    persistWorkspace(fresh);
    return fresh;
  }

  const parsedProject = JSON.parse(row.project_json) as Partial<ProjectSettings>;
  const parsedRequests = JSON.parse(row.requests_json) as RawRequest[];
  const payload = JSON.parse(row.last_run_json) as {
    lastRun?: WorkspaceState["lastRun"];
    runHistory?: WorkspaceState["runHistory"];
    capturedElements?: WorkspaceState["capturedElements"];
    selectedEndpointIds?: WorkspaceState["selectedEndpointIds"];
    testPlans?: WorkspaceState["testPlans"];
    selectedPlanId?: WorkspaceState["selectedPlanId"];
    defects?: WorkspaceState["defects"];
    testCaseMeta?: Array<Pick<ApiTestCase, "id" | "reviewStatus" | "owner" | "notes" | "lastReviewedAt" | "enabled">>;
  };

  return hydrateState({
    project: {
      ...defaultProject,
      ...parsedProject
    },
    rawRequests: parsedRequests,
    endpoints: [],
    selectedEndpointIds: payload.selectedEndpointIds ?? [],
    testCases: [],
    testPlans: payload.testPlans ?? [],
    selectedPlanId: payload.selectedPlanId,
    lastRun: payload.lastRun ?? [],
    runHistory: payload.runHistory ?? [],
    defects: payload.defects ?? [],
    capturedElements: payload.capturedElements ?? [],
    updatedAt: row.updated_at
  }, payload.testCaseMeta ?? []);
}

export async function saveState(state: WorkspaceState) {
  persistWorkspace(state);
}

export function createWorkspace(rawRequests: RawRequest[], project: ProjectSettings): WorkspaceState {
  return hydrateState({
    project,
    rawRequests,
    endpoints: [],
    selectedEndpointIds: [],
    testCases: [],
    testPlans: [],
    selectedPlanId: undefined,
    lastRun: [],
    runHistory: [],
    defects: [],
    capturedElements: [],
    updatedAt: new Date().toISOString()
  });
}

export function replaceWorkspace(current: WorkspaceState, rawRequests: RawRequest[]) {
  return hydrateState({
    ...current,
    rawRequests,
    updatedAt: new Date().toISOString()
  });
}

export function updateProject(current: WorkspaceState, project: ProjectSettings) {
  return hydrateState({
    ...current,
    project,
    updatedAt: new Date().toISOString()
  });
}

export function updateSelectedEndpoints(current: WorkspaceState, selectedEndpointIds: string[]) {
  return hydrateState({
    ...current,
    selectedEndpointIds,
    updatedAt: new Date().toISOString()
  });
}

export function updateTestCase(current: WorkspaceState, testCaseId: string, patch: Partial<Pick<ApiTestCase, "enabled" | "reviewStatus" | "owner" | "notes">>) {
  const testCases = current.testCases.map((testCase) =>
    testCase.id === testCaseId
      ? {
          ...testCase,
          ...patch,
          lastReviewedAt: new Date().toISOString()
        }
      : testCase
  );

  return hydrateState({
    ...current,
    testCases,
    updatedAt: new Date().toISOString()
  });
}

export function upsertTestPlan(
  current: WorkspaceState,
  plan: Partial<Omit<TestPlan, "createdAt" | "updatedAt">> & Pick<TestPlan, "name" | "environmentName" | "owner" | "triggerMode" | "cadence" | "status" | "caseIds">
) {
  const now = new Date().toISOString();
  const existing = current.testPlans.find((item) => item.id === plan.id);
  const nextPlan: TestPlan = existing
    ? {
        ...existing,
        ...plan,
        updatedAt: now
      }
    : {
        id: plan.id ?? `plan_${Math.random().toString(36).slice(2, 10)}`,
        name: plan.name,
        description: plan.description ?? "",
        environmentName: plan.environmentName,
        owner: plan.owner,
        triggerMode: plan.triggerMode,
        cadence: plan.cadence,
        status: plan.status,
        caseIds: plan.caseIds,
        createdAt: now,
        updatedAt: now
      };

  return hydrateState({
    ...current,
    testPlans: [...current.testPlans.filter((item) => item.id !== nextPlan.id), nextPlan].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    selectedPlanId: nextPlan.id,
    updatedAt: now
  });
}

export function selectPlan(current: WorkspaceState, planId: string) {
  return {
    ...current,
    selectedPlanId: current.testPlans.some((plan) => plan.id === planId) ? planId : current.selectedPlanId,
    updatedAt: new Date().toISOString()
  };
}

export function appendRunHistory(current: WorkspaceState, run: TestRunHistoryItem): WorkspaceState {
  const runHistory = [run, ...(current.runHistory ?? [])].slice(0, 30);
  const testPlans = current.testPlans.map((plan) =>
    plan.id === run.planId
      ? {
          ...plan,
          lastRunId: run.id,
          updatedAt: run.finishedAt
        }
      : plan
  );

  const defects = reconcileDefects(current.defects ?? [], current.testCases, run);

  return hydrateState({
    ...current,
    lastRun: run.results,
    runHistory,
    testPlans,
    defects,
    updatedAt: run.finishedAt
  });
}

export function updateDefectStatus(current: WorkspaceState, defectId: string, status: DefectItem["status"]) {
  const defects = current.defects.map((defect) =>
    defect.id === defectId
      ? {
          ...defect,
          status,
          updatedAt: new Date().toISOString()
        }
      : defect
  );

  return {
    ...current,
    defects,
    updatedAt: new Date().toISOString()
  };
}

function hydrateState(parsed: WorkspaceState, persistedCaseMeta: Array<Pick<ApiTestCase, "id" | "reviewStatus" | "owner" | "notes" | "lastReviewedAt" | "enabled">> = []): WorkspaceState {
  const project = sanitizeProject(parsed.project);
  const rawRequests = parsed.rawRequests?.length ? parsed.rawRequests : sampleRequests;
  const endpoints = discoverEndpoints(rawRequests, project.baseUrl);
  const selectedEndpointIds = sanitizeSelectedEndpointIds(parsed.selectedEndpointIds, endpoints.map((endpoint) => endpoint.id));
  const generatedCases = generateTestCases(endpoints.filter((endpoint) => selectedEndpointIds.includes(endpoint.id)), project);
  const caseMetaMap = new Map(
    [...(parsed.testCases ?? []), ...persistedCaseMeta].map((testCase) => [
      testCase.id,
      {
        enabled: testCase.enabled,
        reviewStatus: testCase.reviewStatus,
        owner: testCase.owner,
        notes: testCase.notes,
        lastReviewedAt: testCase.lastReviewedAt
      }
    ])
  );

  const testCases = generatedCases.map((testCase) => {
    const meta = caseMetaMap.get(testCase.id);
    return meta
      ? {
          ...testCase,
          enabled: meta.enabled ?? testCase.enabled,
          reviewStatus: meta.reviewStatus ?? testCase.reviewStatus,
          owner: meta.owner ?? testCase.owner,
          notes: meta.notes ?? testCase.notes,
          lastReviewedAt: meta.lastReviewedAt ?? testCase.lastReviewedAt
        }
      : testCase;
  });

  const testPlans = syncPlans(parsed.testPlans ?? [], testCases, project);
  const selectedPlanId = testPlans.some((plan) => plan.id === parsed.selectedPlanId) ? parsed.selectedPlanId : testPlans[0]?.id;

  return {
    ...parsed,
    project,
    rawRequests,
    endpoints,
    selectedEndpointIds,
    testCases,
    testPlans,
    selectedPlanId,
    defects: sanitizeDefects(parsed.defects ?? [], testCases, testPlans),
    lastRun: parsed.lastRun ?? [],
    runHistory: parsed.runHistory ?? [],
    capturedElements: parsed.capturedElements ?? [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString()
  };
}

function sanitizeProject(project: ProjectSettings): ProjectSettings {
  const next = {
    ...defaultProject,
    ...project
  };

  if (next.name === "Demo Shop Regression Lab" || next.name === "AI测试平台" || next.name === "TestClaw") {
    next.name = "AITestAutomate";
  }

  if (next.description === "Community edition workspace for API discovery and regression testing.") {
    next.description = defaultProject.description;
  }

  return next;
}

function sanitizeSelectedEndpointIds(selectedEndpointIds: string[] | undefined, availableIds: string[]) {
  if (!selectedEndpointIds?.length) {
    return availableIds;
  }

  const selected = selectedEndpointIds.filter((id) => availableIds.includes(id));
  return selected.length > 0 ? selected : availableIds;
}

function syncPlans(existingPlans: TestPlan[], testCases: ApiTestCase[], project: ProjectSettings) {
  const now = new Date().toISOString();
  const caseIds = new Set(testCases.map((testCase) => testCase.id));
  const defaultPlans = createDefaultPlans(testCases, project, now);
  const defaultsById = new Map(defaultPlans.map((plan) => [plan.id, plan]));
  const sanitizedExisting = existingPlans
    .map((plan) => ({
      ...plan,
      caseIds: plan.caseIds.filter((caseId) => caseIds.has(caseId)),
      environmentName: plan.environmentName || project.environmentName,
      owner: plan.owner || project.owner
    }))
    .filter((plan) => plan.caseIds.length > 0);

  const merged = defaultPlans.map((plan) => {
    const existing = sanitizedExisting.find((item) => item.id === plan.id);
    return existing
      ? {
          ...plan,
          ...existing,
          caseIds: existing.caseIds.length > 0 ? existing.caseIds : plan.caseIds,
          updatedAt: existing.updatedAt || plan.updatedAt
        }
      : plan;
  });

  const customPlans = sanitizedExisting.filter((plan) => !defaultsById.has(plan.id));
  return [...merged, ...customPlans].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function createDefaultPlans(testCases: ApiTestCase[], project: ProjectSettings, now: string): TestPlan[] {
  const readyCases = testCases.filter((testCase) => testCase.enabled && testCase.reviewStatus === "ready");
  const smokeCases = readyCases.filter((testCase) => testCase.type === "happy_path" && testCase.risk !== "high");
  const authCases = readyCases.filter((testCase) => testCase.type === "unauthorized");

  const plans: TestPlan[] = [
    {
      id: "plan_smoke",
      name: "Smoke 回归",
      description: "适合发布前快速验证关键 happy path。",
      environmentName: project.environmentName,
      owner: project.owner,
      triggerMode: "manual",
      cadence: "按需执行",
      status: "active",
      caseIds: uniqueCaseIds(smokeCases.length > 0 ? smokeCases : readyCases.slice(0, 4)),
      createdAt: now,
      updatedAt: now
    },
    {
      id: "plan_regression",
      name: "Full Regression",
      description: "包含当前已审核通过的全部接口回归用例。",
      environmentName: project.environmentName,
      owner: project.owner,
      triggerMode: "scheduled",
      cadence: "每日 02:00",
      status: "active",
      caseIds: uniqueCaseIds(readyCases),
      createdAt: now,
      updatedAt: now
    },
    {
      id: "plan_auth",
      name: "鉴权防线",
      description: "专门验证登录态和权限边界，适合接入 CI。",
      environmentName: project.environmentName,
      owner: project.owner,
      triggerMode: "ci",
      cadence: "每次发布候选版本",
      status: authCases.length > 0 ? "active" : "draft",
      caseIds: uniqueCaseIds(authCases.length > 0 ? authCases : readyCases.filter((testCase) => testCase.risk === "low").slice(0, 2)),
      createdAt: now,
      updatedAt: now
    }
  ];

  return plans.filter((plan) => plan.caseIds.length > 0);
}

function uniqueCaseIds(testCases: ApiTestCase[]) {
  return [...new Set(testCases.map((testCase) => testCase.id))];
}

function reconcileDefects(existingDefects: DefectItem[], testCases: ApiTestCase[], run: TestRunHistoryItem) {
  const now = run.finishedAt;
  const caseById = new Map(testCases.map((testCase) => [testCase.id, testCase]));
  const next = existingDefects.map((defect) => ({ ...defect }));

  for (const result of run.results) {
    const testCase = caseById.get(result.testCaseId);
    if (!testCase) {
      continue;
    }

    const activeDefect = next.find((defect) => defect.testCaseId === result.testCaseId && defect.status !== "resolved");

    if (result.status === "failed") {
      if (activeDefect) {
        activeDefect.summary = result.aiExplanation;
        activeDefect.updatedAt = now;
        activeDefect.lastSeenAt = now;
        activeDefect.sourceRunId = run.id;
        activeDefect.planId = run.planId;
      } else {
        next.unshift({
          id: `bug_${Math.random().toString(36).slice(2, 10)}`,
          title: `${testCase.name} 回归失败`,
          status: "open",
          severity: testCase.risk === "high" ? "high" : testCase.risk === "medium" ? "medium" : "low",
          planId: run.planId,
          sourceRunId: run.id,
          testCaseId: result.testCaseId,
          endpointId: testCase.endpointId,
          summary: result.aiExplanation,
          assignee: testCase.owner || "待分配",
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now
        });
      }
    }

    if (result.status === "passed" && activeDefect) {
      activeDefect.status = "resolved";
      activeDefect.updatedAt = now;
      activeDefect.lastSeenAt = now;
    }
  }

  return next.slice(0, 60);
}

function sanitizeDefects(defects: DefectItem[], testCases: ApiTestCase[], testPlans: TestPlan[]) {
  const caseIds = new Set(testCases.map((testCase) => testCase.id));
  const planIds = new Set(testPlans.map((plan) => plan.id));
  return defects
    .filter((defect) => caseIds.has(defect.testCaseId))
    .map((defect) => ({
      ...defect,
      planId: defect.planId && planIds.has(defect.planId) ? defect.planId : undefined
    }));
}

function persistWorkspace(state: WorkspaceState) {
  getDb()
    .prepare(`
      INSERT INTO workspace (id, project_json, requests_json, last_run_json, updated_at)
      VALUES (1, @project_json, @requests_json, @last_run_json, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        project_json = excluded.project_json,
        requests_json = excluded.requests_json,
        last_run_json = excluded.last_run_json,
        updated_at = excluded.updated_at
    `)
    .run({
      project_json: JSON.stringify(state.project),
      requests_json: JSON.stringify(state.rawRequests),
      last_run_json: JSON.stringify({
        lastRun: state.lastRun,
        runHistory: state.runHistory ?? [],
        capturedElements: state.capturedElements ?? [],
        selectedEndpointIds: state.selectedEndpointIds ?? state.endpoints.map((endpoint) => endpoint.id),
        testPlans: state.testPlans ?? [],
        selectedPlanId: state.selectedPlanId,
        defects: state.defects ?? [],
        testCaseMeta: state.testCases.map((testCase) => ({
          id: testCase.id,
          enabled: testCase.enabled,
          reviewStatus: testCase.reviewStatus,
          owner: testCase.owner,
          notes: testCase.notes,
          lastReviewedAt: testCase.lastReviewedAt
        }))
      }),
      updated_at: state.updatedAt
    });
}

function getDb() {
  if (!db) {
    throw new Error("Storage has not been initialized.");
  }

  return db;
}

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { discoverEndpoints, generateTestCases } from "./discovery.js";
import { sampleRequests } from "./sampleData.js";
import type { ProjectSettings, RawRequest, TestRunHistoryItem, WorkspaceState } from "./types.js";

const dbPath = resolve(process.cwd(), ".data", "aitestautomate.db");

const defaultProject: ProjectSettings = {
  name: "AITestAutomate",
  description: "面向测试团队的开源 AI 自动化测试平台。",
  baseUrl: "https://demo-shop.local",
  environmentName: "staging",
  authMode: "bearer",
  tokenPlaceholder: "{{TEST_USER_TOKEN}}"
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

  const parsedProject = JSON.parse(row.project_json) as ProjectSettings;
  const parsedRequests = JSON.parse(row.requests_json) as RawRequest[];
  const parsedLastRunPayload = JSON.parse(row.last_run_json) as
    | WorkspaceState["lastRun"]
    | {
        lastRun?: WorkspaceState["lastRun"];
        runHistory?: WorkspaceState["runHistory"];
        capturedElements?: WorkspaceState["capturedElements"];
        selectedEndpointIds?: WorkspaceState["selectedEndpointIds"];
      };

  const hydrated = hydrateState({
    project: parsedProject,
    rawRequests: parsedRequests,
    endpoints: [],
    selectedEndpointIds: Array.isArray(parsedLastRunPayload) ? [] : parsedLastRunPayload.selectedEndpointIds ?? [],
    testCases: [],
    lastRun: Array.isArray(parsedLastRunPayload) ? parsedLastRunPayload : parsedLastRunPayload.lastRun ?? [],
    runHistory: Array.isArray(parsedLastRunPayload) ? [] : parsedLastRunPayload.runHistory ?? [],
    capturedElements: Array.isArray(parsedLastRunPayload) ? [] : parsedLastRunPayload.capturedElements ?? [],
    updatedAt: row.updated_at
  });

  return hydrated;
}

export async function saveState(state: WorkspaceState) {
  persistWorkspace(state);
}

export function createWorkspace(rawRequests: RawRequest[], project: ProjectSettings): WorkspaceState {
  const endpoints = discoverEndpoints(rawRequests, project.baseUrl);
  const selectedEndpointIds = endpoints.map((endpoint) => endpoint.id);
  const testCases = generateTestCases(endpoints, project);

  return {
    project,
    rawRequests,
    endpoints,
    selectedEndpointIds,
    testCases,
    lastRun: [],
    runHistory: [],
    capturedElements: [],
    updatedAt: new Date().toISOString()
  };
}

export function replaceWorkspace(current: WorkspaceState, rawRequests: RawRequest[]) {
  return {
    ...createWorkspace(rawRequests, current.project),
    runHistory: current.runHistory ?? []
  };
}

export function updateProject(current: WorkspaceState, project: ProjectSettings) {
  const next = rebuildWorkspace(current, current.selectedEndpointIds ?? current.endpoints.map((endpoint) => endpoint.id), project);

  return {
    ...next,
    lastRun: current.lastRun,
    runHistory: current.runHistory ?? [],
    capturedElements: current.capturedElements ?? []
  };
}

export function updateSelectedEndpoints(current: WorkspaceState, selectedEndpointIds: string[]) {
  return rebuildWorkspace(current, selectedEndpointIds, current.project);
}

export function appendRunHistory(current: WorkspaceState, run: TestRunHistoryItem): WorkspaceState {
  return {
    ...current,
    lastRun: run.results,
    runHistory: [run, ...(current.runHistory ?? [])].slice(0, 30),
    updatedAt: run.finishedAt
  };
}

function hydrateState(parsed: WorkspaceState): WorkspaceState {
  const project = {
    ...defaultProject,
    ...parsed.project
  };

  if (project.name === "Demo Shop Regression Lab" || project.name === "AI测试平台" || project.name === "TestClaw") {
    project.name = "AITestAutomate";
  }

  if (project.description === "Community edition workspace for API discovery and regression testing.") {
    project.description = "面向测试团队的开源 AI 自动化测试平台。";
  }

  return {
    ...rebuildWorkspace(
      {
        ...parsed,
        project,
        rawRequests: parsed.rawRequests ?? sampleRequests,
        endpoints: [],
        selectedEndpointIds: parsed.selectedEndpointIds ?? [],
        testCases: [],
        lastRun: parsed.lastRun ?? [],
        runHistory: parsed.runHistory ?? []
      },
      parsed.selectedEndpointIds ?? [],
      project
    ),
    lastRun: parsed.lastRun ?? [],
    runHistory: parsed.runHistory ?? [],
    capturedElements: parsed.capturedElements ?? [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString()
  };
}

function rebuildWorkspace(current: WorkspaceState, selectedEndpointIds: string[], project: ProjectSettings): WorkspaceState {
  const endpoints = discoverEndpoints(current.rawRequests ?? sampleRequests, project.baseUrl);
  const selected = selectedEndpointIds.length > 0 ? selectedEndpointIds.filter((id) => endpoints.some((endpoint) => endpoint.id === id)) : endpoints.map((endpoint) => endpoint.id);
  const testCases = generateTestCases(
    endpoints.filter((endpoint) => selected.includes(endpoint.id)),
    project
  );

  return {
    ...current,
    project,
    endpoints,
    selectedEndpointIds: selected,
    testCases,
    updatedAt: new Date().toISOString()
  };
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
        selectedEndpointIds: state.selectedEndpointIds ?? state.endpoints.map((endpoint) => endpoint.id)
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

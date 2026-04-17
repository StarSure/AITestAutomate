import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { discoverEndpoints, generateTestCases } from "./discovery.js";
import { sampleRequests } from "./sampleData.js";
import type { ProjectSettings, RawRequest, WorkspaceState } from "./types.js";

const dbPath = resolve(process.cwd(), ".data", "testclaw.db");

const defaultProject: ProjectSettings = {
  name: "TestClaw",
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
  const parsedLastRun = JSON.parse(row.last_run_json) as WorkspaceState["lastRun"];

  const hydrated = hydrateState({
    project: parsedProject,
    rawRequests: parsedRequests,
    endpoints: [],
    testCases: [],
    lastRun: parsedLastRun,
    updatedAt: row.updated_at
  });

  return hydrated;
}

export async function saveState(state: WorkspaceState) {
  persistWorkspace(state);
}

export function createWorkspace(rawRequests: RawRequest[], project: ProjectSettings): WorkspaceState {
  const endpoints = discoverEndpoints(rawRequests, project.baseUrl);
  const testCases = generateTestCases(endpoints, project);

  return {
    project,
    rawRequests,
    endpoints,
    testCases,
    lastRun: [],
    updatedAt: new Date().toISOString()
  };
}

export function replaceWorkspace(current: WorkspaceState, rawRequests: RawRequest[]) {
  return createWorkspace(rawRequests, current.project);
}

export function updateProject(current: WorkspaceState, project: ProjectSettings) {
  return {
    ...createWorkspace(current.rawRequests, project),
    lastRun: current.lastRun
  };
}

function hydrateState(parsed: WorkspaceState): WorkspaceState {
  const project = {
    ...defaultProject,
    ...parsed.project
  };

  if (project.name === "Demo Shop Regression Lab" || project.name === "AI测试平台") {
    project.name = "TestClaw";
  }

  if (project.description === "Community edition workspace for API discovery and regression testing.") {
    project.description = "面向测试团队的开源 AI 自动化测试平台。";
  }

  return {
    ...createWorkspace(parsed.rawRequests ?? sampleRequests, project),
    lastRun: parsed.lastRun ?? [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString()
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
      last_run_json: JSON.stringify(state.lastRun),
      updated_at: state.updatedAt
    });
}

function getDb() {
  if (!db) {
    throw new Error("Storage has not been initialized.");
  }

  return db;
}

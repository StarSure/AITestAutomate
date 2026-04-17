import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { discoverEndpoints, generateTestCases } from "./discovery.js";
import { sampleRequests } from "./sampleData.js";
import type { ProjectSettings, RawRequest, WorkspaceState } from "./types.js";

const storagePath = resolve(process.cwd(), ".data", "workspace.json");

const defaultProject: ProjectSettings = {
  name: "AI测试平台",
  description: "面向测试团队的开源 AI 自动化测试平台。",
  baseUrl: "https://demo-shop.local",
  environmentName: "staging",
  authMode: "bearer",
  tokenPlaceholder: "{{TEST_USER_TOKEN}}"
};

export async function loadState(): Promise<WorkspaceState> {
  try {
    const content = await readFile(storagePath, "utf8");
    const parsed = JSON.parse(content) as WorkspaceState;

    return hydrateState(parsed);
  } catch {
    const fresh = createWorkspace(sampleRequests, defaultProject);
    await saveState(fresh);
    return fresh;
  }
}

export async function saveState(state: WorkspaceState) {
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(state, null, 2), "utf8");
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

  if (project.name === "Demo Shop Regression Lab") {
    project.name = "AI测试平台";
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

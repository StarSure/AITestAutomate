import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { z } from "zod";
import { capturePageSession } from "./browserCapture.js";
import { parseHar, runTestCases } from "./discovery.js";
import { parseCurl, parseOpenApi, parsePostmanCollection } from "./importers.js";
import {
  appendRunHistory,
  createWorkspace,
  initStorage,
  loadState,
  replaceWorkspace,
  saveState,
  selectPlan,
  updateDefectStatus,
  updateProject,
  updateSelectedEndpoints,
  updateTestCase,
  upsertTestPlan
} from "./storage.js";
import type { ApiTestCase, DefectItem, ProjectSettings, RawRequest, TestPlan, TestRunHistoryItem, WorkspaceState } from "./types.js";

const app = Fastify({
  logger: true
});

await initStorage();
let state: WorkspaceState = await loadState();

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

const captureTasks = new Map<string, CaptureTask>();

await app.register(cors, {
  origin: true
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const webDistPath = resolve(repoRoot, "apps/web/dist");
if (existsSync(webDistPath)) {
  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/"
  });
}

app.get("/health", async () => ({
  ok: true,
  service: "aitestautomate-api"
}));

app.get("/api/workspace", async () => serializeState(state));

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  baseUrl: z.string().url(),
  environmentName: z.string().min(1),
  authMode: z.enum(["none", "bearer", "cookie", "apiKey"]),
  tokenPlaceholder: z.string().default(""),
  owner: z.string().min(1),
  notificationChannel: z.string().min(1)
});

app.post("/api/project", async (request, reply) => {
  const parsed = projectSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      ok: false,
      error: parsed.error.flatten()
    });
  }

  state = updateProject(state, parsed.data as ProjectSettings);
  state.updatedAt = new Date().toISOString();
  await saveState(state);

  return {
    ok: true,
    workspace: serializeState(state)
  };
});

app.post("/api/sample/reset", async () => {
  state = createWorkspace(state.rawRequests, state.project);
  state.updatedAt = new Date().toISOString();
  await saveState(state);

  return {
    ok: true,
    message: "Workspace rebuilt from current requests and project settings.",
    workspace: serializeState(state)
  };
});

const endpointSelectionSchema = z.object({
  endpointIds: z.array(z.string())
});

app.post("/api/endpoints/selection", async (request, reply) => {
  const result = endpointSelectionSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  state = updateSelectedEndpoints(state, result.data.endpointIds);
  state.updatedAt = new Date().toISOString();
  await saveState(state);

  return {
    ok: true,
    selectedEndpointIds: state.selectedEndpointIds,
    generatedTestCases: state.testCases.length,
    workspace: serializeState(state)
  };
});

const testCaseUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  reviewStatus: z.enum(["draft", "ready", "blocked"]).optional(),
  owner: z.string().optional(),
  notes: z.string().optional()
});

app.post("/api/testcases/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = testCaseUpdateSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  if (!state.testCases.some((testCase) => testCase.id === id)) {
    return reply.status(404).send({ ok: false, error: "Test case not found." });
  }

  state = updateTestCase(state, id, result.data);
  await saveState(state);

  return {
    ok: true,
    workspace: serializeState(state)
  };
});

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  environmentName: z.string().min(1),
  owner: z.string().min(1),
  triggerMode: z.enum(["manual", "scheduled", "ci"]),
  cadence: z.string().min(1),
  status: z.enum(["active", "draft"]),
  caseIds: z.array(z.string()).min(1)
});

app.post("/api/plans", async (request, reply) => {
  const result = planSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  state = upsertTestPlan(state, result.data);
  await saveState(state);

  return {
    ok: true,
    workspace: serializeState(state)
  };
});

app.post("/api/plans/:id/select", async (request, reply) => {
  const { id } = request.params as { id: string };

  if (!state.testPlans.some((plan) => plan.id === id)) {
    return reply.status(404).send({ ok: false, error: "Plan not found." });
  }

  state = selectPlan(state, id);
  await saveState(state);

  return {
    ok: true,
    workspace: serializeState(state)
  };
});

app.post("/api/plans/:id/run", async (request, reply) => {
  const { id } = request.params as { id: string };
  const plan = state.testPlans.find((item) => item.id === id);

  if (!plan) {
    return reply.status(404).send({ ok: false, error: "Plan not found." });
  }

  const runnableCases = getRunnableCases(state.testCases, plan);
  if (runnableCases.length === 0) {
    return reply.status(400).send({ ok: false, error: "This plan has no ready test cases to run." });
  }

  const run = await executePlan(plan, runnableCases);
  state = selectPlan(state, plan.id);
  state = appendRunHistory(state, run);
  await saveState(state);

  return {
    ok: true,
    run,
    summary: run.summary,
    workspace: serializeState(state)
  };
});

app.post("/api/tests/run", async (_request, reply) => {
  const plan = state.testPlans.find((item) => item.id === state.selectedPlanId) ?? state.testPlans[0];

  if (!plan) {
    return reply.status(400).send({ ok: false, error: "No execution plan available." });
  }

  const runnableCases = getRunnableCases(state.testCases, plan);
  if (runnableCases.length === 0) {
    return reply.status(400).send({ ok: false, error: "The selected plan has no ready test cases to run." });
  }

  const run = await executePlan(plan, runnableCases);
  state = appendRunHistory(selectPlan(state, plan.id), run);
  await saveState(state);

  return {
    ok: true,
    run,
    summary: run.summary,
    workspace: serializeState(state)
  };
});

const defectStatusSchema = z.object({
  status: z.enum(["open", "triaged", "resolved"])
});

app.post("/api/defects/:id/status", async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = defectStatusSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  if (!state.defects.some((defect) => defect.id === id)) {
    return reply.status(404).send({ ok: false, error: "Defect not found." });
  }

  state = updateDefectStatus(state, id, result.data.status);
  await saveState(state);

  return {
    ok: true,
    workspace: serializeState(state)
  };
});

app.post("/api/discover/har", async (request, reply) => {
  try {
    const parsed = parseHar(request.body);
    state = replaceWorkspace(state, parsed);
    state.updatedAt = new Date().toISOString();
    await saveState(state);

    return {
      ok: true,
      importedRequests: parsed.length,
      workspace: serializeState(state)
    };
  } catch (error) {
    return reply.status(400).send({
      ok: false,
      error: String(error)
    });
  }
});

const textImportSchema = z.object({
  content: z.string().min(1)
});

app.post("/api/import/openapi", async (request, reply) => {
  const result = textImportSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  try {
    const requests = parseOpenApi(result.data.content);
    state = replaceWorkspace(state, requests);
    state.updatedAt = new Date().toISOString();
    await saveState(state);

    return { ok: true, importedRequests: requests.length, workspace: serializeState(state) };
  } catch (error) {
    return reply.status(400).send({ ok: false, error: String(error) });
  }
});

app.post("/api/import/postman", async (request, reply) => {
  const result = textImportSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  try {
    const requests = parsePostmanCollection(result.data.content);
    state = replaceWorkspace(state, requests);
    state.updatedAt = new Date().toISOString();
    await saveState(state);

    return { ok: true, importedRequests: requests.length, workspace: serializeState(state) };
  } catch (error) {
    return reply.status(400).send({ ok: false, error: String(error) });
  }
});

app.post("/api/import/curl", async (request, reply) => {
  const result = textImportSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  try {
    const requests = parseCurl(result.data.content);
    state = replaceWorkspace(state, requests);
    state.updatedAt = new Date().toISOString();
    await saveState(state);

    return { ok: true, importedRequests: requests.length, workspace: serializeState(state) };
  } catch (error) {
    return reply.status(400).send({ ok: false, error: String(error) });
  }
});

const manualSchema = z.object({
  requests: z.array(
    z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]),
      url: z.string().url(),
      status: z.number().optional(),
      requestHeaders: z.record(z.string()).default({}),
      responseHeaders: z.record(z.string()).default({}),
      requestBody: z.unknown().optional(),
      responseBody: z.unknown().optional(),
      durationMs: z.number().optional()
    })
  )
});

app.post("/api/discover/manual", async (request, reply) => {
  const result = manualSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      ok: false,
      error: result.error.flatten()
    });
  }

  const requests: RawRequest[] = result.data.requests.map((item, index) => ({
    id: `manual-${index + 1}`,
    method: item.method,
    url: item.url,
    status: item.status,
    requestHeaders: item.requestHeaders,
    responseHeaders: item.responseHeaders,
    requestBody: item.requestBody,
    responseBody: item.responseBody,
    durationMs: item.durationMs,
    source: "manual"
  }));

  state = replaceWorkspace(state, requests);
  state.updatedAt = new Date().toISOString();
  await saveState(state);

  return {
    ok: true,
    importedRequests: requests.length,
    workspace: serializeState(state)
  };
});

const webCaptureSchema = z.object({
  url: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional()
});

app.post("/api/capture/web", async (request, reply) => {
  const result = webCaptureSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({ ok: false, error: result.error.flatten() });
  }

  const task = createCaptureTask(result.data.url);
  captureTasks.set(task.id, task);
  void runCaptureTask(task.id, result.data);

  return {
    ok: true,
    task
  };
});

app.get("/api/capture/tasks/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const task = captureTasks.get(id);

  if (!task) {
    return reply.status(404).send({ ok: false, error: "Capture task not found." });
  }

  return {
    ok: true,
    task,
    workspace: task.status === "completed" ? serializeState(state) : undefined
  };
});

async function runCaptureTask(taskId: string, input: z.infer<typeof webCaptureSchema>) {
  const task = captureTasks.get(taskId);
  if (!task) {
    return;
  }

  captureTasks.set(taskId, {
    ...task,
    status: "running",
    message: "正在打开页面并监听网络请求..."
  });

  try {
    const session = await capturePageSession(input);
    state = replaceWorkspace(state, session.requests);
    state.capturedElements = session.elements;
    state.project = {
      ...state.project,
      baseUrl: new URL(input.url).origin
    };
    state.updatedAt = new Date().toISOString();
    await saveState(state);

    captureTasks.set(taskId, {
      ...captureTasks.get(taskId)!,
      status: "completed",
      message: "抓取完成，已生成接口资产和页面元素。",
      finishedAt: new Date().toISOString(),
      finalUrl: session.finalUrl,
      title: session.title,
      loginAttempted: session.loginAttempted,
      importedRequests: session.requests.length,
      capturedElements: session.elements.length
    });
  } catch (error) {
    captureTasks.set(taskId, {
      ...captureTasks.get(taskId)!,
      status: "failed",
      message: "抓取失败，请检查目标地址、网络或登录信息。",
      finishedAt: new Date().toISOString(),
      error: String(error)
    });
  }
}

function createCaptureTask(url: string): CaptureTask {
  return {
    id: `capture_${nanoid(8)}`,
    status: "queued",
    message: "抓取任务已创建，等待浏览器启动。",
    url,
    startedAt: new Date().toISOString()
  };
}

async function executePlan(plan: TestPlan, runnableCases: ApiTestCase[]) {
  const startedAt = new Date().toISOString();
  const results = await runTestCases(runnableCases);
  const finishedAt = new Date().toISOString();
  const run: TestRunHistoryItem = {
    id: `run_${nanoid(8)}`,
    planId: plan.id,
    planName: plan.name,
    startedAt,
    finishedAt,
    summary: summarizeRun(results),
    results
  };

  return run;
}

function getRunnableCases(testCases: ApiTestCase[], plan: TestPlan) {
  const caseSet = new Set(plan.caseIds);
  return testCases.filter((testCase) => caseSet.has(testCase.id) && testCase.enabled && testCase.reviewStatus === "ready");
}

app.get("/", async (_request, reply) => {
  if (existsSync(resolve(webDistPath, "index.html"))) {
    return reply.sendFile("index.html");
  }

  return {
    ok: true,
    message: "AITestAutomate API is running. Build the web app to serve the frontend from this service."
  };
});

function serializeState(current: WorkspaceState) {
  const selectedPlan = current.testPlans.find((plan) => plan.id === current.selectedPlanId) ?? current.testPlans[0] ?? null;
  const readyCases = current.testCases.filter((testCase) => testCase.reviewStatus === "ready" && testCase.enabled).length;
  const openDefects = current.defects.filter((defect) => defect.status !== "resolved").length;

  return {
    project: current.project,
    summary: {
      requests: current.rawRequests.length,
      endpoints: current.endpoints.length,
      testCases: current.testCases.length,
      readyCases,
      plans: current.testPlans.length,
      openDefects,
      lastRun: current.lastRun.length,
      updatedAt: current.updatedAt
    },
    workflow: {
      projectReady: Boolean(current.project.name && current.project.baseUrl),
      assetsReady: current.endpoints.length > 0,
      casesReady: readyCases > 0,
      planReady: Boolean(selectedPlan && selectedPlan.caseIds.length > 0),
      defectsOpen: openDefects
    },
    endpoints: current.endpoints,
    selectedEndpointIds: current.selectedEndpointIds ?? current.endpoints.map((endpoint) => endpoint.id),
    testCases: current.testCases,
    testPlans: current.testPlans,
    selectedPlanId: current.selectedPlanId,
    currentPlan: selectedPlan,
    lastRun: current.lastRun,
    runHistory: current.runHistory ?? [],
    defects: current.defects ?? [],
    capturedElements: current.capturedElements ?? []
  };
}

function summarizeRun(results: TestRunHistoryItem["results"]) {
  return {
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    total: results.length
  };
}

const port = Number(process.env.PORT ?? 4318);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });

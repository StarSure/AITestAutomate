import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { capturePageSession } from "./browserCapture.js";
import { parseHar, runTestCases } from "./discovery.js";
import { parseCurl, parseOpenApi, parsePostmanCollection } from "./importers.js";
import { nanoid } from "nanoid";
import { appendRunHistory, createWorkspace, initStorage, loadState, replaceWorkspace, saveState, updateProject, updateSelectedEndpoints } from "./storage.js";
import type { ProjectSettings, RawRequest, TestRunHistoryItem, WorkspaceState } from "./types.js";

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

const webDistPath = resolve(process.cwd(), "apps/web/dist");
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
  tokenPlaceholder: z.string().default("")
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
  state = await loadState();
  state = createWorkspace(state.rawRequests, state.project);
  state.lastRun = [];
  state.updatedAt = new Date().toISOString();
  await saveState(state);

  return {
    ok: true,
    message: "Workspace rebuilt from saved or sample data.",
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

app.post("/api/tests/run", async () => {
  const startedAt = new Date().toISOString();
  const results = await runTestCases(state.testCases);
  const finishedAt = new Date().toISOString();
  const run: TestRunHistoryItem = {
    id: `run_${nanoid(8)}`,
    startedAt,
    finishedAt,
    summary: summarizeRun(results),
    results
  };

  state = appendRunHistory(state, run);
  await saveState(state);

  return {
    ok: true,
    run,
    results,
    summary: run.summary,
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
  return {
    project: current.project,
    summary: {
      requests: current.rawRequests.length,
      endpoints: current.endpoints.length,
      testCases: current.testCases.length,
      lastRun: current.lastRun.length,
      updatedAt: current.updatedAt
    },
    endpoints: current.endpoints,
    selectedEndpointIds: current.selectedEndpointIds ?? current.endpoints.map((endpoint) => endpoint.id),
    testCases: current.testCases,
    lastRun: current.lastRun,
    runHistory: current.runHistory ?? [],
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

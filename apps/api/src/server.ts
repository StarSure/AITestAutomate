import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { parseHar, runTestCases } from "./discovery.js";
import { createWorkspace, loadState, replaceWorkspace, saveState, updateProject } from "./storage.js";
import type { ProjectSettings, RawRequest, WorkspaceState } from "./types.js";

const app = Fastify({
  logger: true
});

let state: WorkspaceState = await loadState();

await app.register(cors, {
  origin: true
});

app.get("/health", async () => ({
  ok: true,
  service: "open-regression-copilot-api"
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
  state.lastRun = await runTestCases(state.testCases);
  state.updatedAt = new Date().toISOString();
  await saveState(state);

  return {
    ok: true,
    results: state.lastRun,
    summary: {
      passed: state.lastRun.filter((result) => result.status === "passed").length,
      failed: state.lastRun.filter((result) => result.status === "failed").length,
      skipped: state.lastRun.filter((result) => result.status === "skipped").length
    },
    workspace: serializeState(state)
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
    testCases: current.testCases,
    lastRun: current.lastRun
  };
}

const port = Number(process.env.PORT ?? 4318);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });

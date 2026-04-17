import { nanoid } from "nanoid";
import type { ApiEndpoint, ApiTestCase, HttpMethod, ProjectSettings, RawRequest, SchemaShape, TestRunResult } from "./types.js";

const staticExtensions = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".map"
];

export function parseHar(input: unknown): RawRequest[] {
  const har = input as {
    log?: {
      entries?: Array<{
        request?: {
          method?: string;
          url?: string;
          headers?: Array<{ name: string; value: string }>;
          postData?: { text?: string; mimeType?: string };
        };
        response?: {
          status?: number;
          headers?: Array<{ name: string; value: string }>;
          content?: { text?: string; mimeType?: string };
        };
        time?: number;
      }>;
    };
  };

  return (har.log?.entries ?? [])
    .map((entry): RawRequest | null => {
      const method = normalizeMethod(entry.request?.method);
      const url = entry.request?.url;

      if (!method || !url || shouldIgnoreUrl(url)) {
        return null;
      }

      return {
        id: nanoid(),
        method,
        url,
        status: entry.response?.status,
        requestHeaders: headersToRecord(entry.request?.headers),
        responseHeaders: headersToRecord(entry.response?.headers),
        requestBody: parseBody(entry.request?.postData?.text),
        responseBody: parseBody(entry.response?.content?.text),
        durationMs: Math.round(entry.time ?? 0),
        source: "har"
      };
    })
    .filter((request): request is RawRequest => Boolean(request));
}

export function discoverEndpoints(requests: RawRequest[], preferredBaseUrl?: string): ApiEndpoint[] {
  const groups = new Map<string, RawRequest[]>();

  for (const request of requests) {
    if (shouldIgnoreUrl(request.url)) {
      continue;
    }

    const parsed = safeUrl(request.url);
    if (!parsed) {
      continue;
    }

    const normalizedPath = normalizePath(parsed.pathname);
    const key = `${request.method} ${parsed.origin}${normalizedPath}`;
    const current = groups.get(key) ?? [];
    current.push(request);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, examples]) => {
    const [method, baseAndPath] = key.split(" ");
    const parsed = safeUrl(baseAndPath);
    const first = examples[0];
    const path = parsed ? parsed.pathname : baseAndPath;

    return {
      id: endpointId(method as HttpMethod, path),
      method: method as HttpMethod,
      path,
      displayName: guessDisplayName(method as HttpMethod, path),
      baseUrl: preferredBaseUrl || parsed?.origin || safeUrl(first.url)?.origin || "",
      risk: riskForEndpoint(method as HttpMethod, path),
      authRequired: examples.some((example) => hasAuth(example.requestHeaders)),
      observedCount: examples.length,
      statuses: uniqueNumbers(examples.map((example) => example.status).filter(isNumber)),
      queryParams: mergeQueryParams(examples),
      requestSchema: inferSchema(first.requestBody),
      responseSchema: inferSchema(first.responseBody),
      examples,
      businessGuess: guessBusinessMeaning(method as HttpMethod, path)
    };
  });
}

export function generateTestCases(endpoints: ApiEndpoint[], project?: ProjectSettings): ApiTestCase[] {
  return endpoints.flatMap((endpoint) => {
    const example = endpoint.examples[0];
    const effectiveBase = project?.baseUrl || endpoint.baseUrl;
    const url = `${effectiveBase}${endpoint.path}`;
    const expectedStatus = endpoint.statuses[0] ?? expectedStatusFor(endpoint.method);
    const cases: ApiTestCase[] = [
      {
        id: `tc_${endpoint.id}_happy`,
        endpointId: endpoint.id,
        name: `${endpoint.displayName} - happy path`,
        type: "happy_path",
        method: endpoint.method,
        url,
        headers: applyProjectAuth(sanitizeHeaders(example.requestHeaders), project),
        body: example.requestBody,
        assertions: [
          { type: "status", expected: expectedStatus },
          { type: "response_time_less_than", expected: 2000 },
          { type: "schema_shape", expected: endpoint.responseSchema }
        ],
        risk: endpoint.risk,
        enabled: endpoint.risk !== "high"
      }
    ];

    if (endpoint.authRequired) {
      cases.push({
        id: `tc_${endpoint.id}_unauthorized`,
        endpointId: endpoint.id,
        name: `${endpoint.displayName} - unauthorized request`,
        type: "unauthorized",
        method: endpoint.method,
        url,
        headers: removeAuthHeaders(applyProjectAuth(sanitizeHeaders(example.requestHeaders), project)),
        body: example.requestBody,
        assertions: [{ type: "status", expected: [401, 403] }],
        risk: "low",
        enabled: true
      });
    }

    return cases;
  });
}

function applyProjectAuth(headers: Record<string, string>, project?: ProjectSettings) {
  if (!project || project.authMode === "none") {
    return headers;
  }

  const next = { ...headers };
  if (project.authMode === "bearer") {
    next.authorization = `Bearer ${project.tokenPlaceholder}`;
  }
  if (project.authMode === "cookie") {
    next.cookie = `session=${project.tokenPlaceholder}`;
  }
  if (project.authMode === "apiKey") {
    next["x-api-key"] = project.tokenPlaceholder;
  }
  return next;
}

export async function runTestCases(testCases: ApiTestCase[]): Promise<TestRunResult[]> {
  const results: TestRunResult[] = [];

  for (const testCase of testCases) {
    const startedAt = performance.now();

    if (!testCase.enabled || testCase.risk === "high") {
      results.push({
        id: nanoid(),
        testCaseId: testCase.id,
        name: testCase.name,
        status: "skipped",
        durationMs: 0,
        request: {
          method: testCase.method,
          url: testCase.url,
          headers: testCase.headers,
          body: testCase.body
        },
        failureCategory: "skipped_risky",
        aiExplanation: "This test was skipped because the endpoint may perform a risky business action. Review it before enabling execution."
      });
      continue;
    }

    const parsed = safeUrl(testCase.url);
    if (parsed?.hostname.endsWith(".local")) {
      results.push(mockLocalResult(testCase));
      continue;
    }

    try {
      const response = await fetch(testCase.url, {
        method: testCase.method,
        headers: testCase.headers,
        body: shouldSendBody(testCase.method, testCase.body) ? JSON.stringify(testCase.body) : undefined,
        signal: AbortSignal.timeout(8000)
      });
      const bodyText = await response.text();
      const durationMs = Math.round(performance.now() - startedAt);
      const assertion = evaluateAssertions(testCase, response.status, bodyText, durationMs);

      results.push({
        id: nanoid(),
        testCaseId: testCase.id,
        name: testCase.name,
        status: assertion.passed ? "passed" : "failed",
        durationMs,
        request: {
          method: testCase.method,
          url: testCase.url,
          headers: testCase.headers,
          body: testCase.body
        },
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          bodyPreview: bodyText.slice(0, 1000)
        },
        failureCategory: assertion.passed ? undefined : "assertion_failed",
        aiExplanation: assertion.explanation
      });
    } catch (error) {
      results.push({
        id: nanoid(),
        testCaseId: testCase.id,
        name: testCase.name,
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        request: {
          method: testCase.method,
          url: testCase.url,
          headers: testCase.headers,
          body: testCase.body
        },
        failureCategory: "network_error",
        aiExplanation: `The request could not be completed. This usually means the environment is unreachable, the base URL is incorrect, or the server blocked the request. Raw error: ${String(error)}`
      });
    }
  }

  return results;
}

function mockLocalResult(testCase: ApiTestCase): TestRunResult {
  const failed = testCase.type === "unauthorized";

  return {
    id: nanoid(),
    testCaseId: testCase.id,
    name: testCase.name,
    status: failed ? "failed" : "passed",
    durationMs: Math.floor(80 + Math.random() * 200),
    request: {
      method: testCase.method,
      url: testCase.url,
      headers: testCase.headers,
      body: testCase.body
    },
    response: {
      status: failed ? 200 : testCase.method === "POST" ? 201 : 200,
      headers: {
        "content-type": "application/json"
      },
      bodyPreview: failed ? "{\"message\":\"unexpected authorized response\"}" : "{\"ok\":true,\"source\":\"demo\"}"
    },
    failureCategory: failed ? "auth_issue" : undefined,
    aiExplanation: failed
      ? "The unauthorized check expected 401 or 403, but the demo response looked successful. In a real system this would indicate an authentication or permission boundary issue."
      : "The API response matched the generated assertions. This looks healthy for the current regression run."
  };
}

function evaluateAssertions(testCase: ApiTestCase, status: number, bodyText: string, durationMs: number) {
  for (const assertion of testCase.assertions) {
    if (assertion.type === "status") {
      const expected = Array.isArray(assertion.expected) ? assertion.expected : [assertion.expected];
      if (!expected.includes(status)) {
        return {
          passed: false,
          explanation: `The API returned status ${status}, but the test expected ${expected.join(" or ")}. This may be an API contract change, auth issue, environment issue, or generated assertion mismatch.`
        };
      }
    }

    if (assertion.type === "response_time_less_than" && durationMs > Number(assertion.expected)) {
      return {
        passed: false,
        explanation: `The API response time was ${durationMs}ms, slower than the expected ${assertion.expected}ms threshold. This is a regression risk if the environment is stable.`
      };
    }

    if (assertion.type === "schema_shape") {
      const parsed = parseBody(bodyText);
      const shape = inferSchema(parsed);
      const expected = assertion.expected as SchemaShape;
      const expectedFields = Object.keys(expected.fields ?? {});
      const actualFields = Object.keys(shape.fields ?? {});
      const missing = expectedFields.filter((field) => !actualFields.includes(field));

      if (missing.length > 0) {
        return {
          passed: false,
          explanation: `The response is missing expected fields: ${missing.join(", ")}. This looks like an API contract change.`
        };
      }
    }
  }

  return {
    passed: true,
    explanation: "The API response matched the generated assertions. This looks healthy for the current regression run."
  };
}

function normalizeMethod(method?: string): HttpMethod | null {
  const upper = method?.toUpperCase();
  const allowed = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  return allowed.includes(upper ?? "") ? (upper as HttpMethod) : null;
}

function headersToRecord(headers?: Array<{ name: string; value: string }>) {
  return Object.fromEntries((headers ?? []).map((header) => [header.name.toLowerCase(), header.value]));
}

function parseBody(text?: string): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

function shouldIgnoreUrl(url: string) {
  const parsed = safeUrl(url);
  if (!parsed) {
    return true;
  }

  const path = parsed.pathname.toLowerCase();
  return staticExtensions.some((extension) => path.endsWith(extension)) || parsed.hostname.includes("google-analytics");
}

function safeUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function normalizePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => {
      if (/^\d+$/.test(segment)) {
        return "{id}";
      }
      if (/^[a-f0-9]{12,}$/i.test(segment)) {
        return "{id}";
      }
      if (/^[a-z]+_[a-z0-9]+$/i.test(segment)) {
        return "{id}";
      }
      return segment;
    })
    .join("/");
}

function endpointId(method: string, path: string) {
  return `${method.toLowerCase()}_${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}`;
}

function guessDisplayName(method: HttpMethod, path: string) {
  const clean = path.replace(/^\/api\/?/, "").replace(/[{}]/g, "");
  const words = clean.split("/").filter(Boolean).join(" ");
  const action = method === "GET" ? "Read" : method === "POST" ? "Create" : method === "DELETE" ? "Delete" : "Update";
  return `${action} ${words || "API"}`;
}

function guessBusinessMeaning(method: HttpMethod, path: string) {
  const lower = path.toLowerCase();
  if (lower.includes("login") || lower.includes("auth")) {
    return "Authentication or session management API.";
  }
  if (lower.includes("order")) {
    return "Order workflow API, likely important for regression testing.";
  }
  if (lower.includes("cart")) {
    return "Shopping cart workflow API.";
  }
  if (lower.includes("user") || lower.includes("me")) {
    return "User profile or account API.";
  }
  if (lower.includes("product")) {
    return "Product catalog or search API.";
  }
  return `${method} business API discovered from browser traffic.`;
}

function riskForEndpoint(method: HttpMethod, path: string): "low" | "medium" | "high" {
  const lower = path.toLowerCase();
  if (method === "DELETE") {
    return "high";
  }
  if (/(payment|refund|transfer|approve|permission|delete)/.test(lower)) {
    return "high";
  }
  if (["POST", "PUT", "PATCH"].includes(method)) {
    return "medium";
  }
  return "low";
}

function hasAuth(headers: Record<string, string>) {
  return Object.keys(headers).some((key) => ["authorization", "cookie", "x-api-key"].includes(key.toLowerCase()));
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mergeQueryParams(examples: RawRequest[]) {
  const params: Record<string, string> = {};
  for (const example of examples) {
    const parsed = safeUrl(example.url);
    parsed?.searchParams.forEach((value, key) => {
      params[key] = inferScalarType(value);
    });
  }
  return params;
}

function inferSchema(value: unknown): SchemaShape {
  if (Array.isArray(value)) {
    return {
      type: "array",
      sample: value.slice(0, 1)
    };
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      type: "object",
      fields: Object.fromEntries(entries.map(([key, fieldValue]) => [key, inferScalarType(fieldValue)])),
      sample: value
    };
  }

  if (value === undefined) {
    return {
      type: "unknown"
    };
  }

  return {
    type: inferScalarType(value),
    sample: value
  };
}

function inferScalarType(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return "number-like string";
  }
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "array" : typeof value;
}

function expectedStatusFor(method: HttpMethod) {
  if (method === "POST") {
    return 201;
  }
  if (method === "DELETE") {
    return 204;
  }
  return 200;
}

function sanitizeHeaders(headers: Record<string, string>) {
  const allowed = ["authorization", "content-type", "accept", "x-api-key", "cookie"];
  return Object.fromEntries(Object.entries(headers).filter(([key]) => allowed.includes(key.toLowerCase())));
}

function removeAuthHeaders(headers: Record<string, string>) {
  const authKeys = ["authorization", "cookie", "x-api-key"];
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !authKeys.includes(key.toLowerCase())));
}

function shouldSendBody(method: HttpMethod, body: unknown) {
  return body !== undefined && !["GET", "HEAD"].includes(method);
}

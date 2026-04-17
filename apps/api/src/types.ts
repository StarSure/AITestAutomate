export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type RawRequest = {
  id: string;
  method: HttpMethod;
  url: string;
  status?: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  durationMs?: number;
  source: "sample" | "har" | "manual";
};

export type ProjectSettings = {
  name: string;
  description: string;
  baseUrl: string;
  environmentName: string;
  authMode: "none" | "bearer" | "cookie" | "apiKey";
  tokenPlaceholder: string;
};

export type ApiEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  displayName: string;
  baseUrl: string;
  risk: "low" | "medium" | "high";
  authRequired: boolean;
  observedCount: number;
  statuses: number[];
  queryParams: Record<string, string>;
  requestSchema: SchemaShape;
  responseSchema: SchemaShape;
  examples: RawRequest[];
  businessGuess: string;
};

export type SchemaShape = {
  type: string;
  fields?: Record<string, string>;
  sample?: unknown;
};

export type ApiTestCase = {
  id: string;
  endpointId: string;
  name: string;
  type: "happy_path" | "unauthorized" | "schema" | "missing_required";
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  assertions: Array<{
    type: "status" | "body_field_exists" | "response_time_less_than" | "schema_shape";
    expected: unknown;
    path?: string;
  }>;
  risk: "low" | "medium" | "high";
  enabled: boolean;
};

export type TestRunResult = {
  id: string;
  testCaseId: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  request: {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    bodyPreview: string;
  };
  failureCategory?: "api_contract_change" | "network_error" | "auth_issue" | "assertion_failed" | "skipped_risky";
  aiExplanation: string;
};

export type WorkspaceState = {
  project: ProjectSettings;
  rawRequests: RawRequest[];
  endpoints: ApiEndpoint[];
  testCases: ApiTestCase[];
  lastRun: TestRunResult[];
  capturedElements?: Array<{
    id: string;
    tag: string;
    text: string;
    role: string | null;
    name: string | null;
    placeholder: string | null;
    selectorHint: string;
  }>;
  updatedAt: string;
};

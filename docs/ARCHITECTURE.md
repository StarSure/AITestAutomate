# Architecture v0.1

## Architecture Principle

The platform should use AI to assist testing, not to replace deterministic test execution.

Playwright should handle browser automation. The API engine should handle interface testing. AI should help with generation, explanation, classification, and repair suggestions.

## High-Level Components

### Web Console

The Web Console is the user interface for QA teams.

It includes:

- Project setup
- Environment setup
- Flow editor
- Run history
- Artifact viewer
- Failure analysis
- Repair suggestion review

### API Server

The API Server owns the main business logic.

It manages:

- Users
- Projects
- Environments
- Flows
- Runs
- Artifacts
- AI tasks
- Runner jobs

### Runner

The Runner executes tests.

It is responsible for:

- Starting Playwright
- Loading generated tests
- Injecting environment variables
- Recording screenshots, videos, traces, console logs, and network logs
- Capturing API traffic related to a flow
- Uploading artifacts
- Reporting run status

### API Discovery Engine

The API Discovery Engine turns browser network traffic into an API inventory.

It is responsible for:

- Capturing requests and responses during flow execution
- Filtering static assets and noisy third-party requests
- Grouping similar URLs into API endpoints
- Inferring request and response schemas
- Linking APIs back to pages and flows

### API Test Engine

The API Test Engine generates and executes API tests.

It is responsible for:

- Creating API test cases from discovered APIs
- Reusing authentication state where allowed
- Injecting headers, cookies, tokens, and environment variables
- Running status code, schema, and business assertions
- Recording request and response evidence

### Intelligence Layer

The Intelligence Layer handles AI tasks.

It includes:

- Natural language to Flow Spec
- Flow Spec to Playwright test
- Network traffic to API inventory
- API inventory to API test cases
- Failure classification
- Repair suggestion
- Summary generation

### Storage

Metadata storage:

- PostgreSQL

Artifact storage:

- Local filesystem for development
- S3-compatible storage for production
- MinIO for self-hosted community deployment

Queue:

- Redis
- BullMQ or equivalent job queue

## Suggested Monorepo Structure

```text
open-regression-copilot/
  apps/
    web/
    api/
    runner/
  packages/
    flow-spec/
    api-discovery/
    api-test-engine/
    ai/
    playwright-adapter/
    shared/
  docs/
  examples/
  docker/
  scripts/
```

## Main Data Models

### Project

Represents a web application under test.

Fields:

- id
- name
- repositoryUrl
- defaultEnvironmentId
- createdAt
- updatedAt

### Environment

Represents a test target such as staging or preview.

Fields:

- id
- projectId
- name
- baseUrl
- healthCheckUrl
- secretsRef
- createdAt
- updatedAt

### Flow

Represents a business regression scenario.

Fields:

- id
- projectId
- name
- description
- spec
- tags
- owner
- status
- createdAt
- updatedAt

### ApiEndpoint

Represents one discovered API endpoint.

Fields:

- id
- projectId
- environmentId
- method
- path
- name
- authRequired
- requestSchema
- responseSchema
- exampleRequest
- exampleResponse
- sourceFlowId
- lastObservedAt
- createdAt
- updatedAt

### ApiTestCase

Represents one generated API test case.

Fields:

- id
- apiEndpointId
- name
- type
- request
- assertions
- status
- createdAt
- updatedAt

### Run

Represents one execution of one or more flows.

Fields:

- id
- projectId
- environmentId
- status
- triggerSource
- startedAt
- endedAt
- summary

### RunResult

Represents the result of one flow in one run.

Fields:

- id
- runId
- flowId
- status
- durationMs
- errorMessage
- failureCategory
- aiSummary

### Artifact

Represents evidence collected from a run.

Fields:

- id
- runResultId
- type
- storageUrl
- metadata
- createdAt

### RepairSuggestion

Represents an AI-generated suggestion.

Fields:

- id
- runResultId
- type
- summary
- patch
- confidence
- status
- createdAt
- updatedAt

## Execution Flow

1. User creates or selects a Flow.
2. User triggers a run.
3. API Server creates a Run record.
4. API Server sends a job to the queue.
5. Runner picks up the job.
6. Runner generates or loads Playwright test code.
7. Runner executes the UI test and captures network traffic.
8. API Discovery Engine updates the API inventory.
9. API Test Engine executes related API tests when configured.
10. Runner uploads artifacts.
11. Runner reports result to API Server.
12. API Server asks Intelligence Layer to classify failures.
13. Web Console shows run result and AI explanation.

## AI Safety Rules

AI should not:

- Automatically change production code.
- Automatically change test code without user review.
- Hide raw failure evidence.
- Pretend it is certain when confidence is low.
- Execute arbitrary shell commands from model output.
- Treat captured sensitive tokens as plain text training data.

AI should:

- Show confidence level.
- Link explanations to actual evidence.
- Keep raw logs and artifacts available.
- Ask for user confirmation before applying repair suggestions.

## First Technical Recommendation

Start with a simple local-only version:

- One API server
- One web console
- One runner process
- PostgreSQL
- Redis
- Local artifact storage
- OpenAI-compatible LLM config
- Basic API traffic capture
- Basic API inventory

After the demo works, add:

- Docker Compose
- MinIO
- GitHub integration
- Scheduled runs

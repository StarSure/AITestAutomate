# API Testing Strategy v0.1

This document explains how Open Regression Copilot should discover APIs from a web platform and generate automated API tests.

## Product Idea

Many QA teams know the user workflow but do not know every backend API behind the page.

The platform should help them:

1. Open the web application.
2. Perform a business flow such as login, search, checkout, or approval.
3. Capture the network requests behind that flow.
4. Identify real business APIs.
5. Generate API test cases.
6. Run API tests automatically during regression.

## Why API Discovery Matters

UI tests are useful because they simulate the real user experience.

API tests are useful because they are:

- Faster than UI tests
- Less affected by UI layout changes
- Better at checking backend business rules
- Easier to run frequently
- Good at detecting contract changes

The platform should combine both.

The UI flow discovers and validates the user journey. The API tests make regression faster and deeper.

## MVP API Discovery Flow

The first version should work like this:

1. User creates a project with a base URL.
2. User opens the recorder or runs a Playwright flow.
3. Runner captures browser network traffic.
4. Platform filters out static assets and third-party noise.
5. Platform groups similar requests into API endpoints.
6. Platform stores endpoints in the API inventory.
7. AI gives each endpoint a readable name.
8. User reviews the discovered APIs.
9. Platform generates API test cases.
10. Runner executes API tests and shows results.

## API Sources

The platform can discover APIs from:

- Browser network traffic
- Playwright trace
- HAR files
- Manually uploaded curl commands
- Manually uploaded OpenAPI files

For MVP, start with browser network traffic and HAR files.

## What To Capture

For each request:

- Method
- Full URL
- Normalized path
- Query parameters
- Request headers
- Request body
- Status code
- Response headers
- Response body sample
- Duration
- Related page URL
- Related Flow Spec step

## What To Ignore

Ignore by default:

- Images
- CSS
- JavaScript bundles
- Fonts
- Source maps
- Analytics events
- Ads
- Monitoring beacons
- Browser extension calls

Allow users to configure include and exclude rules.

## Endpoint Grouping

The platform should group similar URLs.

Examples:

```text
/api/users/123
/api/users/456
```

Should become:

```text
GET /api/users/{id}
```

Examples:

```text
/api/orders?page=1
/api/orders?page=2
```

Should become:

```text
GET /api/orders
```

With query parameter:

```text
page: number
```

## Generated API Test Types

The first version should generate:

- Happy path test
- Missing required parameter test
- Invalid parameter type test
- Unauthorized test
- Basic response schema test
- Business assertion test when connected to a Flow Spec

Avoid generating too many cases at first. Too many low-value tests will make the platform noisy.

## Example API Test Case

```yaml
id: api-login-happy-path
name: Login API returns token
endpoint: "POST /api/login"
environment: staging
request:
  headers:
    content-type: application/json
  body:
    email: "{{TEST_USER_EMAIL}}"
    password: "{{TEST_USER_PASSWORD}}"
assertions:
  - type: status
    expected: 200
  - type: body_contains
    path: "$.token"
  - type: response_time_less_than
    expected_ms: 1000
```

## Authentication Strategy

API tests often need authentication.

The MVP should support:

- Static token from environment variable
- Cookie captured from a login flow
- Header injection

Do not store raw secrets in plain text.

Secrets should be referenced by name, such as:

```text
{{TEST_USER_TOKEN}}
```

## AI Responsibilities

AI can help with:

- Naming discovered APIs
- Explaining what an API probably does
- Inferring request and response schema
- Suggesting test cases
- Explaining API failures
- Mapping API failures back to business flows

AI should not:

- Invent APIs that were not observed
- Hide raw request and response evidence
- Store sensitive tokens in prompts
- Automatically create destructive API tests without user approval

## Safety Rules

The platform must avoid dangerous generated tests by default.

Dangerous actions include:

- Delete production data
- Send real payments
- Send real emails or SMS
- Modify real user permissions
- Trigger irreversible business operations

The MVP should mark risky endpoints and ask for review before generating tests.

Risky methods:

- DELETE
- PATCH
- PUT
- POST with payment, refund, delete, approve, transfer, or permission keywords

## MVP Boundary

Build first:

- API capture from browser flow
- API inventory
- Basic endpoint grouping
- Happy path API test generation
- Basic negative test generation
- API run result page
- AI explanation for API failure

Do not build first:

- Full OpenAPI editor
- Contract testing platform
- Load testing
- Security testing
- API mocking
- Complex data dependency engine

## First Demo

The first demo should show:

1. User logs in to a sample web app.
2. Platform captures `POST /api/login`.
3. Platform captures `GET /api/me`.
4. Platform generates API test cases.
5. User runs the API tests.
6. One test fails because response schema changed.
7. AI explains the failure as an API contract change.


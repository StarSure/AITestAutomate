# Product Requirements Document v0.1

## Product Name

Open Regression Copilot

## Product Type

Open-source AI regression and API testing platform for QA teams.

## Target Users

Primary users:

- Manual QA engineers
- QA automation engineers
- SDET engineers
- QA leads

Secondary users:

- Frontend developers
- Release managers
- Engineering managers

## Problem Statement

QA teams need to run repeated regression tests before releases, but traditional automation is expensive to create and maintain.

Existing automated tests often fail because of UI changes, API changes, environment instability, data problems, or flaky behavior. When failures happen, QA teams spend too much time checking screenshots, logs, videos, network requests, and CI output before they can decide whether the failure is a real product issue.

## Product Goal

Help QA teams create, run, understand, and maintain web UI and API regression tests with less engineering effort.

## Non-Goals

The MVP will not:

- Replace Playwright, Cypress, Selenium, or CI systems.
- Support mobile testing.
- Support desktop testing.
- Become a full test case management system.
- Become a full security scanning platform.
- Become a load testing platform.
- Automatically fix product bugs.
- Guarantee perfect AI-generated tests.

## MVP Capabilities

### Project Management

Users can create a project for a web application.

Each project includes:

- Project name
- Repository URL
- Default test environment
- Base URL
- Environment variables

### Environment Management

Users can configure environments such as:

- Local
- Development
- Staging
- Preview
- Production smoke test

Each environment includes:

- Base URL
- Login method
- Secrets reference
- Health check URL

### Flow Management

Users can create regression flows.

A flow includes:

- Name
- Description
- Preconditions
- Steps
- Assertions
- Success criteria
- Tags
- Owner

### Flow Spec

The platform stores flows in a structured format called Flow Spec.

Flow Spec should be:

- Human-readable
- Versionable
- Easy for AI to generate and modify
- Easy to convert into Playwright tests
- Easy to connect with API test cases

### API Discovery

The platform can discover APIs from browser network traffic while a user or runner interacts with the web application.

The API discovery module should capture:

- Request method
- Request URL
- Path parameters
- Query parameters
- Request headers
- Request body
- Response status
- Response body sample
- Response headers
- Related page or flow

The platform should filter out noisy requests such as:

- Static assets
- Images
- Fonts
- Analytics beacons
- Browser extension requests
- Third-party tracking calls

### API Inventory

Discovered APIs should be stored in an API inventory.

Each API record should include:

- Name
- Method
- Path
- Environment
- Authentication requirement
- Request schema guess
- Response schema guess
- Example request
- Example response
- Source flow
- Last observed time

### API Test Case Generation

The platform can generate API test cases from discovered APIs.

Generated API tests should cover:

- Happy path
- Required parameter missing
- Invalid parameter type
- Unauthorized request
- Permission boundary when possible
- Basic response schema assertion
- Business assertion when connected to a Flow Spec

### API Test Execution

The platform can execute generated API tests.

The first version should support:

- Base URL selection
- Environment variables
- Authentication token or cookie reuse
- Header injection
- JSON body requests
- Response status assertion
- Response body assertion
- Response time recording

### Test Generation

The platform can generate Playwright tests and API tests from Flow Specs and discovered APIs.

Generated tests should:

- Use stable selectors where possible
- Include clear assertions
- Include comments only when helpful
- Avoid overusing fragile text selectors
- Keep API assertions readable and reviewable

### Test Execution

Users can run tests manually.

The platform records:

- Start time
- End time
- Status
- Browser
- Environment
- Trigger source
- Related flow

### Artifact Collection

Each failed run should collect:

- Screenshot
- Video
- Playwright trace
- Console logs
- Network errors
- Related API request and response samples
- Error stack

### AI Failure Classification

When a test fails, AI should classify the failure as one of:

- Product bug
- API contract change
- Selector broken
- Environment issue
- Test data issue
- Authentication issue
- Flaky behavior
- Unknown

AI should also provide a short explanation and confidence level.

### AI Repair Suggestion

For selector or script-related failures, AI can suggest a patch.

The user must review and accept the suggestion before it changes test code.

### Dashboard

The first dashboard should show:

- Recent runs
- Pass rate
- Failed flows
- Failure categories
- Flaky candidates
- Links to artifacts

## Community Version Requirements

The community version must be:

- Easy to self-host
- Easy to understand
- Useful without enterprise features
- Safe for teams to try on internal staging environments

## Success Metrics

Early community metrics:

- A new user can run the demo in less than 15 minutes.
- A QA engineer can create a first flow without writing code.
- A QA engineer can discover APIs from one web flow.
- A QA engineer can generate at least one API test from captured traffic.
- A failed run shows enough evidence to understand the issue.
- 5 external users can deploy the platform with Docker Compose.
- 10 real regression flows are documented from early users.

## Open Questions

- Should Flow Specs live only in the database or also sync to Git?
- Should the first version support GitHub App integration or start with manual project setup?
- Which LLM provider should be the default in examples?
- Should generated Playwright tests be editable in the UI?
- Should the community version include basic user accounts from day one?

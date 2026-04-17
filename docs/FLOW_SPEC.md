# Flow Spec v0.1

Flow Spec is the central format of Open Regression Copilot.

It describes a business regression flow in a way that is readable by QA engineers and executable by the platform.

Flow Spec can drive both UI regression tests and related API tests.

## Design Goals

Flow Spec should be:

- Easy for QA engineers to read
- Easy for AI to generate
- Easy for developers to review
- Easy to convert to Playwright tests
- Stable enough to store in Git later

## Basic Example

```yaml
id: login-basic
name: Basic login
description: A registered user can log in successfully.
environment: staging
tags:
  - smoke
  - auth
owner: qa-team
preconditions:
  - Test user exists
  - Test user is not locked
variables:
  username: "{{TEST_USER_EMAIL}}"
  password: "{{TEST_USER_PASSWORD}}"
steps:
  - id: open-login-page
    action: navigate
    target: "/login"
  - id: input-email
    action: fill
    target: "email input"
    value: "{{username}}"
  - id: input-password
    action: fill
    target: "password input"
    value: "{{password}}"
  - id: submit-login
    action: click
    target: "login button"
  - id: assert-dashboard
    action: assert
    target: "dashboard page is visible"
success_criteria:
  - User is redirected to dashboard
  - No critical console error appears
api_discovery:
  enabled: true
  include:
    - "/api/**"
  exclude:
    - "/api/analytics/**"
api_assertions:
  - endpoint: "POST /api/login"
    expect:
      status: 200
      body:
        contains:
          - "token"
```

## Required Fields

- id
- name
- description
- environment
- steps
- success_criteria

## Optional API Fields

- api_discovery
- api_assertions
- related_apis

## Step Actions

Initial supported actions:

- navigate
- click
- fill
- select
- wait_for
- assert
- upload
- press

## Assertion Types

Initial supported assertions:

- text visible
- element visible
- url contains
- API response success
- no console error
- page title contains
- API status is expected
- API response schema is valid
- API response contains expected field

## AI Generation Rule

AI can help write Flow Spec, but the user should review it before execution.

The platform should show:

- What AI generated
- What assumptions AI made
- What information is missing

## Future Direction

Later versions may support:

- Git sync
- Version history
- Reusable steps
- Shared login flows
- Data fixtures
- Conditional steps
- Multi-role workflows
- Contract testing
- OpenAPI export
- API dependency graph

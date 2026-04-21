# Changelog

All notable changes to this project will be documented in this file.

## 2026-04-17

### Added

- Built the first public MVP of AITestAutomate.
- Added a Chinese control panel with left navigation and right work area.
- Added API discovery from OpenAPI, Postman, HAR, cURL, and manual request samples.
- Added basic web capture support for page elements and requests.
- Added automatic API inventory generation and test case generation.
- Added test execution reports and AI-style failure explanations.
- Added local workspace persistence.
- Added GitHub public repository setup, screenshot assets, and bilingual README entry.
- Added SQLite persistence and Docker deployment files.
- Added capture task APIs for tracking queued, running, completed, and failed web capture states.
- Added endpoint selection so users can confirm discovered APIs before generating test cases.
- Added persisted test run history with per-run summary and detailed results.

### Updated

- Updated project branding to `AITestAutomate`.
- Updated documentation to reflect multi-source import support.
- Updated the sidebar footer to link directly to the GitHub repository.
- Refined the Chinese control panel with a simpler enterprise-style layout and unified local service copy.
- Added web capture task tracking, API asset confirmation, and run history documentation.
- Simplified the dashboard header by removing the large placeholder hero area.

## 2026-04-21

### Added

- Added a process-driven dashboard that shows the end-to-end QA flow from project setup to defect closure.
- Added test asset review controls for case status, owner, notes, and execution enablement.
- Added a task center with persisted execution plans, trigger modes, cadence, and case membership.
- Added automatic defect creation from failed runs plus triage and resolve status updates.

### Updated

- Updated API persistence to keep plan, case review, and defect state in SQLite-backed workspace storage.
- Updated runtime path resolution so the production API serves the built frontend reliably from the repo root.
- Updated the README to document the new workflow-centered platform capabilities.

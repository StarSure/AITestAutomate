# AITestAutomate

An open-source AI automation testing platform for QA teams.

It currently focuses on one clear scenario:

**Discover APIs from web traffic, generate API test cases, and run regression checks.**

## Highlights

- Import OpenAPI / Swagger
- Import Postman Collection
- Import HAR
- Import cURL
- Import manual JSON samples
- Use a clean Chinese console with left navigation and quick actions
- Track web capture tasks
- Confirm discovered APIs before generating test cases
- Discover business APIs automatically
- Generate API test cases
- Run tests and show reports
- Keep run history
- Persist workspace state with SQLite
- Start with Docker Compose

## Quick Start

Requirements:

- Node.js 20+
- npm 10+

Install dependencies:

```bash
npm install
```

Start API server:

```bash
npm run dev:api
```

Start web console:

```bash
npm run dev:web
```

Open:

```text
http://localhost:5173
```

## Docker

```bash
docker compose up --build
```

Then open:

```text
http://localhost:4318
```

## Documentation

- [Chinese README](./README.md)
- [Start Here](./docs/START_HERE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)

## License

Apache-2.0

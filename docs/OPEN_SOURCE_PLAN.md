# Open Source Plan

## Goal

Build a community-first open-source project that QA teams can understand, deploy, and try quickly.

## Project Personality

The project should feel:

- Practical
- Transparent
- Friendly to QA engineers
- Easy to deploy
- Honest about AI limitations

Avoid promising magic.

## License

Recommended license:

- Apache-2.0

Reason:

- Friendly for enterprise adoption
- Common in infrastructure and developer tools
- Leaves room for future commercial services

## Community Principles

- Keep the core regression workflow open.
- Make self-hosting easy.
- Document limitations clearly.
- Prefer real examples over marketing claims.
- Accept community scenarios and templates.

## README Strategy

The public README should quickly answer:

- What is this?
- Who is it for?
- What problem does it solve?
- How do I run the demo?
- What does the first workflow look like?
- What is included in the community version?
- What is not included yet?

## First Public Demo

The first demo should show:

1. A sample e-commerce app.
2. A checkout regression flow.
3. AI generating a Flow Spec.
4. Playwright running the test.
5. A failure with screenshot and trace.
6. AI explaining the failure.

## Repository Checklist

Before public launch:

- README
- LICENSE
- CONTRIBUTING
- CODE_OF_CONDUCT
- SECURITY
- Docker Compose guide
- Demo video or GIF
- Example app
- Example flows
- Issue templates
- Roadmap

## First Community Issues

Create beginner-friendly issues:

- Add more Flow Spec examples
- Improve README wording
- Add a sample login flow
- Add screenshots to docs
- Add Docker Compose health check
- Add failure category examples

## Communication Style

Use clear language.

Good:

> AI helps classify failures, but raw screenshots, traces, and logs remain available.

Bad:

> AI understands your entire app and fixes testing automatically.


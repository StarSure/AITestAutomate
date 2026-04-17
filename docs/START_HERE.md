# Start Here

This document is written for a non-technical founder or project owner.

Your job is not to write code at the beginning. Your job is to make the project clear enough that developers, QA engineers, and early community users can understand what we are building.

## One-Sentence Project Idea

We are building an open-source AI regression testing platform for QA teams.

It helps QA teams describe business regression flows, generate Playwright tests, run them automatically, collect evidence, and use AI to explain failures.

## What You Should Say When Introducing It

Use this simple version:

> We are building an open-source AI regression testing platform for QA teams. It lets testers describe regression scenarios in natural language, turns them into maintainable Playwright tests, runs them automatically, and uses AI to explain why failures happened.

Avoid saying:

- We are building a fully autonomous AI tester.
- We will replace all QA engineers.
- We will automatically fix every bug.
- We support every platform from day one.

Those promises are too big and will hurt trust.

## The First User

The first user is a QA team that already does regression testing before releases.

They may currently use:

- Manual test cases in spreadsheets
- Test case platforms
- Playwright, Cypress, Selenium, or none of them
- CI systems such as GitHub Actions, GitLab CI, Jenkins, or manual scripts

They care about:

- Reducing repeated manual regression work
- Knowing whether a failed test is a real product bug
- Seeing screenshots, videos, and traces in one place
- Making automated tests easier to maintain

## The First Product Boundary

Only build web regression testing first.

Do not start with mobile, desktop, performance testing, security testing, or full test management.

The first community version should be small but useful.

## Your Weekly Job

Every week, do these things:

1. Talk to 2 QA engineers or QA leads.
2. Ask them about their most painful regression testing process.
3. Write down 3 real regression flows from their work.
4. Ask whether they would try a self-hosted open-source tool.
5. Update the project docs based on what you learn.

## Questions To Ask QA Teams

Use these questions:

- Before each release, how do you decide what regression tests to run?
- Which regression tests take the most time?
- Which automated tests fail most often?
- When a test fails, how do you know whether it is a product bug or script problem?
- What evidence do you need before reporting a bug?
- Do you already use Playwright, Cypress, Selenium, or another framework?
- Would you prefer a dashboard, GitHub comments, Slack notifications, or all of them?
- Can your company use a self-hosted open-source tool?

## What To Collect

For each potential user, collect:

- Company type
- Team size
- Current testing tools
- Release frequency
- Number of regression cases
- Top 3 painful flows
- Biggest reason automated testing failed before
- Whether they can try a Docker Compose deployment

## Decision Rule

If 5 different QA teams describe similar regression pain, we build for that pain first.

If only one team wants a special feature, we do not build it in the MVP.

## Next Milestone

The next milestone is not code.

The next milestone is:

- 10 real regression flow examples
- 5 QA interviews
- 1 clear MVP scope
- 1 demo story that any visitor can understand in 3 minutes


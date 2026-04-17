# Next Actions

This document is your practical action list.

You do not need to be technical to execute this stage.

## This Week

Your goal this week is to validate whether QA teams really want this product.

Do these 5 things:

1. Find 5 QA engineers or QA leads.
2. Ask them about regression testing pain.
3. Collect 10 real regression flows.
4. Ask whether they can try a self-hosted open-source tool.
5. Write all answers into a simple notes document.

## Who To Talk To

Best people:

- Manual QA engineer
- QA automation engineer
- Test development engineer
- QA lead
- Engineering manager responsible for release quality

Avoid starting with:

- Investors
- Random developers who do not run regression tests
- People who only talk about AI but do not own testing work

## Interview Script

Use this script directly:

> I am planning an open-source AI regression testing platform for QA teams. It helps testers describe regression scenarios, generate Playwright tests, run them automatically, collect screenshots/videos/traces, and use AI to explain failures. I am not selling anything now. I just want to understand your regression testing pain.

Then ask:

- How do you run regression tests before release?
- How many regression cases do you usually run?
- Which cases are repeated most often?
- Which cases are hardest to automate?
- Do your automated tests often fail for non-product reasons?
- When a test fails, what evidence do you need?
- What tools do you use now?
- If there was a self-hosted open-source tool, would you try it?

## What A Good Answer Looks Like

Good answers are specific.

Example:

> Every Thursday before release, two QA engineers spend half a day testing login, order creation, coupon usage, payment callback, and refund flow. Our Selenium tests often fail because selectors change. We need screenshots and network logs before reporting bugs.

Weak answers are vague.

Example:

> AI testing sounds useful.

Do not build based on vague answers.

## Regression Flow Collection Template

For each real flow, write:

```text
Flow name:
System:
User role:
Environment:
Preconditions:
Steps:
Expected result:
Current testing method:
Current pain:
Evidence needed after failure:
How often it runs:
Business importance:
```

## First 10 Flow Ideas

If users cannot give examples immediately, use these to guide them:

- User login
- User registration
- Password reset
- Product search
- Add to cart
- Checkout
- Order creation
- Payment callback check
- Refund request
- Admin approval

## What Not To Do This Week

Do not:

- Hire a full development team yet.
- Build mobile testing.
- Build enterprise permission systems.
- Promise full automatic bug fixing.
- Spend time designing a logo.
- Buy a domain before the positioning is stable.

## What To Send To A Developer

If you want a developer to understand the project, send them:

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/FLOW_SPEC.md`

Ask them:

> Can you build a local demo where a user writes one Flow Spec, generates one Playwright test, runs it, and sees a screenshot when it fails?

## First Demo Definition

The first technical demo only needs:

- One sample web app
- One login flow
- One checkout flow
- One button to run tests
- One result page
- One screenshot artifact
- One AI failure explanation

If this works, the project is alive.

## Founder Checklist

You are ready to start development when:

- You have 5 interview notes.
- You have 10 real regression flows.
- At least 3 people say they would try the tool.
- The MVP scope has not expanded beyond web regression testing.
- A developer can explain the architecture back to you in simple words.


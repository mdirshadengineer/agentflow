# AgentFlow E2E Tests

End-to-end tests for the AgentFlow platform UI, powered by [Playwright](https://playwright.dev/).

## Structure

```
e2e/
├── fixtures/
│   └── auth.ts              # Authenticated page fixture (reuses saved session)
├── pages/                   # Page Object Models
│   ├── login-page.ts
│   ├── signup-page.ts
│   ├── dashboard-page.ts
│   ├── workflows-page.ts
│   └── agents-page.ts
├── tests/                   # Test suites
│   ├── auth.spec.ts         # Login, signup, logout, protected routes
│   ├── dashboard.spec.ts    # Dashboard stats and navigation
│   ├── workflows.spec.ts    # Workflow CRUD, run trigger, navigation
│   ├── agents.spec.ts       # Agent CRUD, detail page, chat tab
│   ├── workflow-editor.spec.ts  # Workflow canvas editor
│   └── runs.spec.ts         # Run list and detail pages
├── global.setup.ts          # Creates test user and saves auth state
├── global.teardown.ts       # Cleans up auth state after test run
└── playwright.config.ts     # Playwright configuration
```

## Prerequisites

Both servers need to be running (Playwright handles this via `webServer`):

- **Vite dev server** – the React UI (port 5173)
- **Fastify API server** – the backend (port 3000, proxies to Vite)

## Running the Tests

```bash
# From the e2e/ directory
pnpm test                   # Run all tests (headless Chromium)
pnpm test:headed            # Run with visible browser window
pnpm test:ui                # Open the Playwright UI
pnpm test:debug             # Run with debugger attached

# Run a specific test file
npx playwright test tests/auth.spec.ts

# Run a specific test by name
npx playwright test --grep "successful login"
```

## Test User

The global setup seeds one persistent test user:

| Field    | Value                        |
| -------- | ---------------------------- |
| Email    | `e2e-test@agentflow.test`    |
| Password | `e2e-password-123`           |

All "authenticated" tests reuse the session created for this user (stored at `.auth/user.json`).

## Environment Variables

| Variable                    | Default                  | Description                          |
| --------------------------- | ------------------------ | ------------------------------------ |
| `AGENTFLOW_E2E_BASE_URL`    | `http://localhost:3000`  | Override the base URL for tests      |
| `AGENTFLOW_DATA_DIR`        | `/tmp/agentflow-e2e`     | Temporary data directory for the API |

## Coverage

| Area               | Tests |
| ------------------ | ----- |
| Authentication     | Login, signup, logout, duplicate email, invalid creds, protected route redirects |
| Dashboard          | Stat cards, recent runs section, sidebar navigation, user email display |
| Workflows          | List, create, create with description, validation, delete, edit link, runs link, run trigger |
| Agents             | List, create, create with description, validation, delete, detail page, edit, invalid JSON config, chat tab |
| Workflow Editor    | Canvas loads, toolbar buttons, back navigation, workflow name, node library |
| Runs               | Runs list page, empty state, run after trigger, run detail page with ID and status |

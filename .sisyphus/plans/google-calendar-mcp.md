# Google Calendar MCP Server

## TL;DR

> **Quick Summary**: Build a full TypeScript MCP server exposing Google Calendar as tools with OAuth2 auth, dual transport (stdio + HTTP/SSE), encrypted token storage, and webhook push notifications. Published as `@calendar-mcp/server` npm package + Docker.
>
> **Deliverables**:
> - npm package `@calendar-mcp/server` with dual-transport MCP server
> - 16+ MCP tools covering full CRUD, recurring events, free/busy, calendar management, webhook subscriptions
> - OAuth2 local callback flow with AES-256-GCM encrypted token storage
> - Dockerfile + docker-compose.yml for deployment
> - Full TDD test suite with vitest
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T1 (scaffold) → T3 (types+auth) → T5 (calendar service) → T8-10 (tools) → T12 (webhooks) → T15-16 (package+docker) → F1-F4

---

## Context

### Original Request
Build a full TypeScript MCP server that exposes Google Calendar (Agenda) as tools. Full CRUD + advanced operations (recurring events, free/busy queries, calendar management, event subscriptions/webhooks). OAuth2 user authentication with local server callback. Dual transport (stdio + HTTP/SSE). Multiple calendars via explicit calendarId param. npm package + Docker deployment.

### Interview Summary
**Key Discussions**:
- Auth: OAuth2 with local server callback (localhost:3500/oauth2callback)
- Operations: Full CRUD + recurring events, free/busy, calendar management, webhook push notifications
- Transport: stdio (Claude Desktop) + HTTP/SSE (webhook reception + remote clients)
- Multi-calendar: Explicit `calendarId` param, default `primary`
- Package: `@calendar-mcp/server` on npm
- Testing: TDD (Red-Green-Refactor) with vitest
- Deployment: Dockerfile + docker-compose.yml

**Research Findings**:
- MCP SDK v1.x is stable; v2 is alpha. Use v1.x.
- `@googleapis/calendar` ships full TypeScript types (`calendar_v3` namespace)
- Security advisory GHSA-345p-7cg4-v4c7: **Cannot share a single `McpServer` instance across transports**. Must create two instances sharing a `CalendarService` layer.
- Webhook push notifications contain NO event data — only a signal. Every push requires a follow-up `events.list` call with `syncToken`.
- Watch channels expire after 7 days max. Must be renewed.
- Google OAuth2 refresh tokens: need `access_type: 'offline'`, `prompt: 'consent'`. Watch for rotation (new refresh_token during refresh).
- `nspady/google-calendar-mcp` (1.1k stars) is the most complete reference — interactive OAuth, multi-account, encrypted tokens (fork by naotaka3 adds AES-256-GCM).

### Metis Review
**Identified Gaps** (addressed):
- **CRITICAL**: Single McpServer instance across transports is a security vulnerability → Two instances sharing CalendarService
- **CRITICAL**: STDIO process lifecycle (ephemeral, per-conversation) conflicts with webhook server (must be persistent) → Server always runs HTTP listener; stdio is an optional mode
- **Webhooks harder than assumed**: No event data in push, channels expire in 7 days, HTTPS + domain verification required for production → v1: manual subscribe/unsubscribe tools, document 7-day limit, auto-renewal is v2
- **Encryption**: Reference impl uses file permissions (0o600) not AES → Use AES-256-GCM with auto-generated key, `node:crypto` only
- **Token refresh deduplication**: Concurrent tool calls may both trigger refresh → Promise mutex pattern
- **Zod version compatibility**: MCP SDK v1.x requires specific zod version → Pin compatible version

---

## Work Objectives

### Core Objective
Build a production-grade TypeScript MCP server that exposes Google Calendar as tools with full CRUD, advanced operations, OAuth2 auth, dual transport, webhook push notifications, encrypted token storage, and Docker deployment.

### Concrete Deliverables
- `@calendar-mcp/server` npm package
- Dual-transport MCP server (stdio + HTTP/SSE)
- OAuth2 local callback auth with encrypted token storage
- 16+ MCP tools for calendar operations
- Webhook endpoint for Google push notifications
- Dockerfile + docker-compose.yml
- TDD test suite with vitest

### Definition of Done
- [ ] `npm run build` succeeds with zero errors
- [ ] `vitest run` passes all tests (80%+ coverage target)
- [ ] Server starts in stdio mode and responds to MCP tool calls
- [ ] Server starts in HTTP mode and accepts MCP connections at `/mcp`
- [ ] OAuth2 flow completes: browser opens, consent granted, tokens stored encrypted
- [ ] All 16+ tool operations work against Google Calendar API (with valid tokens)
- [ ] Webhook endpoint receives and validates Google push notifications
- [ ] Docker image builds and runs successfully
- [ ] No `as any` / `@ts-ignore` in production code

### Must Have
- Two separate `McpServer` instances (one stdio, one HTTP) sharing `CalendarService`
- AES-256-GCM token encryption with `node:crypto` (no third-party crypto)
- OAuth2 local callback server with configurable port (env `OAUTH_PORT`, default 3500)
- Auto-paginate list operations with cap of 250 items
- Handle `status: "cancelled"` events in list results
- Handle both `date` (all-day) and `dateTime` (timed) event formats
- Deduplicate concurrent OAuth2 token refresh calls (promise mutex)
- Validate `X-Goog-Channel-Token` on incoming webhook requests
- Graceful shutdown: SIGTERM/SIGINT handlers
- Configurable ports via environment variables

### Must NOT Have (Guardrails)
- NO single `McpServer` instance shared across transports (security vulnerability per GHSA-345p-7cg4-v4c7)
- NO local calendar data cache in v1 (stateless API pass-through only)
- NO automatic watch channel renewal (document 7-day limit, add in v2)
- NO OS keychain integration in v1 (file-based encrypted storage only)
- NO Gmail, Tasks, or Contacts API exposure
- NO UI/dashboard — headless server only
- NO push notifications relayed to stdio clients (impossible — stdio is request-response)
- NO `as any` / `@ts-ignore` casts in production code
- NO third-party crypto libraries (`crypto-js`, `node-forge`)
- NO token plaintext logging

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield project)
- **Automated tests**: YES (TDD)
- **Framework**: vitest
- **TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: N/A (headless server)
- **CLI/Auth**: Use interactive_bash (tmux) — run server, trigger OAuth flow, validate token storage
- **API/Backend**: Use Bash (curl) — send MCP tool calls, assert responses
- **Library/Module**: Use Bash (vitest) — run test suites, assert pass/fail

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + scaffolding):
├── T1: Project scaffolding + build config [quick]
├── T2: Zod + MCP SDK type exploration [quick]
├── T3: TypeScript types + Google Calendar API client wrapper [deep]
└── T4: OAuth2 auth module + token encryption [deep]

Wave 2 (After Wave 1 — core services + tool definitions):
├── T5: CalendarService business logic layer [deep]
├── T6: MCP tool definitions (Zod schemas) [unspecified-high]
├── T7: Dual transport setup (stdio + HTTP/SSE) [deep]
└── T8: Event CRUD tools implementation [unspecified-high]

Wave 3 (After Wave 2 — advanced tools + webhooks):
├── T9: Recurring events tools [deep]
├── T10: Free/busy + calendar management tools [unspecified-high]
├── T11: Webhook subscribe/unsubscribe tools [deep]
└── T12: Webhook endpoint (receives Google push) [unspecified-high]

Wave 4 (After Wave 3 — packaging + deployment):
├── T13: npm package config (bin, exports, publish) [quick]
├── T14: Dockerfile + docker-compose.yml [quick]
└── T15: CLI entry point + configuration [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: T1 → T3 → T5 → T8 → T11 → T12 → T15 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | — | T2, T3, T4, T5 | 1 |
| T2 | T1 | T6 | 1 |
| T3 | T1 | T5, T8, T9, T10 | 1 |
| T4 | T1 | T5, T7 | 1 |
| T5 | T3, T4 | T8, T9, T10 | 2 |
| T6 | T2 | T8, T9, T10, T11 | 2 |
| T7 | T4 | T12 | 2 |
| T8 | T5, T6 | — | 2 |
| T9 | T5, T6 | — | 3 |
| T10 | T5, T6 | — | 3 |
| T11 | T6, T7 | T12 | 3 |
| T12 | T7, T11 | — | 3 |
| T13 | T8 | — | 4 |
| T14 | T13 | — | 4 |
| T15 | T7, T13 | — | 4 |
| F1-F4 | All | — | FINAL |

### Agent Dispatch Summary
- **Wave 1**: 4 tasks — T1 → `quick`, T2 → `quick`, T3 → `deep`, T4 → `deep`
- **Wave 2**: 4 tasks — T5 → `deep`, T6 → `unspecified-high`, T7 → `deep`, T8 → `unspecified-high`
- **Wave 3**: 4 tasks — T9 → `deep`, T10 → `unspecified-high`, T11 → `deep`, T12 → `unspecified-high`
- **Wave 4**: 3 tasks — T13 → `quick`, T14 → `quick`, T15 → `unspecified-high`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Project scaffolding + build config

  **What to do**:
  - Initialize TypeScript project with `npm init`, install core deps: `typescript`, `@modelcontextprotocol/sdk`, `@googleapis/calendar`, `zod`, `express`
  - Install dev deps: `vitest`, `@types/node`, `tsup` (bundler), `eslint`, `prettier`
  - Create `tsconfig.json` with strict mode, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
  - Create `tsup.config.ts` for building (entry: `src/index.ts`, format: `esm`, splitting: true, dts: true)
  - Create `vitest.config.ts` with TypeScript path support
  - Create `.eslintrc.json` with strict rules (no `any`, no unused vars)
  - Create project directory structure: `src/auth/`, `src/services/`, `src/tools/`, `src/transport/`, `src/webhooks/`, `src/utils/`, `src/types/`
  - Add scripts to `package.json`: `build`, `dev`, `test`, `lint`, `start`
  - TDD: Write a failing test that verifies `src/index.ts` exports exist (will pass once entry point is created)

  **Must NOT do**:
  - NO implementation code — only project config, deps, directory structure
  - NO business logic or tool implementations

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundation task — all others depend on this)
  - **Parallel Group**: Wave 1
  - **Blocks**: T2, T3, T4, T5
  - **Blocked By**: None

  **References**:
  - `@modelcontextprotocol/sdk` npm page: https://www.npmjs.com/package/@modelcontextprotocol/sdk — Check compatible zod version
  - `@googleapis/calendar` npm page: https://www.npmjs.com/package/@googleapis/calendar — Verify TypeScript support
  - `nspady/google-calendar-mcp` (repo): https://github.com/nspady/google-calendar-mcp — Reference for project structure, `package.json` deps, `tsconfig.json` settings
  - `modelcontextprotocol/typescript-sdk` (repo): https://github.com/modelcontextprotocol/typescript-sdk — Official SDK examples for tsconfig and build setup

  **WHY Each Reference Matters**:
  - SDK npm page: Confirms exact zod version compatibility (critical for MCP SDK)
  - Google calendar npm: Verifies types are bundled, no separate `@types` needed
  - nspady repo: Production-proven project structure to copy conventions from
  - TypeScript SDK repo: Official build configuration patterns

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/setup.test.ts` verifying project structure
  - [ ] `npx vitest run src/__tests__/setup.test.ts` → PASS

  **QA Scenarios**:

  ```
  Scenario: Project builds successfully
    Tool: Bash
    Preconditions: Node.js 20+ installed, project directory clean
    Steps:
      1. Run `npm install`
      2. Run `npm run build`
      3. Check `dist/` directory exists
    Expected Result: Build completes with zero errors, `dist/index.js` exists
    Failure Indicators: Build errors, missing `dist/` directory
    Evidence: .sisyphus/evidence/task-1-build-success.log

  Scenario: TypeScript strict mode compiles
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `npx tsc --noEmit`
    Expected Result: Zero type errors
    Failure Indicators: Type errors in console output
    Evidence: .sisyphus/evidence/task-1-tsc-strict.log
  ```

  **Commit**: YES (groups with T1)
  - Message: `feat(scaffold): initialize TypeScript project with vitest, tsup, strict config`
  - Files: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.eslintrc.json`, `src/`
  - Pre-commit: `npm run build && npm test`

- [x] 2. Zod + MCP SDK type exploration

  **What to do**:
  - Create `src/types/mcp.ts` — type wrappers for MCP tool handler input/output
  - Create `src/types/tools.ts` — Zod input schemas for every planned tool (16+ tools)
  - Verify zod version compatibility with MCP SDK by importing and testing `server.registerTool` with a dummy schema
  - TDD: Write failing test that imports from `@modelcontextprotocol/sdk` and registers a dummy tool, verifies it boots without errors

  **Must NOT do**:
  - NO actual tool implementations — only schemas and type definitions
  - NO Google Calendar API calls

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T3, T4 — no overlap)
  - **Parallel Group**: Wave 1
  - **Blocks**: T6
  - **Blocked By**: T1

  **References**:
  - `@modelcontextprotocol/sdk` docs: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md — Tool registration API, `registerTool` signature, `inputSchema` format
  - MCP SDK `examples/` directory: https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples — Working examples of tool definition patterns
  - Zod v3 vs v4 compatibility: Check `package.json` of SDK to confirm which zod version to pin

  **WHY Each Reference Matters**:
  - SDK docs: Exact API for `registerTool`, `inputSchema`, `outputSchema`, `annotations`
  - Examples: Proven patterns for tool definitions, error handling, McpServer setup
  - Zod compat: Critical — wrong zod version breaks MCP SDK at runtime

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/types.test.ts` verifying schemas parse correctly
  - [ ] `npx vitest run src/__tests__/types.test.ts` → PASS
  - [ ] Dummy tool registered with MCP SDK without errors

  **QA Scenarios**:

  ```
  Scenario: All Zod schemas compile and parse valid input
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/types.test.ts`
    Expected Result: All schema parse tests pass
    Failure Indicators: Zod validation errors, type errors
    Evidence: .sisyphus/evidence/task-2-schema-test.log

  Scenario: MCP SDK accepts tool registration with our schemas
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/mcp-tool-registration.test.ts`
    Expected Result: Dummy tool registers without errors, schemas parse
    Failure Indicators: "Cannot read properties of undefined", zod parse failure
    Evidence: .sisyphus/evidence/task-2-mcp-registration.log
  ```

  **Commit**: YES (groups with T2+T3)
  - Message: `feat(types): add calendar API types, schemas, and Google client wrapper`
  - Files: `src/types/mcp.ts`, `src/types/tools.ts`, `src/__tests__/types.test.ts`, `src/__tests__/mcp-tool-registration.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 3. TypeScript types + Google Calendar API client wrapper

  **What to do**:
  - Create `src/types/calendar.ts` — Re-export key types from `calendar_v3` namespace: `Schema$Event`, `Schema$Events`, `Schema$FreeBusyResponse`, `Schema$CalendarList`, `Schema$Channel`, etc.
  - Create `src/services/google-client.ts` — Wrapper around `google.calendar()` that:
    - Accepts an `OAuth2Client` and returns a typed `calendar_v3.Calendar` instance
    - Implements promise mutex for deduplicating concurrent token refreshes
    - Adds retry with exponential backoff for 429/503 errors (max 3 retries)
    - Handles 401 by attempting token refresh before failing
  - TDD: Write failing test for client wrapper — mock `OAuth2Client`, verify refresh mutex deduplication, verify retry on 429

  **Must NOT do**:
  - NO tool implementations — only client wrapper and types
  - NO actual Google API calls in tests — mock everything
  - NO `as any` casts

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T2, T4 — no overlap)
  - **Parallel Group**: Wave 1
  - **Blocks**: T5, T8, T9, T10
  - **Blocked By**: T1

  **References**:
  - `@googleapis/calendar` types: https://googleapis.dev/nodejs/googleapis/latest/calendar/ — API surface, type signatures
  - `calendar_v3` schema types: https://github.com/googleapis/google-api-nodejs-client/blob/main/src/apis/calendar/v3.ts — Full type definitions for Schema$Event, Schema$Events, Params$Resource$Events$List, etc.
  - `nspady/google-calendar-mcp` CalendarRegistry: https://github.com/nspady/google-calendar-mcp/blob/main/src/services/CalendarRegistry.ts — Reference for Google client wrapper patterns
  - Error codes: https://developers.google.com/workspace/calendar/api/guides/errors — Google Calendar API error response format and recommended handling

  **WHY Each Reference Matters**:
  - googleapis.dev: Confirms exact method signatures for type-safe wrapper
  - v3.ts source: Key type exports (`Schema$Event`, `Schema$Channel`, etc.) needed for `calendar.ts`
  - nspady CalendarRegistry: Production reference for handling auth + retry + error handling
  - Error codes: Essential for implementing correct retry logic (which errors to retry, which to surface)

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/google-client.test.ts` with tests for refresh mutex and retry logic
  - [ ] `npx vitest run src/__tests__/google-client.test.ts` → PASS (covers: concurrent refresh dedup, 429 retry, 401 refresh-retry)

  **QA Scenarios**:

  ```
  Scenario: Concurrent refresh calls are deduplicated
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/google-client.test.ts -t "refresh mutex"`
    Expected Result: Test verifies that 3 concurrent expired-token calls trigger only 1 refresh
    Failure Indicators: "Expected 1 refresh call, got 3"
    Evidence: .sisyphus/evidence/task-3-refresh-mutex.log

  Scenario: 429 rate limit triggers exponential backoff retry
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/google-client.test.ts -t "retry on 429"`
    Expected Result: Test verifies 3 retries with increasing delays, then failure
    Failure Indicators: "Expected 3 retries, got N" or retry delays not increasing
    Evidence: .sisyphus/evidence/task-3-retry-backoff.log

  Scenario: 401 unauthorized triggers refresh then retry
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/google-client.test.ts -t "401 refresh retry"`
    Expected Result: Test verifies refresh is called, then original request retried with new token
    Failure Indicators: "Expected refresh+retry, got immediate error"
    Evidence: .sisyphus/evidence/task-3-401-refresh.log
  ```

  **Commit**: YES (groups with T2+T3)
  - Message: `feat(types): add calendar API types, schemas, and Google client wrapper`
  - Files: `src/types/calendar.ts`, `src/services/google-client.ts`, `src/__tests__/google-client.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 4. OAuth2 auth module + token encryption

  **What to do**:
  - Create `src/auth/oauth-client.ts` — `OAuth2Client` wrapper that:
    - Initializes `google.auth.OAuth2` with client ID, secret, redirect URI (configurable port)
    - Implements `getAuthUrl()` generating consent URL with `access_type: 'offline'`, `prompt: 'consent'`, all required scopes
    - Implements `handleCallback(code: string)` exchanging auth code for tokens
    - Implements `onTokenRefresh` handler persisting updated tokens (including new refresh_token if rotated)
  - Create `src/auth/token-store.ts` — Encrypted token storage that:
    - Uses `node:crypto` AES-256-GCM for encryption/decryption
    - Stores tokens at `~/.config/calendar-mcp/tokens.json` with `0o600` permissions
    - Config dir `~/.config/calendar-mcp/` with `0o700` permissions
    - Auto-generates encryption key on first run at `~/.config/calendar-mcp/encryption-key.txt` with `0o600` permissions
    - Supports `CALENDAR_MCP_ENCRYPTION_KEY` env var override
    - Format: `{ iv: string, authTag: string, ciphertext: string }` per token
    - Implements `loadTokens()`, `saveTokens()`, `clearTokens()`
  - Create `src/auth/callback-server.ts` — Local HTTP server for OAuth2 callback:
    - Spins up Express server on configurable port (default 3500)
    - Handles `GET /oauth2callback` with auth code exchange
    - Auto-opens browser with `open`/`xdg-open` command
    - Returns promise that resolves when tokens are stored
    - Cleans up server after callback received
  - TDD: Write failing tests for all three modules (mock OAuth2Client, mock filesystem, mock HTTP server)

  **Must NOT do**:
  - NO `crypto-js` or `node-forge` — only `node:crypto`
  - NO plaintext token storage — everything encrypted
  - NO logging of decrypted tokens
  - NO third-party crypto libraries

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T2, T3 — no overlap)
  - **Parallel Group**: Wave 1
  - **Blocks**: T5, T7
  - **Blocked By**: T1

  **References**:
  - Google OAuth2 for Node.js: https://github.com/googleapis/google-api-nodejs-client/blob/main/samples/auth/oauth2.js — Official OAuth2 flow example
  - MCP SDK auth issue discussion: https://github.com/modelcontextprotocol/typescript-sdk — Check for auth-related issues
  - `naotaka3/google-calendar-mcp` (fork with AES encryption): https://github.com/naotaka3/google-calendar-mcp — Encryption format: `iv:authTag:ciphertext`
  - `nspady/google-calendar-mcp` auth server: https://github.com/nspady/google-calendar-mcp/blob/main/src/auth/server.ts — Reference for callback server implementation
  - Node.js `crypto` docs: https://nodejs.org/api/crypto.html — AES-256-GCM API reference

  **WHY Each Reference Matters**:
  - Google OAuth2 example: Correct token exchange flow, refresh handling
  - naotaka3 fork: Proven AES-256-GCM token encryption implementation to follow
  - nspady auth server: Callback server patterns for OAuth2 local flow
  - Node.js crypto: Exact API for `createCipheriv`, `createDecipheriv`, GCM auth tag handling

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test files created: `src/__tests__/oauth-client.test.ts`, `src/__tests__/token-store.test.ts`, `src/__tests__/callback-server.test.ts`
  - [ ] `npx vitest run src/__tests__/` → All auth tests pass (covers: auth URL generation, callback handling, token encryption/decryption, token refresh, callback server start/stop)

  **QA Scenarios**:

  ```
  Scenario: Token encryption produces non-plaintext output
    Tool: Bash
    Preconditions: Dev dependencies installed, tests passing
    Steps:
      1. Run `npx vitest run src/__tests__/token-store.test.ts -t "encryption produces ciphertext"`
    Expected Result: Test verifies encrypted output cannot be grep'd for "access_token" or "refresh_token"
    Failure Indicators: "Expected ciphertext, got plaintext"
    Evidence: .sisyphus/evidence/task-4-encryption.log

  Scenario: Auto-generated encryption key has correct file permissions
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/token-store.test.ts -t "key file permissions"`
    Expected Result: Test verifies encryption key file has 0o600 permissions
    Failure Indicators: "Expected 0o600, got 0oXXX"
    Evidence: .sisyphus/evidence/task-4-key-perms.log

  Scenario: OAuth callback server starts, receives code, stores tokens
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/callback-server.test.ts`
    Expected Result: All callback server tests pass (start, receive code, exchange, store, cleanup)
    Failure Indicators: Server fails to start, callback not received
    Evidence: .sisyphus/evidence/task-4-callback-server.log

  Scenario: Token refresh persists new refresh_token when rotated
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/oauth-client.test.ts -t "refresh token rotation"`
    Expected Result: Test verifies that when OAuth2Client emits new tokens with refresh_token, the new token is persisted
    Failure Indicators: "Expected new refresh_token to be stored, got old one"
    Evidence: .sisyphus/evidence/task-4-refresh-rotation.log
  ```

  **Commit**: YES
  - Message: `feat(auth): add OAuth2 local callback flow with AES-256-GCM token storage`
  - Files: `src/auth/oauth-client.ts`, `src/auth/token-store.ts`, `src/auth/callback-server.ts`, `src/__tests__/oauth-client.test.ts`, `src/__tests__/token-store.test.ts`, `src/__tests__/callback-server.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 5. CalendarService business logic layer

  **What to do**:
  - Create `src/services/calendar-service.ts` — Core business logic layer that both MCP server instances call into:
    - `listEvents(calendarId, timeMin, timeMax, maxResults?)` — Auto-paginate with cap of 250, filter `status: "cancelled"` events (or mark explicitly)
    - `getEvent(calendarId, eventId)` — Get single event
    - `createEvent(calendarId, event)` — Create event, handle both `date` and `dateTime` formats
    - `updateEvent(calendarId, eventId, event)` — Partial update using `patch` semantics
    - `deleteEvent(calendarId, eventId)` — Delete with confirmation
    - `listCalendars()` — List user's calendar list
    - `getCalendar(calendarId)` — Get single calendar details
    - `queryFreeBusy(calendarIds, timeMin, timeMax, timeZone?)` — Free/busy query for up to 50 calendars
    - Each method takes an `OAuth2Client` param (injected by the caller) — no singleton auth state
    - All methods return typed results (using types from T3)
    - All methods use the `google-client.ts` wrapper for retry/refresh
  - TDD: Write failing tests mocking `calendar_v3.Calendar` for every public method

  **Must NOT do**:
  - NO local caching of calendar data (stateless pass-through)
  - NO tool definitions here — only service methods
  - NO auth logic — auth is injected

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T3 and T4 for types and client wrapper)
  - **Parallel Group**: Wave 2
  - **Blocks**: T8, T9, T10
  - **Blocked By**: T3, T4

  **References**:
  - `calendar_v3` API reference: https://googleapis.dev/nodejs/googleapis/latest/calendar/ — Method signatures for events.list, events.insert, etc.
  - Events list with pagination: https://developers.google.com/workspace/calendar/api/guides/pagination — `pageToken` pattern for auto-pagination
  - `nspady/google-calendar-mcp` CalendarRegistry: https://github.com/nspady/google-calendar-mcp/blob/main/src/services/CalendarRegistry.ts — Reference for CalendarService structure
  - `calendar_v3` Schema$Event type: https://github.com/googleapis/google-api-nodejs-client/blob/main/src/apis/calendar/v3.ts — Shape of event objects for both `date` and `dateTime` fields

  **WHY Each Reference Matters**:
  - API reference: Exact method names, parameters, and return types
  - Pagination: Correct `pageToken` loop pattern to implement auto-pagination
  - nspady CalendarRegistry: Proven structure for service layer
  - Schema$Event: Handling all-day (`date`) vs timed (`dateTime`) event fields

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/calendar-service.test.ts`
  - [ ] `npx vitest run src/__tests__/calendar-service.test.ts` → PASS (covers: listEvents pagination, getEvent, createEvent, updateEvent, deleteEvent, listCalendars, queryFreeBusy, cancelled event handling, all-day vs timed format)

  **QA Scenarios**:

  ```
  Scenario: listEvents auto-paginates and caps at 250
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/calendar-service.test.ts -t "listEvents pagination"`
    Expected Result: Test verifies that when API returns 3 pages of 100 events each, all 300 are fetched but result is capped at 250
    Failure Indicators: "Expected 250 events, got 300" or "Expected 3 API calls, got 1"
    Evidence: .sisyphus/evidence/task-5-pagination.log

  Scenario: listEvents filters cancelled events
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/calendar-service.test.ts -t "cancelled events"`
    Expected Result: Test verifies events with `status: "cancelled"` are either filtered or explicitly marked
    Failure Indicators: Cancelled events returned without marking
    Evidence: .sisyphus/evidence/task-5-cancelled.log

  Scenario: createEvent handles both all-day and timed events
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/calendar-service.test.ts -t "createEvent format"`
    Expected Result: Test verifies both `date` (all-day) and `dateTime` (timed) formats are handled correctly
    Failure Indicators: Timezone or date format errors
    Evidence: .sisyphus/evidence/task-5-event-format.log

  Scenario: queryFreeBusy handles up to 50 calendars
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/calendar-service.test.ts -t "freeBusy"`
    Expected Result: Test verifies free/busy query works with multiple calendar IDs
    Failure Indicators: "Max 50 calendars" error not handled, or query format incorrect
    Evidence: .sisyphus/evidence/task-5-freebusy.log
  ```

  **Commit**: YES
  - Message: `feat(service): add CalendarService business logic layer`
  - Files: `src/services/calendar-service.ts`, `src/__tests__/calendar-service.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 6. MCP tool definitions (Zod schemas)

  **What to do**:
  - Create `src/tools/definitions.ts` — Central tool definition registry with Zod input schemas for all 16+ tools:
    - **Event CRUD**: `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`
    - **Recurring events**: `list_event_instances`, `create_recurring_event`
    - **Free/busy**: `query_free_busy`
    - **Calendar management**: `list_calendars`, `get_calendar`
    - **Webhook subscriptions**: `subscribe_calendar`, `unsubscribe_calendar`, `list_subscriptions`
    - **Utility**: `search_events`, `get_current_time`
  - Each tool has: `name`, `description`, `inputSchema` (Zod object), `annotations` (readOnlyHint, destructiveHint, idempotentHint)
  - Create `src/tools/handlers.ts` — Handler functions that bridge MCP tool calls to `CalendarService` methods. Each handler:
    - Receives validated Zod input
    - Gets OAuth2Client from token store
    - Calls CalendarService method
    - Formats response as `content: [{ type: "text", text: JSON.stringify(result) }]`
    - Returns `{ isError: true, content: [...] }` on errors
  - TDD: Write failing tests for tool schema validation (valid inputs pass, invalid inputs reject)

  **Must NOT do**:
  - NO actual Google API calls in handler tests — mock CalendarService
  - NO business logic in handlers — delegate to CalendarService
  - NO `as any` casts on Zod outputs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T2 for schemas, and T5 for service types)
  - **Parallel Group**: Wave 2
  - **Blocks**: T8, T9, T10, T11
  - **Blocked By**: T2

  **References**:
  - MCP SDK tool registration: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md — `registerTool` API, `inputSchema`, `outputSchema`, `annotations`
  - Tool annotations spec: https://modelcontextprotocol.io/docs/concepts/tools#annotations — `readOnlyHint`, `destructiveHint`, `idempotentHint`
  - Zod schemas from T2: `src/types/tools.ts` — Zod schemas defining tool input shapes
  - CalendarService from T5: `src/services/calendar-service.ts` — Method signatures handlers must call

  **WHY Each Reference Matters**:
  - SDK docs: Exact `registerTool` API for type-safe tool definitions
  - Annotations spec: Correct hint values for each tool (e.g., `delete_event` gets `destructiveHint: true`)
  - T2 output: Tool schemas to implement against
  - T5 output: Service method signatures handlers must delegate to

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test files created: `src/__tests__/tool-schemas.test.ts`, `src/__tests__/tool-handlers.test.ts`
  - [ ] `npx vitest run src/__tests__/tool-schemas.test.ts` → PASS (all schemas validate/correctly reject)
  - [ ] `npx vitest run src/__tests__/tool-handlers.test.ts` → PASS (handlers delegate correctly)

  **QA Scenarios**:

  ```
  Scenario: All 16+ tool schemas validate correct input and reject invalid input
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tool-schemas.test.ts`
    Expected Result: All schema tests pass — valid inputs accepted, invalid inputs rejected with clear errors
    Failure Indicators: Schema validation errors, missing fields not caught
    Evidence: .sisyphus/evidence/task-6-schemas.log

  Scenario: Tool handlers delegate to CalendarService and format responses
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tool-handlers.test.ts`
    Expected Result: All handler tests pass — handlers call correct service methods, format responses properly, handle errors
    Failure Indicators: Handlers not delegating, response format incorrect, errors not wrapped
    Evidence: .sisyphus/evidence/task-6-handlers.log

  Scenario: Destructive tools have destructiveHint annotation
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tool-schemas.test.ts -t "destructive hints"`
    Expected Result: `delete_event`, `unsubscribe_calendar` have `destructiveHint: true`; `list_events`, `get_event` have `readOnlyHint: true`
    Failure Indicators: Missing or incorrect annotations
    Evidence: .sisyphus/evidence/task-6-annotations.log
  ```

  **Commit**: YES (groups with T6+T8)
  - Message: `feat(tools): add tool definitions and handlers`
  - Files: `src/tools/definitions.ts`, `src/tools/handlers.ts`, `src/__tests__/tool-schemas.test.ts`, `src/__tests__/tool-handlers.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 7. Dual transport setup (stdio + HTTP/SSE)

  **What to do**:
  - Create `src/transport/stdio.ts` — Stdio transport:
    - Creates `McpServer` instance #1 (name: `calendar-mcp-stdio`)
    - Registers all tools from T6
    - Connects to `StdioServerTransport`
    - Handles SIGTERM/SIGINT for graceful shutdown
  - Create `src/transport/http.ts` — HTTP/SSE transport:
    - Creates `McpServer` instance #2 (name: `calendar-mcp-http`) — **separate instance per GHSA-345p-7cg4-v4c7**
    - Registers all tools from T6 (same registrations, different server)
    - Uses `@modelcontextprotocol/sdk` `StreamableHTTPServerTransport` or Express-based SSE transport
    - Configurable port via `HTTP_PORT` env var (default 3000)
    - DNS rebinding protection: validate Host header, restrict to allowed hosts
    - CORS headers for browser clients
  - Create `src/transport/shared.ts` — Shared factory function to register all tools on any `McpServer` instance (avoids duplication)
  - TDD: Write failing tests verifying two `McpServer` instances can be created independently, tool registration works on both

  **Must NOT do**:
  - NO shared `McpServer` instance between transports (security vulnerability)
  - NO business logic in transport layer — delegate to CalendarService via handlers
  - NO webhook handling here — T12 handles that

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T4 for auth, T5 for service, T6 for tools)
  - **Parallel Group**: Wave 2
  - **Blocks**: T12
  - **Blocked By**: T4

  **References**:
  - MCP SDK dual transport security advisory: GHSA-345p-7cg4-v4c7 — CRITICAL: Cannot reuse `McpServer` instance across transports
  - `StreamableHTTPServerTransport`: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/server/src/simpleStreamableHttp.ts — Official HTTP transport example
  - `StdioServerTransport`: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md — Stdio transport setup
  - DNS rebinding protection: https://modelcontextprotocol.io/docs/concepts/transports — Security considerations for HTTP transports

  **WHY Each Reference Matters**:
  - GHSA advisory: MANDATORY — two separate instances required
  - Streamable HTTP example: Correct transport setup pattern
  - Stdio docs: Stdio transport configuration
  - DNS rebinding: Required security measure for HTTP transport

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test files created: `src/__tests__/transport-stdio.test.ts`, `src/__tests__/transport-http.test.ts`
  - [ ] `npx vitest run src/__tests__/transport-*.test.ts` → PASS (covers: two instances created, tools registered on both, stdio starts, HTTP starts)

  **QA Scenarios**:

  ```
  Scenario: Two independent McpServer instances can be created
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/transport-stdio.test.ts`
      2. Run `npx vitest run src/__tests__/transport-http.test.ts`
    Expected Result: Both server instances initialize independently, tools registered on each, no shared state
    Failure Indicators: "Cannot connect second transport to same server" or shared state detected
    Evidence: .sisyphus/evidence/task-7-dual-transport.log

  Scenario: HTTP server starts and accepts MCP connections
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Start HTTP server in test
      2. Send MCP initialize request via HTTP
      3. Verify response with server capabilities
    Expected Result: Server responds with correct capabilities, both transports usable
    Failure Indicators: Connection refused, missing capabilities
    Evidence: .sisyphus/evidence/task-7-http-transport.log

  Scenario: shared.ts registers tools on both server instances identically
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/transport-*.test.ts -t "shared registration"`
    Expected Result: Both server instances have identical tool registrations
    Failure Indicators: Tool count mismatch between instances
    Evidence: .sisyphus/evidence/task-7-shared-registration.log
  ```

  **Commit**: YES
  - Message: `feat(transport): add dual transport support (stdio + HTTP/SSE)`
  - Files: `src/transport/stdio.ts`, `src/transport/http.ts`, `src/transport/shared.ts`, `src/__tests__/transport-stdio.test.ts`, `src/__tests__/transport-http.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 8. Event CRUD tools implementation

  **What to do**:
  - Wire up `list_events`, `get_event`, `create_event`, `update_event`, `delete_event` tool handlers to CalendarService methods
  - Implement error formatting: catch `GaxiosError`, extract `error.errors[0].reason` and `error.errors[0].message`, return structured error to MCP client
  - Implement `search_events` — wraps `events.list` with `q` parameter for full-text search
  - Implement `get_current_time` — returns current time in ISO 8601 with timezone context (useful for LLM time awareness)
  - Handle edge cases:
    - All-day events (`date` field vs `dateTime`)
    - Cancelled events (`status: "cancelled"`)
    - Pagination (auto-paginate, cap at 250)
    - NotFound errors (404 → clear "event not found" message)
  - TDD: Write integration-style tests with mocked CalendarService, verify correct delegation and response formatting

  **Must NOT do**:
  - NO direct Google API calls in handlers — always delegate to CalendarService
  - NO `as any` casts
  - NO caching

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T5 and T6)
  - **Parallel Group**: Wave 2
  - **Blocks**: T13
  - **Blocked By**: T5, T6

  **References**:
  - CalendarService methods from T5: `src/services/calendar-service.ts` — Method signatures for delegation
  - Tool definitions from T6: `src/tools/definitions.ts` — Zod schemas for input validation
  - Tool handlers from T6: `src/tools/handlers.ts` — Handler function signatures
  - `GaxiosError` type: https://github.com/googleapis/gaxios-nodejs — Error shapes for structured error handling
  - Google Calendar events.list: https://developers.google.com/workspace/calendar/api/v3/reference/events/list — All query parameters

  **WHY Each Reference Matters**:
  - T5 output: Correct method signatures to call
  - T6 output: Zod schemas to validate against
  - GaxiosError: Error response shape for structured error messages
  - events.list: `q`, `timeMin`, `timeMax`, `singleEvents` parameters needed for search

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/tools-event-crud.test.ts`
  - [ ] `npx vitest run src/__tests__/tools-event-crud.test.ts` → PASS (covers: all 7 tools, error handling, edge cases)

  **QA Scenarios**:

  ```
  Scenario: create_event creates event and returns formatted response
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-event-crud.test.ts -t "create_event"`
    Expected Result: Test verifies handler delegates to calendarService.createEvent, returns JSON response with event data
    Failure Indicators: Handler not delegating, response not JSON-formatted
    Evidence: .sisyphus/evidence/task-8-create-event.log

  Scenario: delete_event returns error when event not found
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-event-crud.test.ts -t "delete_event not found"`
    Expected Result: Handler returns `{ isError: true, content: [{ type: "text", text: "...not found..." }] }`
    Failure Indicators: Unhandled error, raw error thrown instead of formatted response
    Evidence: .sisyphus/evidence/task-8-delete-notfound.log

  Scenario: list_events handles all-day and timed events correctly
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-event-crud.test.ts -t "all-day events"`
    Expected Result: Test verifies both `date` (all-day) and `dateTime` (timed) formats are preserved in output
    Failure Indicators: All-day events converted to timed format or vice versa
    Evidence: .sisyphus/evidence/task-8-allday.log

  Scenario: 429 rate limit error is formatted correctly
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-event-crud.test.ts -t "rate limit error"`
    Expected Result: Handler returns `{ isError: true, content: [{ type: "text", text: "...rate limit...retry after N seconds..." }] }`
    Failure Indicators: Raw GaxiosError, unhandled promise rejection
    Evidence: .sisyphus/evidence/task-8-ratelimit.log
  ```

  **Commit**: YES (groups with T6+T8)
  - Message: `feat(tools): add event CRUD tools with TDD tests`
  - Files: `src/tools/definitions.ts`, `src/tools/handlers.ts`, `src/__tests__/tools-event-crud.test.ts`
  - Pre-commit: `npm run build && npm test`

- Pre-commit: `npm run build && npm test`

- [x] 9. Recurring events tools

  **What to do**:
  - Implement `list_event_instances` tool — expands a recurring event series into individual instances using `events.instances` API method
  - Implement `create_recurring_event` tool — creates events with `recurrence` field (RRULE format, e.g., `RRULE:FREQ=WEEKLY;COUNT=10`)
  - Validate `recurrence` field format (must be RRULE string array)
  - Handle `singleEvents: true` vs `singleEvents: false` in list operations (true = expands series, false = returns series master)
  - Handle edge cases: recurring events with no end date, recurrence with exceptions
  - TDD: Write failing tests for recurring event creation and instance expansion

  **Must NOT do**:
  - NO RRULE parser — pass-through to Google API
  - NO local recurrence calculation

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T10, T11, T12 — no overlap)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T5, T6

  **References**:
  - Google Calendar events.instances: https://developers.google.com/workspace/calendar/api/v3/reference/events/instances — API for expanding recurring events
  - Google Calendar recurrence rules: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert — `recurrence` field format (array of RRULE strings)
  - CalendarService from T5: `src/services/calendar-service.ts` — `listEventInstances`, `createRecurringEvent` methods
  - `calendar_v3` Schema$Event: https://github.com/googleapis/google-api-nodejs-client/blob/main/src/apis/calendar/v3.ts — `recurrence` field type definition

  **WHY Each Reference Matters**:
  - events.instances: Correct API method and parameters for expanding series
  - recurrence rules: RRULE format specification for creating recurring events
  - T5 output: Service methods to delegate to
  - Schema$Event: Type definition for `recurrence` field (string array)

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/tools-recurring.test.ts`
  - [ ] `npx vitest run src/__tests__/tools-recurring.test.ts` → PASS (covers: create_recurring_event, list_event_instances, RRULE validation, infinite recurrence)

  **QA Scenarios**:

  ```
  Scenario: create_recurring_event creates weekly recurrence
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-recurring.test.ts -t "create recurring"`
    Expected Result: Handler delegates to CalendarService with `recurrence: ["RRULE:FREQ=WEEKLY;COUNT=10"]`
    Failure Indicators: RRULE format rejected, recurrence field not array
    Evidence: .sisyphus/evidence/task-9-create-recurring.log

  Scenario: list_event_instances expands recurring series
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-recurring.test.ts -t "list instances"`
    Expected Result: Handler calls events.instances API, returns list of individual occurrences
    Failure Indicators: Returns series master instead of instances
    Evidence: .sisyphus/evidence/task-9-list-instances.log

  Scenario: Invalid RRULE is rejected at schema level
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-recurring.test.ts -t "invalid RRULE"`
    Expected Result: Zod schema rejects non-array recurrence, returns validation error
    Failure Indicators: Invalid RRULE accepted without validation
    Evidence: .sisyphus/evidence/task-9-invalid-rrule.log
  ```

  **Commit**: YES (groups with T9+T10)
  - Message: `feat(tools): add recurring events, free/busy, and calendar management tools`
  - Files: `src/tools/definitions.ts`, `src/tools/handlers.ts`, `src/services/calendar-service.ts`, `src/__tests__/tools-recurring.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 10. Free/busy + calendar management tools

  **What to do**:
  - Implement `query_free_busy` tool — wraps CalendarService.queryFreeBusy with calendar IDs and time range
  - Implement `list_calendars` tool — wraps CalendarService.listCalendars
  - Implement `get_calendar` tool — get single calendar details by ID
  - Handle edge cases:
    - Free/busy max 50 calendars per query — validate and reject overflow
    - Calendar list pagination — auto-paginate
    - Timezone parameter defaults to UTC
  - TDD: Write failing tests for free/busy query and calendar management

  **Must NOT do**:
  - NO calendar creation/deletion in v1 — only read operations
  - NO local availability calculation — delegate to Google API

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9, T11, T12 — no overlap)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T5, T6

  **References**:
  - Free/busy query API: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query — `calendarExpansionMax: 50`, request/response format
  - Calendar list API: https://developers.google.com/workspace/calendar/api/v3/reference/calendarlist/list — Pagination, `maxResults`
  - CalendarService from T5: `src/services/calendar-service.ts` — `queryFreeBusy`, `listCalendars`, `getCalendar` methods
  - `calendar_v3` Schema$FreeBusyResponse: Shape of free/busy response for output formatting

  **WHY Each Reference Matters**:
  - Free/busy API: 50-calendar limit, required fields
  - Calendar list API: Pagination parameters
  - T5 output: Service method signatures
  - Schema$FreeBusyResponse: Correct response typing

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/tools-freebusy-calendar.test.ts`
  - [ ] `npx vitest run src/__tests__/tools-freebusy-calendar.test.ts` → PASS

  **QA Scenarios**:

  ```
  Scenario: query_free_busy rejects more than 50 calendars
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-freebusy-calendar.test.ts -t "max calendars"`
    Expected Result: Zod schema validates array length <= 50, returns error for 51+ calendars
    Failure Indicators: 51+ calendars accepted without error
    Evidence: .sisyphus/evidence/task-10-max-calendars.log

  Scenario: query_free_busy returns busy time blocks
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-freebusy-calendar.test.ts -t "free busy query"`
    Expected Result: Handler returns formatted busy periods with start/end times
    Failure Indicators: Response format incorrect, missing timezone
    Evidence: .sisyphus/evidence/task-10-freebusy.log
  ```

  **Commit**: YES (groups with T9+T10)
  - Message: `feat(tools): add recurring events, free/busy, and calendar management tools`
  - Files: `src/tools/definitions.ts`, `src/tools/handlers.ts`, `src/services/calendar-service.ts`, `src/__tests__/tools-freebusy-calendar.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 11. Webhook subscribe/unsubscribe tools

  **What to do**:
  - Implement `subscribe_calendar` tool — registers a watch channel via `events.watch` API:
    - Input: `calendarId`, optional `address` (webhook URL — defaults to server's configured webhook URL)
    - Generates a random `channelToken` for verification
    - Returns `channelId`, `resourceId`, `expiration` (max 7 days)
    - Stores channel metadata locally in `~/.config/calendar-mcp/channels.json` (for stop/renew)
  - Implement `unsubscribe_calendar` tool — stops a watch channel via `channels.stop`:
    - Input: `channelId`
    - Removes from local channel store
  - Implement `list_subscriptions` tool — lists active watch channels from local store
  - TDD: Write failing tests with mocked `events.watch` and `channels.stop`

  **Must NOT do**:
  - NO automatic channel renewal in v1 — document 7-day expiry, add in v2
  - NO webhook event processing here — T12 handles incoming webhooks
  - NO real Google API calls in tests

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T6 for tool definitions, T7 for transport)
  - **Parallel Group**: Wave 3
  - **Blocks**: T12
  - **Blocked By**: T6, T7

  **References**:
  - Google Calendar events.watch: https://developers.google.com/workspace/calendar/api/v3/reference/events/watch — Watch channel registration, `id`, `type`, `address` fields
  - Google Calendar channels.stop: https://developers.google.com/workspace/calendar/api/v3/reference/channels/stop — Stop watching
  - Watch channel limits: https://developers.google.com/workspace/calendar/api/v3/push — 7-day max expiration, no event data in push, domain verification required
  - CalendarService from T5: `src/services/calendar-service.ts` — Need to add `subscribeCalendar`, `unsubscribeCalendar`, `listSubscriptions` methods

  **WHY Each Reference Matters**:
  - events.watch: Required fields (`id`, `type: "web_hook"`, `address`), response shape, expiration handling
  - channels.stop: Required fields for stopping (`id`, `resourceId`)
  - Push docs: 7-day limit, domain verification, no event body — critical constraints
  - T5 output: Service methods to add

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/tools-webhooks-subscribe.test.ts`
  - [ ] `npx vitest run src/__tests__/tools-webhooks-subscribe.test.ts` → PASS (covers: subscribe, unsubscribe, list subscriptions, channel token generation, 7-day expiry note)

  **QA Scenarios**:

  ```
  Scenario: subscribe_calendar creates watch channel and stores metadata
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-webhooks-subscribe.test.ts -t "subscribe"`
    Expected Result: Test verifies `events.watch` called with correct params, channel metadata stored locally, channelToken generated
    Failure Indicators: Missing channelToken, watch not called, metadata not stored
    Evidence: .sisyphus/evidence/task-11-subscribe.log

  Scenario: unsubscribe_calendar stops watch channel and removes metadata
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-webhooks-subscribe.test.ts -t "unsubscribe"`
    Expected Result: Test verifies `channels.stop` called with correct id/resourceId, metadata removed from local store
    Failure Indicators: Channel not stopped, metadata not removed
    Evidence: .sisyphus/evidence/task-11-unsubscribe.log

  Scenario: list_subscriptions returns stored channels
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/tools-webhooks-subscribe.test.ts -t "list subscriptions"`
    Expected Result: Test verifies stored channels are returned with channelId, calendarId, expiration
    Failure Indicators: Empty list when channels exist, wrong format
    Evidence: .sisyphus/evidence/task-11-list-subscriptions.log
  ```

  **Commit**: YES (groups with T11+T12)
  - Message: `feat(webhooks): add subscribe/unsubscribe tools and webhook endpoint`
  - Files: `src/tools/definitions.ts`, `src/tools/handlers.ts`, `src/services/calendar-service.ts`, `src/webhooks/channel-store.ts`, `src/__tests__/tools-webhooks-subscribe.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 12. Webhook endpoint (receives Google push)

  **What to do**:
  - Create `src/webhooks/endpoint.ts` — Express route handler for Google push notifications:
    - `POST /webhooks/google-calendar` — Receives push notifications
    - Validates `X-Goog-Channel-Token` against stored channel tokens (prevents spoofing)
    - Validates `X-Goog-Resource-State` (handles `sync` state — initial sync message)
    - Extracts `X-Goog-Channel-ID`, `X-Goog-Resource-ID`, `X-Goog-Message-Number`
    - Returns `200` within 10 seconds (Google requirement)
    - Logs notification and triggers MCP resource update notification to connected HTTP/SSE clients
  - Create `src/webhooks/processor.ts` — Processes incoming webhook notifications:
    - On notification: calls `events.list` with `syncToken` to fetch actual changes
    - Deduplicates notifications using `X-Goog-Message-Number` + `X-Goog-Resource-ID`
    - Formats change notifications for MCP clients
  - Wire webhook endpoint into HTTP transport from T7 (`src/transport/http.ts`)
  - TDD: Write failing tests with mock Google push notifications (various states, invalid tokens, duplicate messages)

  **Must NOT do**:
  - NO push notification delivery to stdio clients (impossible — stdio is request-response)
  - NO real Google API calls in webhook processing tests
  - NO auto-renewal of expiring channels (v2)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T7 for HTTP transport, T11 for channel store)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T7, T11

  **References**:
  - Google push notifications: https://developers.google.com/workspace/calendar/api/v3/push — Request body structure, headers (`X-Goog-*`), response requirements
  - Webhook validation: https://developers.google.com/workspace/calendar/api/v3/push#verifying — Must validate `X-Goog-Channel-Token` to prevent spoofing
  - Sync token handling: https://developers.google.com/workspace/calendar/api/guides/sync — Using sync tokens for incremental sync after push notification
  - HTTP transport from T7: `src/transport/http.ts` — Where to mount webhook endpoint

  **WHY Each Reference Matters**:
  - Push docs: Required headers, response timing (200 within 10s), `sync` vs `exists` state
  - Validation: `X-Goog-Channel-Token` verification prevents spoofed notifications
  - Sync tokens: After receiving push, must use `syncToken` to get actual event changes
  - T7 output: Correct location to mount webhook Express route

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/webhook-endpoint.test.ts`
  - [ ] `npx vitest run src/__tests__/webhook-endpoint.test.ts` → PASS (covers: valid push, invalid token, sync state, deduplication, response within 10s)

  **QA Scenarios**:

  ```
  Scenario: Webhook accepts valid Google push notification
    Tool: Bash
    Preconditions: Dev dependencies installed, channel created with known token
    Steps:
      1. Run `npx vitest run src/__tests__/webhook-endpoint.test.ts -t "valid push"`
    Expected Result: Endpoint returns 200, validates channel token, extracts headers, triggers change fetch
    Failure Indicators: Returns 401/403, doesn't validate token, hangs
    Evidence: .sisyphus/evidence/task-12-valid-push.log

  Scenario: Webhook rejects notification with invalid channel token
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/webhook-endpoint.test.ts -t "invalid token"`
    Expected Result: Endpoint returns 200 (Google requires 200 even for invalid tokens internally) but logs warning and discards message
    Failure Indicators: Returns non-200 to Google (would cause retries), processes invalid message
    Evidence: .sisyphus/evidence/task-12-invalid-token.log

  Scenario: Webhook handles initial sync message
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/webhook-endpoint.test.ts -t "sync state"`
    Expected Result: Endpoint recognizes `X-Goog-Resource-State: sync`, acknowledges without fetching changes
    Failure Indicators: Attempts to fetch changes for sync message, or discards it entirely
    Evidence: .sisyphus/evidence/task-12-sync-state.log

  Scenario: Duplicate notifications are deduplicated
    Tool: Bash
    Preconditions: Dev dependencies installed
    Steps:
      1. Run `npx vitest run src/__tests__/webhook-endpoint.test.ts -t "deduplication"`
    Expected Result: Same message number + resource ID processed only once
    Failure Indicators: Duplicate processing detected
    Evidence: .sisyphus/evidence/task-12-dedup.log
  ```

  **Commit**: YES (groups with T11+T12)
  - Message: `feat(webhooks): add subscribe/unsubscribe tools and webhook endpoint`
  - Files: `src/webhooks/endpoint.ts`, `src/webhooks/processor.ts`, `src/transport/http.ts`, `src/__tests__/webhook-endpoint.test.ts`
  - Pre-commit: `npm run build && npm test`

- [x] 13. npm package config (bin, exports, publish)

  **What to do**:
  - Update `package.json` with:
    - `"name": "@calendar-mcp/server"`
    - `"bin": { "calendar-mcp": "./dist/index.js" }`
    - `"exports": { ".": "./dist/index.js" }`
    - `"files": ["dist"]`
    - `"type": "module"`
    - `"engines": { "node": ">=20.0.0" }`
    - Remove `"private": true` (or keep for initial dev)
  - Ensure `tsup.config.ts` produces correct ESM output with shebang for CLI
  - Create `.npmignore` (exclude `src/`, `__tests__/`, `.sisyphus/`)
  - Verify `npm pack --dry-run` produces correct tarball contents
  - TDD: Write test verifying `npm pack --dry-run` output includes expected files

  **Must NOT do**:
  - NO actual npm publish — only config and verify `npm pack`
  - NO `.npmrc` with auth tokens

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T14, T15 — no overlap except project files)
  - **Parallel Group**: Wave 4
  - **Blocks**: T14
  - **Blocked By**: T8

  **References**:
  - nspady/google-calendar-mcp package.json: https://github.com/nspady/google-calendar-mcp/blob/main/package.json — Reference for bin, exports, files config
  - npm package.json spec: https://docs.npmjs.com/cli/v10/configuring-npm/package-json — bin, exports, files, engines fields
  - tsup configuration: https://tsup.egoist.dev/ — ESM output, shebang, dts options

  **WHY Each Reference Matters**:
  - nspady package.json: Proven config for MCP server npm package
  - npm spec: Correct field names and formats
  - tsup: Build configuration for ESM output with shebang

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test verifying `npm pack --dry-run` includes `dist/index.js`, `dist/index.d.ts`
  - [ ] `npx vitest run src/__tests__/package.test.ts` → PASS

  **QA Scenarios**:

  ```
  Scenario: npm pack produces correct tarball
    Tool: Bash
    Preconditions: Build completed (`npm run build`)
    Steps:
      1. Run `npm pack --dry-run 2>&1`
      2. Verify output includes `dist/index.js`, `dist/index.d.ts`
      3. Verify output excludes `src/`, `__tests__/`, `.sisyphus/`
    Expected Result: Tarball contains only `dist/` and `README.md`, excludes source files
    Failure Indicators: Source files included, dist files missing
    Evidence: .sisyphus/evidence/task-13-npm-pack.log

  Scenario: CLI entry point works
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run `node dist/index.js --help`
    Expected Result: Shows help text or version, exits cleanly
    Failure Indicators: Module not found, missing shebang, crashes
    Evidence: .sisyphus/evidence/task-13-cli-help.log
  ```

  **Commit**: YES (groups with T13+T14+T15)
  - Message: `feat(package): add npm publish config, Dockerfile, CLI entry point`
  - Files: `package.json`, `tsup.config.ts`, `.npmignore`
  - Pre-commit: `npm run build && npm test`

- [x] 14. Dockerfile + docker-compose.yml

  **What to do**:
  - Create `Dockerfile`:
    - Multi-stage build: `node:20-alpine` as builder, `node:20-alpine` as runner
    - Copy `package.json`, `package-lock.json`, install production deps
    - Copy `dist/` from builder stage
    - Expose port 3000 (HTTP transport)
    - Health check on `/health`
    - Run as non-root user
    - ENTRYPOINT: `node dist/index.js`
  - Create `docker-compose.yml`:
    - Service: `calendar-mcp`
    - Ports: `3000:3000` (HTTP), `3500:3500` (OAuth callback)
    - Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_MCP_ENCRYPTION_KEY`, `HTTP_PORT`, `OAUTH_PORT`
    - Volumes: `~/.config/calendar-mcp:/home/node/.config/calendar-mcp` (persistent token storage)
  - Create `.dockerignore` (exclude `src/`, `__tests__/`, `.sisyphus/`, `node_modules/`)
  - TDD: Write test verifying Docker image builds (`docker build -t calendar-mcp .`)

  **Must NOT do**:
  - NO hardcoded secrets in Dockerfile or compose
  - NO dev dependencies in production image
  - NO running as root

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T13, T15 — no overlap)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: T13

  **References**:
  - Node.js Docker best practices: https://nodejs.org/en/docs/guides/nodejs-docker-webapp — Multi-stage build, non-root user, alpine
  - Docker Compose specification: https://docs.docker.com/compose/compose-file/ — Service, volumes, environment, ports config
  - nspady/google-calendar-mcp Dockerfile: https://github.com/nspady/google-calendar-mcp/blob/main/Dockerfile — Reference for MCP server Docker setup

  **WHY Each Reference Matters**:
  - Node.js Docker docs: Best practices for production Node.js containers
  - Compose spec: Correct YAML format for docker-compose.yml
  - nspady Dockerfile: Proven MCP server Docker build

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test verifying Docker image builds successfully
  - [ ] Test verifying container starts and health check responds

  **QA Scenarios**:

  ```
  Scenario: Docker image builds successfully
    Tool: Bash
    Preconditions: Docker installed, project built
    Steps:
      1. Run `docker build -t calendar-mcp .`
    Expected Result: Image builds without errors, `docker images calendar-mcp` shows the image
    Failure Indicators: Build fails, missing files in image
    Evidence: .sisyphus/evidence/task-14-docker-build.log

  Scenario: Container starts and health check responds
    Tool: Bash
    Preconditions: Docker image built
    Steps:
      1. Run `docker compose up -d`
      2. Wait 5 seconds
      3. Run `curl http://localhost:3000/health`
    Expected Result: Health endpoint returns 200
    Failure Indicators: Container crashes, health check not responding
    Evidence: .sisyphus/evidence/task-14-health-check.log

  Scenario: Container runs as non-root user
    Tool: Bash
    Preconditions: Container running
    Steps:
      1. Run `docker exec calendar-mcp whoami`
    Expected Result: Output is `node` (not `root`)
    Failure Indicators: Output is `root`
    Evidence: .sisyphus/evidence/task-14-nonroot.log
  ```

  **Commit**: YES (groups with T13+T14+T15)
  - Message: `feat(package): add npm publish config, Dockerfile, CLI entry point`
  - Files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
  - Pre-commit: `npm run build && npm test && docker build -t calendar-mcp .`

- [x] 15. CLI entry point + configuration

  **What to do**:
  - Create `src/index.ts` — Main entry point:
    - Parse CLI args: `--transport stdio|http|both` (default: `both`)
    - Parse env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `HTTP_PORT` (default 3000), `OAUTH_PORT` (default 3500), `CALENDAR_MCP_ENCRYPTION_KEY` (optional)
    - Validate required env vars on startup (log clear error if missing)
    - Initialize auth module, token store
    - If no tokens stored, trigger OAuth2 callback flow
    - Start appropriate transport(s) based on `--transport` flag
    - HTTP mode: Start Express server with MCP endpoint at `/mcp` and webhook endpoint at `/webhooks/google-calendar`
    - Stdio mode: Connect to StdioServerTransport
    - Both mode: Start HTTP server first, then connect stdio
    - Register graceful shutdown handlers (SIGTERM, SIGINT)
  - Create `src/config.ts` — Configuration module that:
    - Reads all env vars with defaults
    - Validates configuration on startup
    - Exports typed config object
  - Add `--help` and `--version` flags
  - TDD: Write failing tests for config parsing and entry point initialization

  **Must NOT do**:
  - NO hardcoded credentials
  - NO required interaction during stdio startup (OAuth should only trigger when tokens missing AND HTTP mode)
  - NO `process.exit()` in library code — only in CLI entry point

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T13, T14 — no overlap)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: T7, T13

  **References**:
  - nspady/google-calendar-mcp entry: https://github.com/nspady/google-calendar-mcp/blob/main/src/index.ts — Reference for CLI arg parsing, startup sequence
  - MCP SDK stdio pattern: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/servers Everything in the examples directory — StdioServerTransport setup
  - Express + MCP pattern: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/server/src/simpleStreamableHttp.ts — Express server with MCP and health check

  **WHY Each Reference Matters**:
  - nspady index.ts: Proven startup sequence with auth check and transport selection
  - SDK examples: Canonical McpServer + StdioServerTransport initialization
  - Express + MCP: Correct pattern for mounting MCP on Express

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Test file created: `src/__tests__/entry.test.ts`, `src/__tests__/config.test.ts`
  - [ ] `npx vitest run src/__tests__/entry.test.ts` → PASS
  - [ ] `npx vitest run src/__tests__/config.test.ts` → PASS

  **QA Scenarios**:

  ```
  Scenario: Server starts in stdio mode
    Tool: Bash
    Preconditions: Build completed, env vars set (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
    Steps:
      1. Run `node dist/index.js --transport stdio`
      2. Send MCP initialize message via stdin
    Expected Result: Server responds with capabilities, no HTTP server started
    Failure Indicators: HTTP server starts in stdio-only mode, crashes on startup
    Evidence: .sisyphus/evidence/task-15-stdio-mode.log

  Scenario: Server starts with both transports
    Tool: Bash
    Preconditions: Build completed, env vars set
    Steps:
      1. Run `node dist/index.js --transport both`
      2. Verify HTTP server starts on port 3000
      3. Verify stdio transport also initializes
    Expected Result: Both HTTP and stdio transports working simultaneously
    Failure Indicators: Only one transport starts, port binding fails
    Evidence: .sisyphus/evidence/task-15-both-transport.log

  Scenario: Missing required env vars shows clear error
    Tool: Bash
    Preconditions: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set
    Steps:
      1. Run `node dist/index.js` without env vars
    Expected Result: Clear error message listing missing vars, exits with code 1
    Failure Indicators: Undefined variable crash, silent failure
    Evidence: .sisyphus/evidence/task-15-missing-env.log

  Scenario: --help and --version flags work
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run `node dist/index.js --help`
      2. Run `node dist/index.js --version`
    Expected Result: Help text shows transport options and env vars; version matches package.json
    Failure Indicators: Flags not recognized, crashes
    Evidence: .sisyphus/evidence/task-15-help-version.log
  ```

  **Commit**: YES (groups with T13+T14+T15)
  - Message: `feat(package): add npm publish config, Dockerfile, CLI entry point`
  - Files: `src/index.ts`, `src/config.ts`, `src/__tests__/entry.test.ts`, `src/__tests__/config.test.ts`
  - Pre-commit: `npm run build && npm test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `vitest run` + eslint. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: invalid calendarId, expired tokens, network errors. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **T1**: `feat(scaffold): initialize TypeScript project with vitest, tsup, strict config`
- **T2+T3**: `feat(types): add calendar API types, schemas, and Google client wrapper`
- **T4**: `feat(auth): add OAuth2 local callback flow with AES-256-GCM token storage`
- **T5**: `feat(service): add CalendarService business logic layer`
- **T6+T8**: `feat(tools): add event CRUD tools with TDD tests`
- **T7**: `feat(transport): add dual transport support (stdio + HTTP/SSE)`
- **T9+T10**: `feat(tools): add recurring events, free/busy, and calendar management tools`
- **T11+T12**: `feat(webhooks): add subscribe/unsubscribe tools and webhook endpoint`
- **T13+T14+T15**: `feat(package): add npm publish config, Dockerfile, CLI entry point`

---

## Success Criteria

### Verification Commands
```bash
npm run build          # Expected: zero errors
npm test               # Expected: all tests pass
npm run lint           # Expected: zero warnings
docker build -t calendar-mcp .  # Expected: builds successfully
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All vitest tests pass
- [ ] OAuth2 flow completes end-to-end
- [ ] Both stdio and HTTP transports work
- [ ] Webhook endpoint receives and validates push notifications
- [ ] Token storage is encrypted (not plaintext)
- [ ] Two separate McpServer instances (no shared instance)
- [ ] Docker image builds and runs
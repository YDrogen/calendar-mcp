# Task 2 Learnings: MCP Type Wrappers & Zod Schemas

## Key Findings

### MCP SDK registerTool API
- **Signature**: `registerTool(name: string, config: {...}, handler: ToolCallback)`
- Deprecated `tool()` method — use `registerTool()` instead
- Config object takes: `description`, `inputSchema`, `annotations` (not inline arguments)
- Works with Zod v4.4.3 (compatible with @modelcontextprotocol/sdk v1.29.0)

### Zod Schema Design
- 15 tools total: 5 CRUD + 2 recurring + 1 free/busy + 2 calendar + 3 webhook + 2 utility
- `.describe()` on every field for LLM context (essential for Claude integration)
- Use `z.optional()` for optional params, not `z.string().optional()`
- Zod default: passes through extra properties (doesn't throw on unknown fields)
- Complex nested objects (start/end with dateTime/date options) work seamlessly with MCP SDK

### Type Safety
- No `as any` or type casts needed
- `ToolDefinition<T>` generic type ensures handler matches schema
- `z.infer<typeof Schema>` for TypeScript type extraction
- `AllToolSchemas` registry enables tool lookup by name

### Test Coverage
- 48 schema validation tests cover valid input, invalid input, edge cases
- 10 MCP SDK registration tests verify two independent server instances work
- Can register same tool on two servers (required for stdio + HTTP dual transport)

## Verified
✓ Zod v4.4.3 + MCP SDK v1.29.0 compatible
✓ All 15 tool schemas parse valid input, reject invalid input
✓ MCP SDK accepts our schemas without errors
✓ Two independent McpServer instances can coexist
✓ Zero TypeScript errors in strict mode
✓ All 58 tests passing

# Task 3 Learnings: Google Calendar API Client Wrapper

## Key Findings

### @googleapis/calendar Type Re-exports
- Named exports from `@googleapis/calendar` include `calendar` function and `calendar_v3` namespace
- Re-export pattern: `export type Schema$Event = calendar_v3.Schema$Event`
- Calendar client created via `calendar({ version: 'v3', auth: oauth2Client })`

### Retry Logic with Token Refresh
- `withRetry<T>(fn, oauth2Client)` handles 429/503 with exponential backoff (100ms * 2^attempt, max 3 retries)
- 401 handling: refresh token first, then retry exactly once (`did401Retry` flag prevents infinite loops)
- 404 and non-GaxiosError throw immediately without retry
- `isGaxiosError(error)` uses `error instanceof GaxiosError` (works with `GaxiosError[Symbol.hasInstance]`)

### Refresh Token Mutex
- Boolean `isRefreshing` + `refreshPromise` queue ensures only one refresh at a time
- Concurrent callers await the same `refreshPromise` instead of triggering duplicate refreshes
- After refresh completes, `isRefreshing = false` but promise remains resolved for late arrivals

### Testing with Fake Timers
- `vi.useFakeTimers({ shouldAdvanceTime: true })` required for async delay testing
- `vi.advanceTimersByTimeAsync(totalDelay)` advances timers and flushes microtasks
- Unhandled rejection warning avoided by immediately attaching `.catch()` to promises that will reject
- Mock `GaxiosError` with minimal `{ status, statusText, data, headers, config }` response object

### Verified
✓ `createCalendarClient` returns `calendar_v3.Calendar` with OAuth2Client auth
✓ `withRetry` 429 → 3 retries with increasing delays
✓ `withRetry` 401 → token refresh then retry once
✓ `withRetry` 404 → no retry, immediate failure
✓ 3 concurrent 401 calls → only 1 token refresh
✓ All 11 google-client tests passing with zero warnings
✓ Zero TypeScript errors in strict mode

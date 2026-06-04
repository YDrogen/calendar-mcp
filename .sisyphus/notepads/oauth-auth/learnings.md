# OAuth2 Authentication Module - Implementation Notes

## Files Created
- `src/auth/oauth-client.ts` — OAuth2Client wrapper
- `src/auth/token-store.ts` — Encrypted token storage
- `src/auth/callback-server.ts` — Express callback server
- `src/__tests__/oauth-client.test.ts` — OAuth tests
- `src/__tests__/token-store.test.ts` — Encryption tests
- `src/__tests__/callback-server.test.ts` — Server tests

## Key Implementation Details

### oauth-client.ts
- Wraps `google-auth-library` OAuth2Client
- Calendar scope: `https://www.googleapis.com/auth/calendar`
- Auth URL includes `access_type: 'offline'` and `prompt: 'consent'`
- `onTokenRefresh` listens for `'tokens'` events for rotation handling

### token-store.ts
- Uses `node:crypto` AES-256-GCM (no third-party crypto)
- Config dir: `~/.config/calendar-mcp/` (mode 0o700)
- Token file: `tokens.json` (mode 0o600)
- Key file: `encryption-key.txt` (mode 0o600)
- Key: 32 bytes from `randomBytes`, stored as hex
- Supports `CALENDAR_MCP_ENCRYPTION_KEY` env var override
- Encryption returns `{iv, authTag, ciphertext}` as hex strings
- No decrypted token logging anywhere

### callback-server.ts
- Express server with single `GET /oauth2callback` route
- Returns HTML "Authorization complete" on success
- Returns 400 on missing code
- Promise-based API: `{url, waitForCode, close}`

## Test Results
- All 20 auth tests pass
- TypeScript diagnostics clean on all files
- No `as any` or `@ts-ignore` used

## Patterns Used
- ESM imports with `.js` extensions
- Strict TypeScript throughout
- Vitest globals enabled
- `node:` prefix for built-in modules

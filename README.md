# @calendar-mcp/server

[![npm version](https://img.shields.io/npm/v/@calendar-mcp/server)](https://www.npmjs.com/package/@calendar-mcp/server)

A production-grade Google Calendar MCP (Model Context Protocol) server. Exposes Google Calendar as a set of structured tools that any MCP client can use to list, create, update, delete, search, and subscribe to calendar events.

---

## Overview

This server translates Google Calendar API operations into MCP tool calls. It supports full event CRUD, recurring events, free/busy queries, calendar management, and real-time push notifications via Google Calendar webhooks.

**Key features**

- **15 MCP tools** covering complete calendar operations
- **Multiple transports**: stdio for Claude Desktop, HTTP/SSE for remote clients, or both simultaneously
- **OAuth2 authentication** with automatic token refresh
- **AES-256-GCM encrypted token storage** with automatic key generation
- **Webhook support** for push notifications on calendar changes
- **DNS rebinding protection** and channel token validation on HTTP transport
- **TypeScript** with strict type safety across all tools

---

## Prerequisites

- **Node.js 20+** (required by the engine constraint)
- **Google OAuth2 credentials**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create a project (or select an existing one)
  3. Enable the **Google Calendar API**
  4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
  5. Set the application type to **Web application**
  6. Add `http://localhost:3500/oauth2callback` as an authorized redirect URI (or use your configured `OAUTH_PORT`)
  7. Copy the **Client ID** and **Client Secret**

---

## Installation

### Global install

```bash
npm install -g @calendar-mcp/server
```

### npx (no install)

```bash
npx @calendar-mcp/server --transport stdio
```

---

## Configuration

All configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth2 client secret |
| `HTTP_PORT` | No | `3000` | HTTP server port for SSE and webhook endpoints |
| `OAUTH_PORT` | No | `3500` | Port for the OAuth2 callback server |
| `CALENDAR_MCP_ENCRYPTION_KEY` | No | auto-generated | 64-character hex string for AES-256-GCM token encryption |

### Generating an encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store the output in `CALENDAR_MCP_ENCRYPTION_KEY`. If omitted, a key is generated automatically and stored at `~/.config/calendar-mcp/encryption-key.txt`.

---

## Authentication

On first run, the server opens a browser window for Google OAuth2 authorization.

1. Start the server with your credentials
2. Visit `http://localhost:3500` (or your configured `OAUTH_PORT`)
3. Sign in with your Google account and grant calendar access
4. Tokens are saved locally and refreshed automatically

Tokens are encrypted at rest using AES-256-GCM. The token file is stored at `~/.config/calendar-mcp/tokens.json` with `0o600` file permissions.

---

## Available Tools

| Tool | Description | Annotations |
|------|-------------|-------------|
| `list_events` | List events with optional filtering by time range and max results | Read-only |
| `get_event` | Get single event details | Read-only |
| `create_event` | Create a new event (supports all-day and timed) | — |
| `update_event` | Partial update of an existing event | — |
| `delete_event` | Delete an event | Destructive |
| `list_event_instances` | Expand a recurring event into individual instances | Read-only |
| `create_recurring_event` | Create a recurring event with RRULE | — |
| `query_free_busy` | Query availability across up to 50 calendars | Read-only |
| `list_calendars` | List all calendars in the user account | Read-only |
| `get_calendar` | Get single calendar details | Read-only |
| `subscribe_calendar` | Subscribe to push notifications (7-day expiry) | — |
| `unsubscribe_calendar` | Unsubscribe from push notifications | Destructive |
| `list_subscriptions` | List active webhook subscriptions | Read-only |
| `search_events` | Full-text search events in a calendar | Read-only |
| `get_current_time` | Get current server time with timezone context | Read-only |

---

## Transport Modes

The server supports three transport modes via the `--transport` flag.

### Stdio (for Claude Desktop, Cursor, and other MCP clients)

```bash
calendar-mcp --transport stdio
```

Add to your MCP client configuration (e.g., Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "calendar": {
      "command": "calendar-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### HTTP/SSE (for remote clients and webhook reception)

```bash
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy calendar-mcp --transport http
```

### Both (default)

```bash
calendar-mcp --transport both
```

### CLI options

```bash
calendar-mcp --help
```

Output:

```
Google Calendar MCP Server

Usage: calendar-mcp [options]

Options:
  --transport <mode>  Transport mode: stdio, http, or both (default: both)
  --help              Show this help message
  --version           Show version number

Environment Variables:
  GOOGLE_CLIENT_ID            Google OAuth2 client ID (required)
  GOOGLE_CLIENT_SECRET        Google OAuth2 client secret (required)
  HTTP_PORT                   HTTP server port (default: 3000)
  OAUTH_PORT                  OAuth callback port (default: 3500)
  CALENDAR_MCP_ENCRYPTION_KEY Encryption key for token storage (optional)
```

---

## HTTP Endpoints (HTTP mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | `GET` | SSE stream for MCP connection (default) |
| `/sse` | `GET` | SSE stream for MCP connection (Odysseus AI compatible) |
| `/messages` | `POST` | MCP message handler |
| `/webhooks/google-calendar` | `POST` | Google Calendar push notifications |
| `/health` | `GET` | Health check |

---

## Docker Deployment

### Build and run

```bash
docker build -t calendar-mcp .
docker run \
  -e GOOGLE_CLIENT_ID=xxx \
  -e GOOGLE_CLIENT_SECRET=yyy \
  -p 3000:3000 \
  -p 3500:3500 \
  calendar-mcp
```

### Docker Compose

```bash
# Set env vars in .env file or export them
export GOOGLE_CLIENT_ID=xxx
export GOOGLE_CLIENT_SECRET=yyy

# Ports are configurable via HTTP_PORT and OAUTH_PORT env vars
docker compose up -d
```

The compose file mounts `~/.config/calendar-mcp` as a volume so tokens persist across container restarts.

---

## Webhook Setup

Google Calendar push notifications let you receive real-time updates when events change.

1. Ensure the server runs in HTTP or both mode
2. Use the `subscribe_calendar` tool to register a webhook
3. Google sends a sync notification first, then change notifications to `/webhooks/google-calendar`
4. Subscriptions expire after 7 days; re-subscribe before expiry
5. Use `list_subscriptions` to see active channels and `unsubscribe_calendar` to remove them

**Requirements for public webhooks:**

The server must be reachable from the internet. Set the webhook address in your Google Cloud Console OAuth2 credentials to your public URL (e.g., `https://your-domain.com/webhooks/google-calendar`).

---

## Security

- **AES-256-GCM encrypted token storage** with authenticated encryption
- **Token store** at `~/.config/calendar-mcp/tokens.json` with `0o600` permissions
- **OAuth2 refresh token rotation** supported by the Google Auth Library
- **DNS rebinding protection** on HTTP transport (only `localhost`, `127.0.0.1`, `::1` allowed as Host header)
- **X-Goog-Channel-Token validation** for webhook requests
- **No plaintext token logging** anywhere in the application

---

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/calendar-mcp.git
cd calendar-mcp

# Install dependencies
npm install

# Run tests (20 test suites)
npm test

# Build the project
npm run build

# Run the dev server with hot reload
npm run dev

# Lint
npm run lint
```

---

## License

ISC

export interface Config {
  googleClientId: string;
  googleClientSecret: string;
  httpPort: number;
  oauthPort: number;
  encryptionKey?: string;
  transport: 'stdio' | 'http' | 'both';
  allowedHosts?: string[];
}

function parseAllowedHosts(): string[] | undefined {
  const raw = process.env.MCP_ALLOWED_HOSTS;
  if (!raw) return undefined;
  return raw.split(',').map((h) => h.trim());
}

export function loadConfig(): Config {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    throw new Error(
      'Missing required environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
    );
  }

  return {
    googleClientId,
    googleClientSecret,
    httpPort: Number(process.env.HTTP_PORT) || 3000,
    oauthPort: Number(process.env.OAUTH_PORT) || 3500,
    encryptionKey: process.env.CALENDAR_MCP_ENCRYPTION_KEY,
    transport: parseTransport(process.argv),
    allowedHosts: parseAllowedHosts(),
  };
}

function parseTransport(argv: string[]): 'stdio' | 'http' | 'both' {
  const transportIndex = argv.findIndex((arg) => arg === '--transport');
  if (transportIndex !== -1 && argv[transportIndex + 1]) {
    const value = argv[transportIndex + 1];
    if (value === 'stdio' || value === 'http' || value === 'both') {
      return value;
    }
  }
  return 'both';
}

export function printHelp(): void {
  console.log(`
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
  MCP_ALLOWED_HOSTS           Comma-separated allowed hosts for HTTP transport (optional)
                                When unset, all hosts are allowed. Example: localhost,192.168.1.1
`);
}

export function printVersion(): void {
  console.log('1.0.0');
}

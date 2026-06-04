import { describe, it, expect, vi } from 'vitest';
import { loadConfig, printHelp, printVersion } from '../config.js';

describe('Config', () => {
  const originalEnv = process.env;
  const originalArgv = process.argv;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should load config from env vars', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.HTTP_PORT = '8080';
    process.env.OAUTH_PORT = '8081';

    const config = loadConfig();

    expect(config.googleClientId).toBe('test-client-id');
    expect(config.googleClientSecret).toBe('test-client-secret');
    expect(config.httpPort).toBe(8080);
    expect(config.oauthPort).toBe(8081);
  });

  it('should use default ports', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const config = loadConfig();

    expect(config.httpPort).toBe(3000);
    expect(config.oauthPort).toBe(3500);
  });

  it('should throw when required env vars missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(() => loadConfig()).toThrow('GOOGLE_CLIENT_ID');
  });

  it('should parse transport from args', () => {
    process.env.GOOGLE_CLIENT_ID = 'test';
    process.env.GOOGLE_CLIENT_SECRET = 'test';

    process.argv = ['node', 'index.js', '--transport', 'stdio'];

    const config = loadConfig();
    expect(config.transport).toBe('stdio');
  });

  it('should print help', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should print version', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printVersion();
    expect(consoleSpy).toHaveBeenCalledWith('1.0.0');
  });
});

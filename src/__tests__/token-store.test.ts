import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateKey,
  encryptToken,
  decryptToken,
  saveTokens,
  loadTokens,
  clearTokens,
  getOrCreateKey,
} from '../auth/token-store.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    chmodSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

describe('token-store', () => {
  const mockConfigDir = path.join(os.homedir(), '.config', 'calendar-mcp');
  const mockTokenFile = path.join(mockConfigDir, 'tokens.json');
  const mockKeyFile = path.join(mockConfigDir, 'encryption-key.txt');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('CALENDAR_MCP_ENCRYPTION_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('generateKey', () => {
    it('should generate a 32-byte key', () => {
      const key = generateKey();
      expect(key.length).toBe(32);
    });
  });

  describe('getOrCreateKey', () => {
    it('should use env var when provided', () => {
      const envKey = 'a'.repeat(64);
      vi.stubEnv('CALENDAR_MCP_ENCRYPTION_KEY', envKey);
      const key = getOrCreateKey();
      expect(key.toString('hex')).toBe(envKey);
    });

    it('should use provided key when given', () => {
      const providedKey = 'b'.repeat(64);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const key = getOrCreateKey(providedKey);
      expect(key.toString('hex')).toBe(providedKey);
    });

    it('should read existing key file', () => {
      const existingKey = 'c'.repeat(64);
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === mockKeyFile) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(existingKey);
      const key = getOrCreateKey();
      expect(key.toString('hex')).toBe(existingKey);
      expect(fs.chmodSync).toHaveBeenCalledWith(mockKeyFile, 0o600);
    });

    it('should generate and save new key if none exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const key = getOrCreateKey();
      expect(key.length).toBe(32);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(writeArgs[1]).toBe(key.toString('hex'));
    });
  });

  describe('encryptToken / decryptToken', () => {
    it('should encrypt and decrypt token correctly', () => {
      const key = generateKey();
      const token = JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh' });
      const encrypted = encryptToken(token, key);

      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);

      const decrypted = decryptToken(encrypted, key);
      expect(decrypted).toBe(token);
    });

    it('should produce different ciphertexts for same token', () => {
      const key = generateKey();
      const token = 'same-token';
      const encrypted1 = encryptToken(token, key);
      const encrypted2 = encryptToken(token, key);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  describe('saveTokens / loadTokens / clearTokens', () => {
    it('should save tokens with correct file permissions', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => p === mockTokenFile);
      const encrypted = { iv: 'iv', authTag: 'tag', ciphertext: 'cipher' };
      saveTokens(encrypted);

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(mockTokenFile, JSON.stringify(encrypted), { mode: 0o600 });
      expect(fs.chmodSync).toHaveBeenCalledWith(mockTokenFile, 0o600);
    });

    it('should load saved tokens', () => {
      const encrypted = { iv: 'iv', authTag: 'tag', ciphertext: 'cipher' };
      vi.mocked(fs.existsSync).mockImplementation((p) => p === mockTokenFile);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(encrypted));
      const loaded = loadTokens();
      expect(loaded).toEqual(encrypted);
      expect(fs.chmodSync).toHaveBeenCalledWith(mockTokenFile, 0o600);
    });

    it('should return null when no tokens exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const loaded = loadTokens();
      expect(loaded).toBeNull();
    });

    it('should clear tokens', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      clearTokens();
      expect(fs.rmSync).toHaveBeenCalledWith(mockTokenFile);
    });

    it('should not throw when clearing non-existent tokens', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(() => clearTokens()).not.toThrow();
    });
  });
});

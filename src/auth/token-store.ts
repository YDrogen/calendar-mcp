import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'calendar-mcp');
const TOKEN_FILE = join(CONFIG_DIR, 'tokens.json');
const KEY_FILE = join(CONFIG_DIR, 'encryption-key.txt');

export interface EncryptedToken {
  iv: string;
  authTag: string;
  ciphertext: string;
}

function getConfigDir(): string {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  return CONFIG_DIR;
}

function ensureFilePermission(path: string, mode: number): void {
  if (existsSync(path)) {
    chmodSync(path, mode);
  }
}

export function generateKey(): Buffer {
  return randomBytes(32);
}

export function getOrCreateKey(providedKey?: string): Buffer {
  const envKey = process.env.CALENDAR_MCP_ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }

  if (providedKey) {
    return Buffer.from(providedKey, 'hex');
  }

  getConfigDir();

  if (existsSync(KEY_FILE)) {
    ensureFilePermission(KEY_FILE, 0o600);
    const keyHex = readFileSync(KEY_FILE, 'utf-8').trim();
    return Buffer.from(keyHex, 'hex');
  }

  const key = generateKey();
  writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  ensureFilePermission(KEY_FILE, 0o600);
  return key;
}

export function encryptToken(token: string, key: Buffer): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm' as CipherGCMTypes, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

export function decryptToken(encrypted: EncryptedToken, key: Buffer): string {
  const decipher = createDecipheriv(
    'aes-256-gcm' as CipherGCMTypes,
    key,
    Buffer.from(encrypted.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf-8');
}

export function saveTokens(tokens: EncryptedToken, _key?: string): void {
  getConfigDir();
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 });
  ensureFilePermission(TOKEN_FILE, 0o600);
}

export function loadTokens(_key?: string): EncryptedToken | null {
  if (!existsSync(TOKEN_FILE)) {
    return null;
  }
  ensureFilePermission(TOKEN_FILE, 0o600);
  const data = readFileSync(TOKEN_FILE, 'utf-8');
  return JSON.parse(data) as EncryptedToken;
}

export function clearTokens(): void {
  if (existsSync(TOKEN_FILE)) {
    rmSync(TOKEN_FILE);
  }
}

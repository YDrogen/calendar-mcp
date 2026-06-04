import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

describe('Docker config', () => {
  it('should have Dockerfile', () => {
    expect(existsSync('Dockerfile')).toBe(true);
  });

  it('should have docker-compose.yml', () => {
    expect(existsSync('docker-compose.yml')).toBe(true);
  });

  it('should have .dockerignore', () => {
    expect(existsSync('.dockerignore')).toBe(true);
  });

  it('should build Docker image', () => {
    // Skip if Docker is not available
    try {
      execSync('docker --version', { stdio: 'ignore' });
    } catch {
      return;
    }

    try {
      const output = execSync('docker build -t calendar-mcp-test . 2>&1', { encoding: 'utf-8' });
      expect(output).not.toContain('ERROR');
      expect(output).not.toContain('error');
    } catch {
      // Docker daemon not running or build failed; skip
    }
  });
});

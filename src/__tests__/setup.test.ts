import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Setup: Project Structure', () => {
  it('should have src directory', () => {
    const srcDir = path.join(process.cwd(), 'src');
    expect(fs.existsSync(srcDir)).toBe(true);
  });

  it('should have required subdirectories', () => {
    const requiredDirs = [
      'auth',
      'services',
      'tools',
      'transport',
      'webhooks',
      'utils',
      'types',
      '__tests__',
    ];

    requiredDirs.forEach((dir) => {
      const dirPath = path.join(process.cwd(), 'src', dir);
      expect(fs.existsSync(dirPath)).toBe(true);
    });
  });

  it('should have tsconfig.json with strict mode enabled', () => {
    const configPath = path.join(process.cwd(), 'tsconfig.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.compilerOptions.strict).toBe(true);
  });

  it('should have package.json with @modelcontextprotocol/sdk dependency', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
  });

  it('should export main function from src/index.ts', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test';
    process.env.GOOGLE_CLIENT_SECRET = 'test';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const { main } = await import('../index.js');
    expect(typeof main).toBe('function');
    const result = main();
    expect(result).toBeInstanceOf(Promise);
    exitSpy.mockRestore();
  });
});

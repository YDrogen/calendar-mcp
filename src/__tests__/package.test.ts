import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Package config', () => {
  it('should include dist files in npm pack', () => {
    const output = execSync('npm pack --dry-run 2>&1', { encoding: 'utf-8' });
    expect(output).toContain('dist/index.js');
    expect(output).toContain('dist/index.d.ts');
    expect(output).not.toContain('src/');
    expect(output).not.toContain('__tests__/');
  });
});

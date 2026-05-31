import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');

describe('CI workflow baseline gates', () => {
  it('defines pull_request and push triggers', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('on:');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('push:');
  });

  it('uses deterministic pnpm install and baseline quality gates', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm lint');
    expect(workflow).toContain('pnpm typecheck');
    expect(workflow).toContain('pnpm build');
  });

  it('wires policy-gates for permission and header checks', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('policy-gates');
    expect(workflow).toContain('pnpm policy:permissions');
    expect(workflow).toContain('pnpm policy:headers');
  });

  it('exposes explicit browser lanes for Chrome, Firefox, and Edge', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('build-chrome');
    expect(workflow).toContain('build-firefox');
    expect(workflow).toContain('build-edge');
  });
});

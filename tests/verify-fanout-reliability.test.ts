import { describe, expect, it } from 'vitest';
import { findFanoutReliabilityViolations } from '../scripts/verify-fanout-reliability.js';

describe('findFanoutReliabilityViolations', () => {
  it('returns [] when all release-critical fanout patterns are present', () => {
    const violations = findFanoutReliabilityViolations([
      {
        path: 'src/features/workspace-shell/workspace-shell.tsx',
        content: [
          'export const COLUMN_DISPATCH_TIMEOUT_MS = 10_000;',
          "dispatch({ type: 'resolveColumnDispatch' });",
          "dispatch({ type: 'retryColumnDispatch' });",
          '<div role="alert">Provider failed</div>',
        ].join('\n'),
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('returns violation when COLUMN_DISPATCH_TIMEOUT_MS is absent', () => {
    const violations = findFanoutReliabilityViolations([
      {
        path: 'src/features/workspace-shell/workspace-shell.tsx',
        content: [
          "dispatch({ type: 'resolveColumnDispatch' });",
          "dispatch({ type: 'retryColumnDispatch' });",
          '<div role="alert">Provider failed</div>',
        ].join('\n'),
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('COLUMN_DISPATCH_TIMEOUT_MS'),
      }),
    );
  });

  it('returns violation when resolveColumnDispatch is absent', () => {
    const violations = findFanoutReliabilityViolations([
      {
        path: 'src/features/workspace-shell/workspace-shell.tsx',
        content: [
          'export const COLUMN_DISPATCH_TIMEOUT_MS = 10_000;',
          "dispatch({ type: 'retryColumnDispatch' });",
          '<div role="alert">Provider failed</div>',
        ].join('\n'),
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('resolveColumnDispatch'),
      }),
    );
  });

  it('returns violation when retryColumnDispatch is absent', () => {
    const violations = findFanoutReliabilityViolations([
      {
        path: 'src/features/workspace-shell/workspace-shell.tsx',
        content: [
          'export const COLUMN_DISPATCH_TIMEOUT_MS = 10_000;',
          "dispatch({ type: 'resolveColumnDispatch' });",
          '<div role="alert">Provider failed</div>',
        ].join('\n'),
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('retryColumnDispatch'),
      }),
    );
  });

  it('returns violation when role="alert" error UI is absent', () => {
    const violations = findFanoutReliabilityViolations([
      {
        path: 'src/features/workspace-shell/workspace-shell.tsx',
        content: [
          'export const COLUMN_DISPATCH_TIMEOUT_MS = 10_000;',
          "dispatch({ type: 'resolveColumnDispatch' });",
          "dispatch({ type: 'retryColumnDispatch' });",
        ].join('\n'),
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('role="alert"'),
      }),
    );
  });
});

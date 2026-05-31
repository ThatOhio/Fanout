import { describe, expect, it } from 'vitest';
import { findBroadPermissionViolations } from '../scripts/verify-permissions';

describe('verify-permissions policy guard', () => {
  it('returns no violations for narrow host patterns', () => {
    const violations = findBroadPermissionViolations([
      {
        path: 'safe-manifest.json',
        content: '{"host_permissions":["https://example.com/*"]}',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('flags <all_urls> host scope expansions', () => {
    const violations = findBroadPermissionViolations([
      {
        path: 'manifest.json',
        content: '{"host_permissions":["<all_urls>"]}',
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        path: 'manifest.json',
        pattern: '<all_urls>',
      }),
    );
  });

  it('flags wildcard host scope patterns', () => {
    const violations = findBroadPermissionViolations([
      {
        path: 'permissions.ts',
        content: 'const host = "*://*/*";',
      },
      {
        path: 'permissions-https.ts',
        content: 'const host = "https://*/*";',
      },
    ]);

    expect(violations).toHaveLength(2);
  });
});

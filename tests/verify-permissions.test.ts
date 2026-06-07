import { describe, expect, it } from 'vitest';
import {
  findBroadPermissionViolations,
  findUnmappedPermissions,
} from '../scripts/verify-permissions';

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

  it('flags broad http wildcard host scope', () => {
    const violations = findBroadPermissionViolations([
      {
        path: 'permissions-http.ts',
        content: 'const host = "http://*/*";',
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        path: 'permissions-http.ts',
        pattern: 'http://*/*',
      }),
    );
  });
});

describe('findUnmappedPermissions rationale coverage guard', () => {
  it('returns no violations when all permissions are documented', () => {
    const violations = findUnmappedPermissions(
      `permissions: ['webNavigation', 'tabs']`,
      `## webNavigation\n\nsome rationale\n\n## tabs\n\nsome rationale`,
    );
    expect(violations).toEqual([]);
  });

  it('returns a violation for each undocumented permission', () => {
    const violations = findUnmappedPermissions(
      `permissions: ['webNavigation', 'unlisted']`,
      `## webNavigation\n\nsome rationale`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].permission).toBe('unlisted');
  });

  it('returns no violations when no permissions array is declared', () => {
    const violations = findUnmappedPermissions(
      `export default defineConfig({ modules: [] })`,
      `## webNavigation\n\nsome rationale`,
    );
    expect(violations).toEqual([]);
  });

  it('handles multiple permissions where some are mapped and some are not', () => {
    const violations = findUnmappedPermissions(
      `permissions: ['webNavigation', 'tabs', 'missing']`,
      `## webNavigation\n\nrationale\n\n## tabs\n\nrationale`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].permission).toBe('missing');
  });
});

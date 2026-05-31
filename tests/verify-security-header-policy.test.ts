import { describe, expect, it } from 'vitest';
import { findSecurityHeaderPolicyViolations } from '../scripts/verify-security-header-policy';

describe('verify-security-header-policy guard', () => {
  it('returns no violations for non-header-modification code', () => {
    const violations = findSecurityHeaderPolicyViolations([
      {
        path: 'safe-background.ts',
        content: 'console.log("safe");',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('allows bare header name references without tampering context', () => {
    const violations = findSecurityHeaderPolicyViolations([
      {
        path: 'docs.ts',
        content: '// Document content-security-policy behavior for reviewers.',
      },
      {
        path: 'rules.ts',
        content: 'import { declarativeNetRequest } from "webextension-polyfill";',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('flags global response header modification hooks', () => {
    const violations = findSecurityHeaderPolicyViolations([
      {
        path: 'background.ts',
        content:
          'browser.webRequest.onHeadersReceived.addListener(() => ({ responseHeaders: [] }), { urls: ["<all_urls>"] });',
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        path: 'background.ts',
        pattern: 'webRequest.onHeadersReceived',
      }),
    );
  });

  it('flags explicit CSP stripping attempts', () => {
    const violations = findSecurityHeaderPolicyViolations([
      {
        path: 'headers.ts',
        content: 'headers = headers.filter((h) => h.name !== "content-security-policy");',
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        path: 'headers.ts',
        pattern: 'content-security-policy tampering',
      }),
    );
  });

  it('flags strict-transport-security stripping attempts', () => {
    const violations = findSecurityHeaderPolicyViolations([
      {
        path: 'headers.ts',
        content: 'headers = headers.filter((h) => h.name !== "strict-transport-security");',
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        path: 'headers.ts',
        pattern: 'strict-transport-security tampering',
      }),
    );
  });

  it('flags declarativeNetRequest header modification', () => {
    const violations = findSecurityHeaderPolicyViolations([
      {
        path: 'rules.ts',
        content:
          'declarativeNetRequest.updateDynamicRules({ addRules: [{ action: { type: "modifyHeaders", responseHeaders: [{ header: "content-security-policy", operation: "remove" }] } }] });',
      },
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        path: 'rules.ts',
        pattern: 'declarativeNetRequest header modification',
      }),
    );
  });
});

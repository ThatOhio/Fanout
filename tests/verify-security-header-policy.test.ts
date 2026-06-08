import { describe, expect, it } from 'vitest';
import {
  findSecurityHeaderPolicyViolations,
  findUndocumentedJsonHeaderOverrides,
} from '../scripts/verify-security-header-policy';

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

describe('findUndocumentedJsonHeaderOverrides', () => {
  const ruleFileContent = JSON.stringify([
    {
      id: 1,
      action: { type: 'modifyHeaders', responseHeaders: [{ header: 'x-frame-options', operation: 'remove' }] },
      condition: { requestDomains: ['www.google.com'], resourceTypes: ['sub_frame'] },
    },
  ]);

  it('returns no violations when no JSON files modify headers', () => {
    const overrides = findUndocumentedJsonHeaderOverrides(
      [
        { path: 'public/manifest.json', content: '{"name":"fanout"}' },
        { path: 'src/index.ts', content: 'console.log("safe");' },
      ],
      '',
    );

    expect(overrides).toEqual([]);
  });

  it('returns no violations when a header-modifying JSON file has registered overrides', () => {
    const overridesDoc = [
      '## google',
      'removes x-frame-options for www.google.com',
    ].join('\n');

    const overrides = findUndocumentedJsonHeaderOverrides(
      [{ path: 'public/rules/compatibility-rules.json', content: ruleFileContent }],
      overridesDoc,
    );

    expect(overrides).toEqual([]);
  });

  it('flags when a JSON domain is missing from the overrides doc', () => {
    const multiDomainRules = JSON.stringify([
      {
        id: 1,
        action: { type: 'modifyHeaders', responseHeaders: [{ header: 'x-frame-options', operation: 'remove' }] },
        condition: {
          requestDomains: ['www.google.com', 'duckduckgo.com'],
          resourceTypes: ['sub_frame'],
        },
      },
    ]);

    const overridesDoc = [
      '## google',
      'removes x-frame-options for www.google.com',
      '## duckduckgo',
      'override registered but domain string omitted from prose',
    ].join('\n');

    const overrides = findUndocumentedJsonHeaderOverrides(
      [{ path: 'public/rules/compatibility-rules.json', content: multiDomainRules }],
      overridesDoc,
    );

    expect(overrides).toContainEqual(
      expect.objectContaining({
        path: 'public/rules/compatibility-rules.json',
        message: expect.stringContaining('duckduckgo.com'),
      }),
    );
  });

  it('flags when registered override count is lower than JSON domain count', () => {
    const multiDomainRules = JSON.stringify([
      {
        id: 1,
        action: { type: 'modifyHeaders', responseHeaders: [{ header: 'x-frame-options', operation: 'remove' }] },
        condition: {
          requestDomains: ['www.google.com', 'duckduckgo.com'],
          resourceTypes: ['sub_frame'],
        },
      },
    ]);

    const overridesDoc = ['## google', 'removes x-frame-options for www.google.com'].join('\n');

    const overrides = findUndocumentedJsonHeaderOverrides(
      [{ path: 'public/rules/compatibility-rules.json', content: multiDomainRules }],
      overridesDoc,
    );

    expect(overrides).toContainEqual(
      expect.objectContaining({
        path: 'public/rules/compatibility-rules.json',
        message: expect.stringContaining('only registers 1'),
      }),
    );
  });

  it('flags a header-modifying JSON file when no overrides are registered', () => {
    const overrides = findUndocumentedJsonHeaderOverrides(
      [{ path: 'public/rules/compatibility-rules.json', content: ruleFileContent }],
      '# Compatibility overrides\n\nNo entries yet.',
    );

    expect(overrides).toContainEqual(
      expect.objectContaining({
        path: 'public/rules/compatibility-rules.json',
        message: expect.stringContaining('compatibility-overrides.md'),
      }),
    );
  });

  it('treats an absent overrides doc as no registered entries', () => {
    const overrides = findUndocumentedJsonHeaderOverrides(
      [{ path: 'public/rules/compatibility-rules.json', content: ruleFileContent }],
      '',
    );

    expect(overrides).toHaveLength(1);
  });
});

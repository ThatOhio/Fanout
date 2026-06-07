import { describe, expect, it, vi } from 'vitest';

// The polyfill throws when imported outside an extension context; stub the
// side-effect import so the pure routing logic can be unit-tested in jsdom.
vi.mock('webextension-polyfill', () => ({}));

import { shouldInterceptNavigation } from '../entrypoints/background';

const FANOUT_NEWTAB_URL = 'chrome-extension://abc123/newtab.html';

describe('shouldInterceptNavigation', () => {
  it('does not intercept when the feature is disabled', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=hello', FANOUT_NEWTAB_URL, false),
    ).toEqual({ intercept: false });
  });

  it('intercepts a recognized search-engine navigation and returns the query', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=hello+world', FANOUT_NEWTAB_URL, true),
    ).toEqual({ intercept: true, query: 'hello world' });
  });

  it('never intercepts the Fanout newtab page itself (redirect-loop prevention)', () => {
    expect(
      shouldInterceptNavigation(`${FANOUT_NEWTAB_URL}?q=hello`, FANOUT_NEWTAB_URL, true),
    ).toEqual({ intercept: false });
  });

  it('passes through when the typed query is itself an explicit URL (AC3)', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=example.com', FANOUT_NEWTAB_URL, true),
    ).toEqual({ intercept: false });
  });

  it('passes through when the typed query is a hostname with port (AC3)', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=example.com%3A8080', FANOUT_NEWTAB_URL, true),
    ).toEqual({ intercept: false });
  });

  it('does not intercept a direct navigation to an explicit URL', () => {
    // Direct URL navigation never matches a search-engine host, so it is not a
    // recognized search URL and must pass through.
    expect(shouldInterceptNavigation('https://example.com', FANOUT_NEWTAB_URL, true)).toEqual({
      intercept: false,
    });
  });

  it('does not intercept unrecognized search engines', () => {
    expect(
      shouldInterceptNavigation('https://yahoo.com/search?q=hello', FANOUT_NEWTAB_URL, true),
    ).toEqual({ intercept: false });
  });

  it('does not intercept a known engine URL without a query value', () => {
    expect(shouldInterceptNavigation('https://www.google.com/', FANOUT_NEWTAB_URL, true)).toEqual({
      intercept: false,
    });
  });
});

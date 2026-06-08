import { beforeEach, describe, expect, it, vi } from 'vitest';

// The polyfill throws when imported outside an extension context; stub the
// side-effect import so the pure routing logic can be unit-tested in jsdom.
vi.mock('webextension-polyfill', () => ({}));

import { openOrFocusWorkspaceTab, shouldInterceptNavigation } from '../entrypoints/background';

const FANOUT_WORKSPACE_URL = 'chrome-extension://abc123/workspace.html';

type MockTab = { id?: number; windowId?: number };

function createTabsApi(overrides: {
  queryResult?: MockTab[];
  queryError?: Error;
  updateError?: Error;
  windowUpdateError?: Error;
  createError?: Error;
} = {}) {
  const createdUrls: string[] = [];
  const activatedTabIds: number[] = [];
  const focusedWindowIds: number[] = [];

  const tabsApi = {
    query: vi.fn(async () => {
      if (overrides.queryError) {
        throw overrides.queryError;
      }
      return overrides.queryResult ?? [];
    }),
    update: vi.fn(async (tabId: number) => {
      if (overrides.updateError) {
        throw overrides.updateError;
      }
      activatedTabIds.push(tabId);
    }),
    create: vi.fn(async ({ url }: { url: string }) => {
      if (overrides.createError) {
        throw overrides.createError;
      }
      createdUrls.push(url);
      return { id: 99 };
    }),
  };

  const windowsApi = {
    update: vi.fn(async (windowId: number) => {
      if (overrides.windowUpdateError) {
        throw overrides.windowUpdateError;
      }
      focusedWindowIds.push(windowId);
    }),
  };

  return { tabsApi, windowsApi, createdUrls, activatedTabIds, focusedWindowIds };
}

describe('shouldInterceptNavigation', () => {
  it('does not intercept when the feature is disabled', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=hello', FANOUT_WORKSPACE_URL, false),
    ).toEqual({ intercept: false });
  });

  it('intercepts a recognized search-engine navigation and returns the query', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=hello+world', FANOUT_WORKSPACE_URL, true),
    ).toEqual({ intercept: true, query: 'hello world' });
  });

  it('never intercepts the Fanout workspace page itself (redirect-loop prevention)', () => {
    expect(
      shouldInterceptNavigation(`${FANOUT_WORKSPACE_URL}?q=hello`, FANOUT_WORKSPACE_URL, true),
    ).toEqual({ intercept: false });
  });

  it('passes through when the typed query is itself an explicit URL (AC3)', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=example.com', FANOUT_WORKSPACE_URL, true),
    ).toEqual({ intercept: false });
  });

  it('passes through when the typed query is a hostname with port (AC3)', () => {
    expect(
      shouldInterceptNavigation('https://www.google.com/search?q=example.com%3A8080', FANOUT_WORKSPACE_URL, true),
    ).toEqual({ intercept: false });
  });

  it('does not intercept a direct navigation to an explicit URL', () => {
    // Direct URL navigation never matches a search-engine host, so it is not a
    // recognized search URL and must pass through.
    expect(shouldInterceptNavigation('https://example.com', FANOUT_WORKSPACE_URL, true)).toEqual({
      intercept: false,
    });
  });

  it('does not intercept unrecognized search engines', () => {
    expect(
      shouldInterceptNavigation('https://yahoo.com/search?q=hello', FANOUT_WORKSPACE_URL, true),
    ).toEqual({ intercept: false });
  });

  it('does not intercept a known engine URL without a query value', () => {
    expect(shouldInterceptNavigation('https://www.google.com/', FANOUT_WORKSPACE_URL, true)).toEqual({
      intercept: false,
    });
  });
});

describe('openOrFocusWorkspaceTab', () => {
  beforeEach(() => {
    vi.stubGlobal('browser', {
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://abc123${path}`),
      },
    });
  });

  it('focuses an existing workspace tab instead of creating a new one', async () => {
    const { tabsApi, windowsApi, createdUrls, activatedTabIds, focusedWindowIds } = createTabsApi({
      queryResult: [{ id: 7, windowId: 3 }],
    });

    vi.stubGlobal('browser', {
      runtime: { getURL: vi.fn(() => FANOUT_WORKSPACE_URL) },
      windows: windowsApi,
    });

    await openOrFocusWorkspaceTab(tabsApi);

    expect(tabsApi.query).toHaveBeenCalledWith({ url: `${FANOUT_WORKSPACE_URL}*` });
    expect(activatedTabIds).toEqual([7]);
    expect(focusedWindowIds).toEqual([3]);
    expect(createdUrls).toEqual([]);
  });

  it('creates a workspace tab when none is open', async () => {
    const { tabsApi, createdUrls, activatedTabIds } = createTabsApi({ queryResult: [] });

    vi.stubGlobal('browser', {
      runtime: { getURL: vi.fn(() => FANOUT_WORKSPACE_URL) },
    });

    await openOrFocusWorkspaceTab(tabsApi);

    expect(createdUrls).toEqual([FANOUT_WORKSPACE_URL]);
    expect(activatedTabIds).toEqual([]);
  });

  it('falls back to create when tabs.query throws', async () => {
    const { tabsApi, createdUrls } = createTabsApi({ queryError: new Error('query failed') });

    vi.stubGlobal('browser', {
      runtime: { getURL: vi.fn(() => FANOUT_WORKSPACE_URL) },
    });

    await openOrFocusWorkspaceTab(tabsApi);

    expect(createdUrls).toEqual([FANOUT_WORKSPACE_URL]);
  });

  it('does not create a second tab when window focus fails after tab activation', async () => {
    const { tabsApi, windowsApi, createdUrls, activatedTabIds } = createTabsApi({
      queryResult: [{ id: 7, windowId: 3 }],
      windowUpdateError: new Error('window focus failed'),
    });

    vi.stubGlobal('browser', {
      runtime: { getURL: vi.fn(() => FANOUT_WORKSPACE_URL) },
      windows: windowsApi,
    });

    await openOrFocusWorkspaceTab(tabsApi);

    expect(activatedTabIds).toEqual([7]);
    expect(createdUrls).toEqual([]);
  });
});

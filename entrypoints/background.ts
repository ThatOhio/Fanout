import 'webextension-polyfill';
import { defineBackground } from 'wxt/utils/define-background';
import {
  KNOWN_SEARCH_HOSTNAMES,
  extractSearchQuery,
  isExplicitUrl,
} from '../src/features/workspace-shell/url-detection';
import { loadWorkspacePreferences } from '../src/features/workspace-shell/workspace-preferences-storage';

/**
 * Decides whether a navigation should be intercepted and routed to Fanout.
 * Kept out of the event handler so it can be unit-tested without mocking the
 * browser APIs.
 */
export function shouldInterceptNavigation(
  navigationUrl: string,
  fanoutWorkspaceUrl: string,
  replaceAddressBarSearch: boolean,
): { intercept: false } | { intercept: true; query: string } {
  if (!replaceAddressBarSearch) {
    return { intercept: false };
  }

  // Never intercept Fanout's own workspace page (redirect loop prevention).
  if (navigationUrl.startsWith(fanoutWorkspaceUrl)) {
    return { intercept: false };
  }

  // The navigation URL here is always a recognized search-engine URL (the
  // webNavigation filter only fires for those hosts). Pull the user's typed
  // text out of it, bail if it isn't actually a search URL with a query.
  const query = extractSearchQuery(navigationUrl);
  if (!query) {
    return { intercept: false };
  }

  // If the typed text is itself an explicit URL (e.g. the user typed
  // "example.com" and the browser still routed it through the search engine),
  // pass through so normal URL navigation is preserved (AC3).
  if (isExplicitUrl(query)) {
    return { intercept: false };
  }

  return { intercept: true, query };
}

const navigationGenerationByTab = new Map<number, number>();

function setupAddressBarRouting() {
  // Bail out if these APIs aren't available at runtime.
  const runtimeBrowser = browser as typeof browser & {
    webNavigation?: typeof browser.webNavigation;
    tabs?: typeof browser.tabs;
  };
  const webNav = runtimeBrowser.webNavigation;
  const tabsApi = runtimeBrowser.tabs;
  if (!webNav?.onBeforeNavigate || !tabsApi?.update) {
    return;
  }

  webNav.onBeforeNavigate.addListener(
    async (details) => {
      // Top-level navigations only, skip iframes.
      if (details.frameId !== 0) {
        return;
      }

      const generation = (navigationGenerationByTab.get(details.tabId) ?? 0) + 1;
      navigationGenerationByTab.set(details.tabId, generation);

      try {
        const fanoutWorkspaceUrl = browser.runtime.getURL('/workspace.html');
        const { preferences } = await loadWorkspacePreferences();
        const result = shouldInterceptNavigation(
          details.url,
          fanoutWorkspaceUrl,
          preferences.settings.replaceAddressBarSearch,
        );

        if (!result.intercept) {
          return;
        }

        if (navigationGenerationByTab.get(details.tabId) !== generation) {
          return;
        }

        await tabsApi.update(details.tabId, {
          url: `${fanoutWorkspaceUrl}?q=${encodeURIComponent(result.query)}`,
        });
      } catch {
        return;
      }
    },
    {
      url: KNOWN_SEARCH_HOSTNAMES.map((host) => ({ hostEquals: host })),
    },
  );
}

type ToolbarAction = {
  onClicked?: { addListener: (callback: () => void) => void };
};

type MinimalTabsApi = {
  query: (queryInfo: Record<string, unknown>) => Promise<Array<{ id?: number; windowId?: number }>>;
  create: (createProperties: { url: string }) => Promise<unknown>;
  update: (tabId: number, updateProperties: Record<string, unknown>) => Promise<unknown>;
};

// Focus an existing Fanout workspace tab if one is open, otherwise open a new
// one. Keeps clicking the toolbar icon from piling up duplicate tabs.
async function openOrFocusWorkspaceTab(tabsApi: MinimalTabsApi): Promise<void> {
  const workspaceUrl = browser.runtime.getURL('/workspace.html');

  try {
    const existingTabs = await tabsApi.query({ url: `${workspaceUrl}*` });
    const match = existingTabs.find((tab) => typeof tab.id === 'number');

    if (match && typeof match.id === 'number') {
      await tabsApi.update(match.id, { active: true });
      const windows = (browser as typeof browser & { windows?: { update?: (id: number, info: Record<string, unknown>) => Promise<unknown> } }).windows;
      if (typeof match.windowId === 'number' && windows?.update) {
        await windows.update(match.windowId, { focused: true });
      }
      return;
    }

    await tabsApi.create({ url: workspaceUrl });
  } catch {
    try {
      await tabsApi.create({ url: workspaceUrl });
    } catch {
      // Nothing more we can do; opening the workspace is best-effort.
    }
  }
}

function setupToolbarLauncher() {
  // MV3 exposes browser.action, MV2 (Firefox) exposes browser.browserAction.
  const runtimeBrowser = browser as typeof browser & {
    action?: ToolbarAction;
    browserAction?: ToolbarAction;
    tabs?: MinimalTabsApi;
  };
  const action = runtimeBrowser.action ?? runtimeBrowser.browserAction;
  const tabsApi = runtimeBrowser.tabs;
  if (!action?.onClicked || !tabsApi) {
    return;
  }

  action.onClicked.addListener(() => {
    void openOrFocusWorkspaceTab(tabsApi);
  });
}

export default defineBackground(() => {
  setupAddressBarRouting();
  setupToolbarLauncher();
});

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
  fanoutNewtabUrl: string,
  replaceAddressBarSearch: boolean,
): { intercept: false } | { intercept: true; query: string } {
  if (!replaceAddressBarSearch) {
    return { intercept: false };
  }

  // Never intercept Fanout's own newtab page (redirect loop prevention).
  if (navigationUrl.startsWith(fanoutNewtabUrl)) {
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
        const fanoutNewtabUrl = browser.runtime.getURL('/newtab.html');
        const { preferences } = await loadWorkspacePreferences();
        const result = shouldInterceptNavigation(
          details.url,
          fanoutNewtabUrl,
          preferences.settings.replaceAddressBarSearch,
        );

        if (!result.intercept) {
          return;
        }

        if (navigationGenerationByTab.get(details.tabId) !== generation) {
          return;
        }

        await tabsApi.update(details.tabId, {
          url: `${fanoutNewtabUrl}?q=${encodeURIComponent(result.query)}`,
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

export default defineBackground(() => {
  setupAddressBarRouting();
});

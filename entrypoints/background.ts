import 'webextension-polyfill';
import { defineBackground } from 'wxt/utils/define-background';
import {
  KNOWN_SEARCH_HOSTNAMES,
  extractSearchQuery,
  isExplicitUrl,
} from '../src/features/workspace-shell/url-detection';
import { loadWorkspacePreferences } from '../src/features/workspace-shell/workspace-preferences-storage';

// TODO: Add 'webNavigation' and 'tabs' to wxt.config.ts manifest permissions
// after the permission rationale is documented and approved in future 
// Until then, setupAddressBarRouting() is a no-op at runtime
// because browser.webNavigation is undefined without the permission.

/**
 * Pure decision function: determines whether a navigation should be intercepted
 * and routed to Fanout. Single authority for the intercept decision so the event
 * handler stays thin and the logic is unit-testable without browser API mocks.
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

function setupAddressBarRouting() {
  // Feature-detect: only active once webNavigation/tabs permissions are granted (Story 3.1).
  const runtimeBrowser = browser as typeof browser & {
    webNavigation?: typeof browser.webNavigation;
  };
  const webNav = runtimeBrowser.webNavigation;
  if (!webNav?.onBeforeNavigate) {
    return;
  }

  webNav.onBeforeNavigate.addListener(
    async (details) => {
      // Top-level navigations only — never intercept iframe navigation.
      if (details.frameId !== 0) {
        return;
      }

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

      await browser.tabs.update(details.tabId, {
        url: `${fanoutNewtabUrl}?q=${encodeURIComponent(result.query)}`,
      });
    },
    {
      url: KNOWN_SEARCH_HOSTNAMES.map((host) => ({ hostEquals: host })),
    },
  );
}

export default defineBackground(() => {
  setupAddressBarRouting();
});

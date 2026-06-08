import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Don't auto-launch a browser in dev. It fails to connect on some setups; load
  // the built output from .output/<target> as a temporary add-on instead.
  webExt: { disabled: true },
  manifest: {
    // No default_popup: clicking the toolbar icon opens the Fanout workspace in a
    // tab (handled by the action.onClicked listener in the background script).
    action: { default_title: 'Fanout' },
    permissions: ['storage', 'declarativeNetRequest', 'webNavigation', 'tabs'],
    host_permissions: [
      'https://www.google.com/*',
      'https://duckduckgo.com/*',
      'https://search.brave.com/*',
      'https://www.bing.com/*',
    ],
    declarative_net_request: {
      rule_resources: [
        { id: 'compatibility-rules', enabled: true, path: 'rules/compatibility-rules.json' },
      ],
    },
  },
});

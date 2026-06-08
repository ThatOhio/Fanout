# Permissions

This is where I write down every permission Fanout asks for and why, so anyone looking at the extension can see what it's able to do without reading through the code.

Fanout asks for as little as possible. The only host permissions it declares are the four search providers it renders in columns (Google, DuckDuckGo, Brave, Bing), and they're used for one thing: removing the `X-Frame-Options` header so those pages can load in their column. It can't read or change any other site you visit. The one feature beyond the search columns that needs more than the basics is the optional address-bar search, and that's off until you turn it on.

There's a check wired into CI so this file stays in sync with the manifest. `pnpm policy:check` runs `scripts/verify-permissions.js`, which pulls the `permissions` array out of the WXT config and makes sure each one has a matching `##` heading here. If I add a permission and forget to explain it, the build fails. A permission's heading should be only the permission name, like `## webNavigation`. Anything more detailed goes under `###`.

To add a permission: write the section here, add it to the manifest, then run `pnpm policy:check`.

## storage

This is how Fanout remembers your setup between sessions. It saves your workspace preferences (column count, the provider picked per column, dark mode, and the address-bar search toggle) with `storage.local`, and reads them back when the workspace page or the background script needs them.

It's `storage.local`, so everything stays on this machine. Nothing is synced to an account and nothing leaves the browser. The background script reads the same local data to know whether you've turned on address-bar search before deciding what to do with a navigation.

No host permissions are involved, and it only ever touches Fanout's own preference key.

Behaves the same on Chrome, Firefox, and Edge.

## webNavigation

This is for the optional "replace address bar search" feature. With it on, Fanout notices when you navigate to one of the common search engines, grabs what you typed, and runs it across all your columns instead of a single engine. The listener is in `entrypoints/background.ts` and only fires for the hosts in `KNOWN_SEARCH_HOSTNAMES`, not every page you load.

It's off by default. The decision function returns `{ intercept: false }` unless `replaceAddressBarSearch` is set, which only happens once you opt in from settings (Story 1.7 has the disclosure).

It doesn't need any host permissions. The `onBeforeNavigate` listener has an explicit `hostEquals` filter and only reads the URL. It never injects scripts or touches page content.

Behaves the same on Chrome (MV3), Firefox, and Edge.

## tabs

Fanout uses `tabs` for two things, both pointed at its own pages.

First, the toolbar button. Clicking the Fanout icon opens the workspace in a tab, or focuses it if it's already open. That's `tabs.query` to find an existing workspace tab plus `tabs.create`/`tabs.update` to open or focus it.

Second, the optional address-bar search. When that's on and Fanout intercepts a search, it points the active tab at its own workspace page with the query attached, via `tabs.update(tabId, { url: ... })`. This half only does anything once you opt in.

None of this needs host permissions. `tabs.update` and `tabs.create` can point a tab at one of the extension's own pages without them, and the `tabs.query` filter only matches Fanout's own workspace URL. It never reads page contents or queries tabs across other origins.

Behaves the same on Chrome, Firefox, and Edge.

## declarativeNetRequest

This is what makes the columns actually show results. Each column embeds a search provider in an `<iframe>`, but Google, DuckDuckGo, Brave, and Bing all send `X-Frame-Options` response headers that stop their pages from being framed by another origin. Without this, every column fails on a real query and times out. So Fanout ships a static rule that removes the `x-frame-options` header for those four provider responses, which lets the frames load.

The rule lives in `public/rules/compatibility-rules.json` and is declared in `wxt.config.ts`. It's a static `declarativeNetRequest` ruleset, not a runtime listener, so Fanout never sees the request or response bodies. It only strips one header.

### Scope

The rule is scoped as tightly as I could make it. It matches only the four provider request domains (`www.google.com`, `duckduckgo.com`, `search.brave.com`, `www.bing.com`) and only `sub_frame` requests, which is what an iframe loads as. Top-level navigations (`main_frame`) are left alone, so opening a provider directly in a tab is unaffected. For all four it removes `x-frame-options`. DuckDuckGo and Brave also block framing with a `Content-Security-Policy: frame-ancestors` directive, so for those two domains it also removes `content-security-policy` (the whole header, since a single directive can't be dropped). Google and Bing keep their CSP. Nothing else is added or rewritten, there's no global header stripping, and there's no `webRequest.onHeadersReceived` hook anywhere in the codebase.

Every override here is also logged in `compatibility-overrides.md` at the repo root, and `pnpm policy:headers` fails the build if a header-modifying rule file isn't registered there.

### Host permissions

Removing response headers for those domains needs matching `host_permissions`: `https://www.google.com/*`, `https://duckduckgo.com/*`, `https://search.brave.com/*`, `https://www.bing.com/*`. These are exact provider hosts, not wildcards over all sites. They'll show up in the browser's permission prompt when you install Fanout. Note that `host_permissions` is a separate manifest field from `permissions`, so the rationale coverage check doesn't scan it. I'm documenting it here as part of this permission instead of as its own heading.

### Consent and activation

This one isn't opt-in. Seeing search results in columns is the core of what Fanout does, so the rule is always on. It still only ever affects the four provider domains.

### Cross-browser notes

Chrome and Edge get native `declarativeNetRequest` on MV3. For Firefox, WXT generates an MV2 manifest and moves the `host_permissions` entries into the `permissions` array; Firefox has supported `declarativeNetRequest` since Gecko 93. No browser-specific branching is needed in `wxt.config.ts`.

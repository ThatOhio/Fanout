# Permissions

This is where I write down every permission Fanout asks for and why, so anyone looking at the extension can see what it's able to do without reading through the code.

Fanout asks for as little as possible. It declares no host permissions, so it can't read or change the pages you visit. The one feature that needs more than the basics is the optional address-bar search, and that's off until you turn it on.

There's a check wired into CI so this file stays in sync with the manifest. `pnpm policy:check` runs `scripts/verify-permissions.js`, which pulls the `permissions` array out of the WXT config and makes sure each one has a matching `##` heading here. If I add a permission and forget to explain it, the build fails. A permission's heading should be only the permission name, like `## webNavigation`. Anything more detailed goes under `###`.

To add a permission: write the section here, add it to the manifest, then run `pnpm policy:check`.

## webNavigation

This is for the optional "replace address bar search" feature. With it on, Fanout notices when you navigate to one of the common search engines, grabs what you typed, and runs it across all your columns instead of a single engine. The listener is in `entrypoints/background.ts` and only fires for the hosts in `KNOWN_SEARCH_HOSTNAMES`, not every page you load.

It's off by default. The decision function returns `{ intercept: false }` unless `replaceAddressBarSearch` is set, which only happens once you opt in from settings (Story 1.7 has the disclosure).

It doesn't need any host permissions. The `onBeforeNavigate` listener has an explicit `hostEquals` filter and only reads the URL. It never injects scripts or touches page content.

Behaves the same on Chrome (MV3), Firefox, and Edge.

## tabs

This is the other half of that feature. When Fanout decides to intercept a search, it sends the active tab to its own newtab page with the query attached, via `tabs.update(tabId, { url: ... })`. That's the only thing it uses `tabs` for.

It's behind the same opt-in as `webNavigation`, so nothing happens unless you've enabled it.

`tabs.update` doesn't need host permissions to point a tab at one of the extension's own pages, and that's all it does. It doesn't read tab contents or query tabs across origins.

Behaves the same on Chrome, Firefox, and Edge.

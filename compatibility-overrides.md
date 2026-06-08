# Compatibility overrides

This is the list of every security-header change Fanout makes so search providers will render in the columns. If there's a header-modifying rule in the codebase that isn't written down here, `pnpm policy:headers` fails the build, so no header gets touched without a reason sitting next to the code.

The rule I hold myself to is that any header change has to be narrow and justified: scoped to a named provider domain, limited to what's needed to make that provider render, and never applied globally. This file is where the justification lives, and CI makes sure it stays in sync with the actual rules.

Every provider that needs an override has its own `## <slug>` section below. The slug is the key the CI check reads, so it has to be a single word or hyphenated. When I add an override I put the rule in `public/rules/compatibility-rules.json`, write a section here saying what it changes and why, then run `pnpm policy:headers`.

### How results are rendered

Each column embeds a provider in an `<iframe>` pointed at its search URL (see `buildSearchProviderUrl` in `src/features/workspace-shell/workspace-shell.tsx`). All four providers send `X-Frame-Options` headers that block cross-origin framing, so without an override every column fails on a real query and times out after 10 seconds.

I looked at two non-iframe options before going with header removal. Opening each provider in a real tab (using the `tabs` permission we already have) and showing a "loaded in tab" state per column doesn't give you the side-by-side view, which is the point of Fanout. Building structured previews from a content script means writing parsing for each provider and still doesn't show the live result page. A static `declarativeNetRequest` rule that removes one header for four named domains is the smallest change that keeps the side-by-side view, so that's what I did.

Most providers only need `x-frame-options` removed. DuckDuckGo and Brave also send a `Content-Security-Policy: frame-ancestors` directive that blocks framing on its own, so they get a second rule that removes `content-security-policy` for just those two domains. `declarativeNetRequest` can't drop a single CSP directive, only the whole header, so the whole header comes off for those two and nothing else. Google and Bing keep their CSP. No `strict-transport-security` header gets touched, and nothing is changed globally.

### No host header overrides baseline

There's no `webRequest.onHeadersReceived` listener and no global header stripping anywhere in Fanout. Every change is a static `declarativeNetRequest` rule in `public/rules/compatibility-rules.json`, scoped to the exact provider domains and `sub_frame` requests. The rule never sees request or response bodies.

## google

`www.google.com`. Google's results send `X-Frame-Options: SAMEORIGIN`, which blocks embedding in a cross-origin iframe. The shared rule removes the `x-frame-options` response header for `www.google.com`, on `sub_frame` requests only. Nothing else is touched, and top-level navigations are left alone. Active.

## duckduckgo

`duckduckgo.com`. DuckDuckGo blocks framing two ways, with `X-Frame-Options` and with `Content-Security-Policy: frame-ancestors 'self' https://html.duckduckgo.com`. Removing `x-frame-options` on its own wasn't enough in testing, the CSP directive still blocked the frame. So one rule removes `x-frame-options` and another removes `content-security-policy`, both scoped to `duckduckgo.com` and `sub_frame` only. The whole CSP header comes off because a single directive can't be removed. Nothing else changes. Active.

## brave-search

`search.brave.com`. Brave blocks framing two ways too, with `X-Frame-Options` and with `Content-Security-Policy: frame-ancestors 'self'`. Removing `x-frame-options` alone wasn't enough in testing. One rule removes `x-frame-options` and another removes `content-security-policy`, both scoped to `search.brave.com` and `sub_frame` only. The whole CSP header comes off for the same reason as DuckDuckGo. Nothing else changes. Active.

## bing

`www.bing.com`. Bing sends `X-Frame-Options: SAMEORIGIN`, which blocks cross-origin embedding. The shared rule removes `x-frame-options` for `www.bing.com`, on `sub_frame` requests only. Nothing else is touched. Active.

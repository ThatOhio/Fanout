# Fanout
Search several engines side by side in one tab. It asks for as few permissions as it can and doesn't track you.

## Local Development Setup

1. Initialize from the starter template:
   - `pnpm dlx wxt@latest init fanout --template react --pm pnpm`
2. Move scaffold output from `fanout/` into the repository root.
3. Install dependencies:
   - `pnpm approve-builds --all`
   - `pnpm install`

## Development Commands

- `pnpm dev`
- `pnpm dev:firefox`
- `pnpm dev:edge`
- `pnpm build`
- `pnpm build:firefox`
- `pnpm build:edge`
- `pnpm zip`
- `pnpm zip:firefox`
- `pnpm zip:edge`
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm policy:check`

## Verification

- `pnpm compile` — TypeScript check
- `pnpm typecheck` — stable CI typecheck alias
- `pnpm lint` — ESLint checks for `entrypoints/`, `src/`, `tests/`, and `scripts/`
- `pnpm test` — unit and smoke tests
- `pnpm build && pnpm build:firefox && pnpm build:edge` — cross-browser build matrix
- `pnpm policy:permissions` — fails on broad host permission patterns (for example `<all_urls>`)
- `pnpm policy:headers` — fails on global security-header tampering patterns

## CI Gates

- Pull requests and pushes run `.github/workflows/ci.yml`.
- Required baseline checks: lint, typecheck, test, and build.
- Browser builds: `build-chrome`, `build-firefox`, and `build-edge`.
- Policy gates block merge when broad permissions or global header-weakening patterns are introduced.

## Permissions

If you're reviewing what this extension can actually do, start with [`permissions-rationale.md`](./permissions-rationale.md) in the repo root. It lists every permission Fanout declares and why. A CI check (`pnpm policy:permissions`) fails the build if a manifest permission isn't documented there.

The short version is that Fanout keeps its access as small as it can:

- No host permissions, so it can't read or change the pages you visit.
- `webNavigation` and `tabs` are declared in `wxt.config.ts`, both for the opt-in address-bar search feature, and both are written up in `permissions-rationale.md`.
- The policy checks block broad host patterns (`<all_urls>`, `*://*/*`, `http(s)://*/*`) and any attempt to weaken security headers like CSP or HSTS.
- If a permission or header exception ever turns out to be necessary, it has to be documented with a reason before it can merge.

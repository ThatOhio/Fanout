# Fanout
Search multiple engines side by side in a single tab. Privacy-respecting, minimal permissions, no tracking.

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

## Permission Rationale

Fanout follows a least-privilege posture. Policy checks enforce the following baseline rules:

- **Broad host scope is blocked** — patterns such as `<all_urls>`, `*://*/*`, and `http(s)://*/*` fail CI unless explicitly approved and documented in a future policy exception process.
- **Header tampering is blocked** — global `webRequest.onHeadersReceived` hooks and header strip/modify patterns (for example CSP or HSTS removal) fail CI.
- **Current scaffold scope** — the WXT starter uses default extension permissions only; no broad host permissions are declared in `wxt.config.ts` at this stage.
- **Audit trail** — permission or header-policy exceptions must be documented in this section with rationale before merge approval.

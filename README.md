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
- `pnpm lint` — baseline repository lint checks
- `pnpm test` — unit and smoke tests
- `pnpm build && pnpm build:firefox && pnpm build:edge` — cross-browser build matrix
- `pnpm policy:permissions` — fails on broad host permission patterns (for example `<all_urls>`)
- `pnpm policy:headers` — fails on global security-header tampering patterns

## CI Gates

- Pull requests and pushes run `.github/workflows/ci.yml`.
- Required baseline checks: lint, typecheck, test, and build.
- Browser builds: `build-chrome`, `build-firefox`, and `build-edge`.
- Policy gates block merge when broad permissions or global header-weakening patterns are introduced. These were the primary reason I set out to create my own plugin in the first place, so starting off with them heavily enforced from day 1. 

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

## Verification

- `pnpm compile` — TypeScript check
- `pnpm test` — unit and smoke tests
- `pnpm build && pnpm build:firefox && pnpm build:edge` — cross-browser build matrix

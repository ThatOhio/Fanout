import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // TODO: Add manifest `permissions: ['webNavigation', 'tabs']` here after the
  // permission rationale is documented/approved in future
  // Address-bar routing (entrypoints/background.ts) stays inert until then.
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceShell } from './workspace-shell';

describe('WorkspaceShell', () => {
  it('renders persistent top command bar and search default mode', () => {
    const markup = renderToStaticMarkup(<WorkspaceShell />);

    expect(markup).toContain('aria-label="Shared query"');
    expect(markup).toContain('Search');
    expect(markup).toContain('Column 1 Placeholder');
  });
});

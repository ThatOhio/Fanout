import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceShell } from './workspace-shell';

describe('WorkspaceShell', () => {
  it('renders persistent top command bar and search default mode', () => {
    const markup = renderToStaticMarkup(<WorkspaceShell />);

    expect(markup).toContain('data-testid="command-bar"');
    expect(markup).toContain('aria-label="Shared query"');
    expect(markup).toContain('aria-label="Mode"');
    expect(markup).toContain('Search');
    expect(markup).toContain('AI');
    expect(markup).toContain('mode-toggle-active');
    expect(markup).toContain('aria-label="Column count controls"');
    expect(markup).toContain('Columns: <strong>2</strong>');
    expect(markup).toContain('aria-label="Open settings"');
    expect(markup).toContain('Column 1 Placeholder');
    expect(markup).not.toContain('Column 3 Placeholder');
  });
});

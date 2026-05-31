import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  COLUMN_COUNTS,
  WorkspaceShell,
  workspaceShellReducer,
  type WorkspaceShellState,
} from './workspace-shell';

const baseState: WorkspaceShellState = {
  columnCount: 2,
  commandInput: '',
};

describe('WorkspaceShell', () => {
  it('renders persistent top command bar and search-only workspace', () => {
    const markup = renderToStaticMarkup(<WorkspaceShell />);

    expect(markup).toContain('data-testid="command-bar"');
    expect(markup).toContain('aria-label="Shared query"');
    expect(markup).toContain('Mode: <strong>Search</strong>');
    expect(markup).toContain('aria-label="Column count controls"');
    expect(markup).toContain('Columns: <strong>2</strong>');
    expect(markup).toContain('aria-label="Open settings"');
    expect(markup).toContain('Column 1 Placeholder');
    expect(markup).not.toContain('Column 3 Placeholder');
  });

  it('exposes active state for each column control', () => {
    const markup = renderToStaticMarkup(<WorkspaceShell />);

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
  });

  it('keeps deterministic 2/3/4 layout control transitions', () => {
    const nextFrom3 = workspaceShellReducer(baseState, {
      type: 'setColumnCount',
      columnCount: 3,
    });
    const nextFrom4 = workspaceShellReducer(nextFrom3, {
      type: 'setColumnCount',
      columnCount: 4,
    });
    const backTo2 = workspaceShellReducer(nextFrom4, {
      type: 'setColumnCount',
      columnCount: 2,
    });

    expect(COLUMN_COUNTS).toEqual([2, 3, 4]);
    expect(nextFrom3.columnCount).toBe(3);
    expect(nextFrom4.columnCount).toBe(4);
    expect(backTo2.columnCount).toBe(2);
  });

  it('preserves shared input across 2->3->4->2 transitions', () => {
    const withInput = workspaceShellReducer(baseState, {
      type: 'setCommandInput',
      commandInput: 'best coffee beans',
    });
    const at3 = workspaceShellReducer(withInput, {
      type: 'setColumnCount',
      columnCount: 3,
    });
    const at4 = workspaceShellReducer(at3, {
      type: 'setColumnCount',
      columnCount: 4,
    });
    const backTo2 = workspaceShellReducer(at4, {
      type: 'setColumnCount',
      columnCount: 2,
    });

    expect(at3.commandInput).toBe('best coffee beans');
    expect(at4.commandInput).toBe('best coffee beans');
    expect(backTo2.commandInput).toBe('best coffee beans');
  });

  it('renders placeholder count based on active column count', () => {
    const twoColumnState = workspaceShellReducer(baseState, {
      type: 'setColumnCount',
      columnCount: 2,
    });
    const threeColumnState = workspaceShellReducer(baseState, {
      type: 'setColumnCount',
      columnCount: 3,
    });
    const fourColumnState = workspaceShellReducer(baseState, {
      type: 'setColumnCount',
      columnCount: 4,
    });

    const twoColumnMarkup = renderToStaticMarkup(<WorkspaceShell initialState={twoColumnState} />);
    const threeColumnMarkup = renderToStaticMarkup(<WorkspaceShell initialState={threeColumnState} />);
    const fourColumnMarkup = renderToStaticMarkup(<WorkspaceShell initialState={fourColumnState} />);

    expect((twoColumnMarkup.match(/Placeholder/g) ?? []).length).toBe(2);
    expect((threeColumnMarkup.match(/Placeholder/g) ?? []).length).toBe(3);
    expect((fourColumnMarkup.match(/Placeholder/g) ?? []).length).toBe(4);
  });
});

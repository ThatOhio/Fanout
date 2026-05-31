import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  COLUMN_COUNTS,
  SEARCH_PROVIDERS,
  WorkspaceShell,
  workspaceShellReducer,
  buildDefaultProvidersByColumn,
  type WorkspaceShellState,
} from './workspace-shell';

const baseState: WorkspaceShellState = {
  columnCount: 2,
  commandInput: '',
  providersByColumn: buildDefaultProvidersByColumn(),
};

function getDisplayedColumnCount() {
  const statusLine = screen.getByText(/Mode:/).closest('p');
  expect(statusLine).not.toBeNull();
  return within(statusLine as HTMLElement).getAllByRole('strong')[1];
}

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

  it('defines the provider set as google, duckduckgo, brave, and bing', () => {
    expect(SEARCH_PROVIDERS).toEqual(['google', 'duckduckgo', 'brave', 'bing']);
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

  it('updates only the targeted column provider in reducer state', () => {
    const nextState = workspaceShellReducer(baseState, {
      type: 'setColumnProvider',
      columnIndex: 2,
      provider: 'bing',
    });

    expect(nextState.providersByColumn[1]).toBe('google');
    expect(nextState.providersByColumn[2]).toBe('bing');
    expect(nextState.providersByColumn[3]).toBe('brave');
    expect(nextState.providersByColumn[4]).toBe('bing');
  });

  it('preserves active column provider selections through 2->3->4->2 transitions', () => {
    const updatedColumnOne = workspaceShellReducer(baseState, {
      type: 'setColumnProvider',
      columnIndex: 1,
      provider: 'duckduckgo',
    });
    const updatedColumnTwo = workspaceShellReducer(updatedColumnOne, {
      type: 'setColumnProvider',
      columnIndex: 2,
      provider: 'brave',
    });
    const at3 = workspaceShellReducer(updatedColumnTwo, {
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

    expect(backTo2.providersByColumn[1]).toBe('duckduckgo');
    expect(backTo2.providersByColumn[2]).toBe('brave');
    expect(backTo2.providersByColumn[3]).toBe('brave');
    expect(backTo2.providersByColumn[4]).toBe('bing');
  });

  describe('interaction', () => {
    it('reflows workspace immediately when a column control is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      expect(getDisplayedColumnCount()).toHaveTextContent('2');
      expect(screen.queryByText('Column 3 Placeholder')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '3' }));

      expect(getDisplayedColumnCount()).toHaveTextContent('3');
      expect(screen.getByText('Column 3 Placeholder')).toBeInTheDocument();
      expect(screen.getAllByText(/Placeholder/)).toHaveLength(3);
    });

    it('updates aria-pressed on the active column control after layout changes', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: '4' }));

      expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('preserves shared input across 2->3->4->2 layout clicks', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      const input = screen.getByRole('textbox', { name: 'Shared query' });
      await user.type(input, 'best coffee beans');

      await user.click(screen.getByRole('button', { name: '3' }));
      await user.click(screen.getByRole('button', { name: '4' }));
      await user.click(screen.getByRole('button', { name: '2' }));

      expect(input).toHaveValue('best coffee beans');
    });

    it('renders one provider dropdown per active column with explicit labels', () => {
      render(<WorkspaceShell />);

      const selectors = screen.getAllByRole('combobox');
      expect(selectors).toHaveLength(2);
      expect(screen.getByRole('combobox', { name: 'Column 1 provider' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Column 2 provider' })).toBeInTheDocument();
    });

    it('changes only the targeted column provider selection', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      const columnOneProvider = screen.getByRole('combobox', { name: 'Column 1 provider' });
      const columnTwoProvider = screen.getByRole('combobox', { name: 'Column 2 provider' });

      expect(columnOneProvider).toHaveValue('google');
      expect(columnTwoProvider).toHaveValue('duckduckgo');

      await user.selectOptions(columnTwoProvider, 'bing');

      expect(columnOneProvider).toHaveValue('google');
      expect(columnTwoProvider).toHaveValue('bing');
    });

    it('keeps provider selections for surviving columns across 2->3->4->2 layout clicks', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      const columnOneProvider = screen.getByRole('combobox', { name: 'Column 1 provider' });
      const columnTwoProvider = screen.getByRole('combobox', { name: 'Column 2 provider' });
      await user.selectOptions(columnOneProvider, 'duckduckgo');
      await user.selectOptions(columnTwoProvider, 'brave');

      await user.click(screen.getByRole('button', { name: '3' }));
      await user.click(screen.getByRole('button', { name: '4' }));
      await user.click(screen.getByRole('button', { name: '2' }));

      expect(screen.getByRole('combobox', { name: 'Column 1 provider' })).toHaveValue('duckduckgo');
      expect(screen.getByRole('combobox', { name: 'Column 2 provider' })).toHaveValue('brave');
    });
  });
});

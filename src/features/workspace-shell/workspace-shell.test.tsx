import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  COLUMN_COUNTS,
  SEARCH_PROVIDERS,
  WorkspaceShell,
  WORKSPACE_HYDRATION_TIMEOUT_MS,
  buildSearchProviderUrl,
  workspaceShellReducer,
  buildDefaultProvidersByColumn,
  type WorkspaceShellState,
} from './workspace-shell';

const baseState: WorkspaceShellState = {
  columnCount: 2,
  commandInput: '',
  providersByColumn: buildDefaultProvidersByColumn(),
  settings: {
    darkMode: true,
    replaceNewTab: false,
    replaceAddressBarSearch: false,
  },
  isSettingsOpen: false,
  dispatchByColumn: {},
  routingError: null,
};

function getDisplayedColumnCount() {
  const statusLine = screen.getByText(/Columns:/).closest('p');
  expect(statusLine).not.toBeNull();
  return within(statusLine as HTMLElement).getByRole('strong');
}

type BrowserStorageLocalMock = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function installBrowserStorageLocalMock(mock: BrowserStorageLocalMock) {
  const runtimeGlobal = globalThis as typeof globalThis & {
    browser?: {
      storage: {
        local: BrowserStorageLocalMock;
      };
    };
  };

  runtimeGlobal.browser = {
    storage: {
      local: mock,
    },
  };
}

function clearBrowserStorageLocalMock() {
  const runtimeGlobal = globalThis as typeof globalThis & {
    browser?: unknown;
  };
  delete runtimeGlobal.browser;
}

function createDefaultBrowserStorageLocalMock(): BrowserStorageLocalMock {
  return {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WorkspaceShell', () => {
  beforeEach(() => {
    vi.useRealTimers();
    installBrowserStorageLocalMock(createDefaultBrowserStorageLocalMock());
  });

  afterEach(() => {
    vi.useRealTimers();
    clearBrowserStorageLocalMock();
  });

  it('renders persistent top command bar and search-only workspace', () => {
    const markup = renderToStaticMarkup(<WorkspaceShell />);

    expect(markup).toContain('data-testid="command-bar"');
    expect(markup).toContain('aria-label="Shared query"');
    expect(markup).not.toContain('Mode:');
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

  it('builds provider-specific URLs with encoded query text', () => {
    expect(buildSearchProviderUrl('google', 'best coffee')).toBe('https://www.google.com/search?q=best%20coffee');
    expect(buildSearchProviderUrl('duckduckgo', 'best coffee')).toBe('https://duckduckgo.com/?q=best%20coffee');
    expect(buildSearchProviderUrl('brave', 'best coffee')).toBe('https://search.brave.com/search?q=best%20coffee');
    expect(buildSearchProviderUrl('bing', 'best coffee')).toBe('https://www.bing.com/search?q=best%20coffee');
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

    expect((twoColumnMarkup.match(/Column [0-9] Placeholder/g) ?? []).length).toBe(2);
    expect((threeColumnMarkup.match(/Column [0-9] Placeholder/g) ?? []).length).toBe(3);
    expect((fourColumnMarkup.match(/Column [0-9] Placeholder/g) ?? []).length).toBe(4);
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

  it('ignores invalid setColumnProvider actions in reducer state', () => {
    const invalidIndex = workspaceShellReducer(baseState, {
      type: 'setColumnProvider',
      columnIndex: 0,
      provider: 'bing',
    });
    const invalidProvider = workspaceShellReducer(baseState, {
      type: 'setColumnProvider',
      columnIndex: 1,
      provider: 'yahoo' as WorkspaceShellState['providersByColumn'][number],
    });

    expect(invalidIndex).toBe(baseState);
    expect(invalidProvider).toBe(baseState);
  });

  it('repairs invalid provider values when column count changes', () => {
    const invalidState: WorkspaceShellState = {
      ...baseState,
      providersByColumn: {
        ...buildDefaultProvidersByColumn(),
        1: 'invalid' as WorkspaceShellState['providersByColumn'][number],
      },
    };

    const nextState = workspaceShellReducer(invalidState, {
      type: 'setColumnCount',
      columnCount: 2,
    });

    expect(nextState.providersByColumn[1]).toBe('google');
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

  it('ignores whitespace-only submitQuery actions in reducer state', () => {
    const nextState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: '   ',
      requestId: 'request-1',
    });

    expect(nextState).toBe(baseState);
  });

  it('ignores stale requestId resolution for a column dispatch', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'best coffee beans',
      requestId: 'request-1',
    });
    const staleResolution = workspaceShellReducer(pendingState, {
      type: 'resolveColumnDispatch',
      columnIndex: 1,
      requestId: 'request-stale',
      status: 'success',
    });

    expect(staleResolution.dispatchByColumn[1]?.status).toBe('pending');
  });

  it('rejects resolveColumnDispatch when column is no longer pending', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'best coffee beans',
      requestId: 'request-1',
    });
    const erroredState = workspaceShellReducer(pendingState, {
      type: 'resolveColumnDispatch',
      columnIndex: 1,
      requestId: 'request-1',
      status: 'error',
      errorMessage: 'Timed out.',
    });
    const lateSuccess = workspaceShellReducer(erroredState, {
      type: 'resolveColumnDispatch',
      columnIndex: 1,
      requestId: 'request-1',
      status: 'success',
    });

    expect(lateSuccess.dispatchByColumn[1]?.status).toBe('error');
  });

  it('restarts only the targeted column when provider changes during pending dispatch', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'best coffee beans',
      requestId: 'request-1',
    });
    const restartedState = workspaceShellReducer(pendingState, {
      type: 'setColumnProvider',
      columnIndex: 1,
      provider: 'bing',
      requestId: 'request-2',
    });

    expect(restartedState.dispatchByColumn[1]).toMatchObject({
      status: 'pending',
      provider: 'bing',
      requestId: 'request-2',
      query: 'best coffee beans',
    });
    expect(restartedState.dispatchByColumn[2]).toMatchObject({
      status: 'pending',
      requestId: 'request-1',
    });
  });

  it('does not retry a column that is not in error state', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'best coffee beans',
      requestId: 'request-1',
    });
    const retriedState = workspaceShellReducer(pendingState, {
      type: 'retryColumnDispatch',
      columnIndex: 1,
      requestId: 'request-2',
    });

    expect(retriedState).toBe(pendingState);
  });

  it('clears dispatch state for columns above the active column count on submit', () => {
    const withHiddenColumn = workspaceShellReducer(
      {
        ...baseState,
        columnCount: 3,
        dispatchByColumn: {
          1: {
            status: 'success',
            query: 'old query',
            provider: 'google',
            requestId: 'request-old',
            pendingStartedAt: 0,
          },
          2: {
            status: 'success',
            query: 'old query',
            provider: 'duckduckgo',
            requestId: 'request-old',
            pendingStartedAt: 0,
          },
          3: {
            status: 'success',
            query: 'old query',
            provider: 'brave',
            requestId: 'request-old',
            pendingStartedAt: 0,
          },
        },
      },
      {
        type: 'setColumnCount',
        columnCount: 2,
      },
    );

    expect(withHiddenColumn.dispatchByColumn[3]).toBeUndefined();

    const resubmitted = workspaceShellReducer(withHiddenColumn, {
      type: 'submitQuery',
      query: 'new query',
      requestId: 'request-new',
    });

    expect(resubmitted.dispatchByColumn[3]).toBeUndefined();
    expect(resubmitted.dispatchByColumn[1]?.query).toBe('new query');
  });

  it('fans out a submit action to all active columns with isolated pending state', () => {
    const nextState = workspaceShellReducer(
      {
        ...baseState,
        columnCount: 3,
      },
      {
        type: 'submitQuery',
        query: 'best coffee beans',
        requestId: 'request-1',
      },
    );

    expect(nextState.dispatchByColumn[1]).toMatchObject({
      status: 'pending',
      query: 'best coffee beans',
      provider: 'google',
      requestId: 'request-1',
    });
    expect(nextState.dispatchByColumn[2]).toMatchObject({
      status: 'pending',
      query: 'best coffee beans',
      provider: 'duckduckgo',
      requestId: 'request-1',
    });
    expect(nextState.dispatchByColumn[3]).toMatchObject({
      status: 'pending',
      query: 'best coffee beans',
      provider: 'brave',
      requestId: 'request-1',
    });
    expect(nextState.dispatchByColumn[4]).toBeUndefined();
  });

  it('keeps sibling dispatch state isolated during status resolution', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'best coffee beans',
      requestId: 'request-1',
    });
    const resolvedState = workspaceShellReducer(pendingState, {
      type: 'resolveColumnDispatch',
      columnIndex: 1,
      requestId: 'request-1',
      status: 'success',
    });

    expect(resolvedState.dispatchByColumn[1]?.status).toBe('success');
    expect(resolvedState.dispatchByColumn[2]?.status).toBe('pending');
  });

  it('retries only the targeted error column', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'best coffee beans',
      requestId: 'request-1',
    });
    const erroredState = workspaceShellReducer(pendingState, {
      type: 'resolveColumnDispatch',
      columnIndex: 1,
      requestId: 'request-1',
      status: 'error',
      errorMessage: 'Column timed out.',
    });
    const retriedState = workspaceShellReducer(erroredState, {
      type: 'retryColumnDispatch',
      columnIndex: 1,
      requestId: 'request-2',
    });

    expect(retriedState.dispatchByColumn[1]).toMatchObject({
      status: 'pending',
      requestId: 'request-2',
      query: 'best coffee beans',
    });
    expect(retriedState.dispatchByColumn[2]?.status).toBe('pending');
  });

  it('hydratePreferences applies settings without clearing in-flight dispatch state', () => {
    const pendingState = workspaceShellReducer(baseState, {
      type: 'submitQuery',
      query: 'edge case query',
      requestId: 'request-hydrate',
    });

    const hydratedState = workspaceShellReducer(pendingState, {
      type: 'hydratePreferences',
      preferences: {
        columnCount: 3,
        providersByColumn: {
          1: 'bing',
          2: 'google',
          3: 'duckduckgo',
          4: 'bing',
        },
        settings: {
          darkMode: false,
          replaceNewTab: true,
          replaceAddressBarSearch: true,
        },
      },
    });

    expect(hydratedState.settings).toEqual({
      darkMode: false,
      replaceNewTab: true,
      replaceAddressBarSearch: true,
    });
    expect(hydratedState.dispatchByColumn[1]?.status).toBe('pending');
    expect(hydratedState.dispatchByColumn[1]?.query).toBe('edge case query');
  });

  describe('persistence', () => {
    it('does not show restore notice when storage payload is missing', async () => {
      render(<WorkspaceShell />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: 'Workspace restore notice' })).not.toBeInTheDocument();
      });
    });

    it('shows restore warning for corrupt v1 payload', async () => {
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: {
            schemaVersion: 1,
            columnCount: 3,
            providersByColumn: {
              1: 'google',
              2: 'invalid-provider',
              3: 'duckduckgo',
            },
            settings: {
              darkMode: true,
              replaceNewTab: false,
              replaceAddressBarSearch: false,
            },
          },
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      expect(await screen.findByRole('status', { name: 'Workspace restore notice' })).toHaveTextContent(
        /default settings were applied/i,
      );
    });
    it('hydrates column count and providers from persisted preferences on mount', async () => {
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: {
            schemaVersion: 1,
            columnCount: 3,
            providersByColumn: {
              1: 'bing',
              2: 'google',
              3: 'duckduckgo',
            },
            settings: {
              darkMode: true,
              replaceNewTab: false,
              replaceAddressBarSearch: false,
            },
          },
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      expect(await screen.findByRole('region', { name: 'Column 3' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Column 1 provider' })).toHaveValue('bing');
      expect(screen.getByRole('combobox', { name: 'Column 2 provider' })).toHaveValue('google');
      expect(screen.getByRole('combobox', { name: 'Column 3 provider' })).toHaveValue('duckduckgo');
    });

    it('falls back to defaults and shows restore warning for incompatible payload', async () => {
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: {
            schemaVersion: 99,
            columnCount: 4,
            providersByColumn: {
              1: 'google',
              2: 'duckduckgo',
              3: 'brave',
              4: 'bing',
            },
            settings: {
              darkMode: true,
              replaceNewTab: false,
              replaceAddressBarSearch: false,
            },
          },
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      expect(await screen.findByRole('status', { name: 'Workspace restore notice' })).toHaveTextContent(
        /default settings were applied/i,
      );
      expect(getDisplayedColumnCount()).toHaveTextContent('2');
      expect(screen.getByRole('combobox', { name: 'Column 1 provider' })).toHaveValue('google');
      expect(screen.queryByRole('region', { name: 'Column 3' })).not.toBeInTheDocument();
    });

    it('persists layout and provider changes with debounced writes only', async () => {
      vi.useFakeTimers();
      const set = vi.fn().mockResolvedValue(undefined);
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({}),
        set,
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      fireEvent.change(screen.getByRole('textbox', { name: 'Shared query' }), {
        target: { value: 'do not persist input' },
      });
      vi.advanceTimersByTime(500);
      expect(set).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: '3' }));
      fireEvent.change(screen.getByRole('combobox', { name: 'Column 2 provider' }), {
        target: { value: 'bing' },
      });
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      expect(set).toHaveBeenCalled();

      const persistedPayload = set.mock.calls.at(-1)?.[0]?.fanout_workspace_preferences;
      expect(persistedPayload).toMatchObject({
        schemaVersion: 1,
        columnCount: 3,
        providersByColumn: {
          1: 'google',
          2: 'bing',
          3: 'brave',
        },
        settings: {
          darkMode: true,
          replaceNewTab: false,
          replaceAddressBarSearch: false,
        },
      });
    });

    it('restores persisted layout and providers after unmount and remount', async () => {
      let storedPayload: unknown;
      const set = vi.fn().mockImplementation(async (items: Record<string, unknown>) => {
        storedPayload = items.fanout_workspace_preferences;
      });
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({}),
        set,
        remove: vi.fn().mockResolvedValue(undefined),
      });

      const { unmount } = render(<WorkspaceShell />);
      fireEvent.click(screen.getByRole('button', { name: '4' }));
      await waitFor(() => expect(set).toHaveBeenCalled());
      expect(storedPayload).toMatchObject({ columnCount: 4 });
      unmount();

      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: storedPayload,
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      expect(await screen.findByRole('region', { name: 'Column 4' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Column 4 provider' })).toHaveValue('bing');
    });
  });

  describe('interaction', () => {
    it('reflows workspace immediately when a column control is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      expect(getDisplayedColumnCount()).toHaveTextContent('2');
      expect(screen.queryByRole('region', { name: 'Column 3' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '3' }));

      expect(getDisplayedColumnCount()).toHaveTextContent('3');
      expect(screen.getByRole('region', { name: 'Column 3' })).toBeInTheDocument();
      expect(screen.getAllByRole('region', { name: /Column [0-9]/ })).toHaveLength(3);
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

    it('does not submit whitespace-only shared query on Enter', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      const input = screen.getByRole('textbox', { name: 'Shared query' });
      await user.type(input, '   {enter}');

      expect(screen.queryByTitle(/results for/)).not.toBeInTheDocument();
      expect(screen.getByText('Column 1 Placeholder')).toBeInTheDocument();
    });

    it('fans out Enter submit to three active columns', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: '3' }));

      const input = screen.getByRole('textbox', { name: 'Shared query' });
      await user.type(input, 'best coffee beans{enter}');

      expect(screen.getByTitle('Google results for best coffee beans')).toBeInTheDocument();
      expect(screen.getByTitle('DuckDuckGo results for best coffee beans')).toBeInTheDocument();
      expect(screen.getByTitle('Brave results for best coffee beans')).toBeInTheDocument();
    });

    it('submits trimmed shared query to all active columns with Enter and preserves input text', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      const input = screen.getByRole('textbox', { name: 'Shared query' });
      await user.type(input, '  best coffee beans  {enter}');

      expect(input).toHaveValue('  best coffee beans  ');
      expect(screen.getByTitle('Google results for best coffee beans')).toHaveAttribute(
        'src',
        'https://www.google.com/search?q=best%20coffee%20beans',
      );
      expect(screen.getByTitle('DuckDuckGo results for best coffee beans')).toHaveAttribute(
        'src',
        'https://duckduckgo.com/?q=best%20coffee%20beans',
      );
    });

    it('keeps healthy columns running when one column errors', () => {
      const pendingState = workspaceShellReducer(baseState, {
        type: 'submitQuery',
        query: 'best coffee beans',
        requestId: 'request-1',
      });
      const mixedState = workspaceShellReducer(pendingState, {
        type: 'resolveColumnDispatch',
        columnIndex: 1,
        requestId: 'request-1',
        status: 'error',
        errorMessage: 'Could not load Google results.',
      });
      const resolvedSibling = workspaceShellReducer(mixedState, {
        type: 'resolveColumnDispatch',
        columnIndex: 2,
        requestId: 'request-1',
        status: 'success',
      });

      render(<WorkspaceShell initialState={resolvedSibling} />);

      expect(screen.getByRole('alert')).toHaveTextContent('Google');
      expect(screen.getByRole('status', { name: 'Column 2 status' })).toHaveTextContent('Success');
    });

    it('supports retry and change provider recovery actions on error', async () => {
      const user = userEvent.setup();
      const pendingState = workspaceShellReducer(baseState, {
        type: 'submitQuery',
        query: 'best coffee beans',
        requestId: 'request-1',
      });
      const erroredState = workspaceShellReducer(pendingState, {
        type: 'resolveColumnDispatch',
        columnIndex: 1,
        requestId: 'request-1',
        status: 'error',
        errorMessage: 'Could not load Google results.',
      });

      render(<WorkspaceShell initialState={erroredState} />);

      await user.click(screen.getByRole('button', { name: 'Change provider for column 1' }));
      expect(screen.getByRole('combobox', { name: 'Column 1 provider' })).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Retry column 1' }));
      expect(screen.getByRole('status', { name: 'Column 1 status' })).toHaveTextContent('Pending');
    });
  });

  describe('settings panel', () => {
    it('toggles isSettingsOpen via openSettings and closeSettings reducer actions', () => {
      const opened = workspaceShellReducer(baseState, { type: 'openSettings' });
      const closed = workspaceShellReducer(opened, { type: 'closeSettings' });

      expect(opened.isSettingsOpen).toBe(true);
      expect(closed.isSettingsOpen).toBe(false);
    });

    it('updates an individual setting flag without mutating others via updateSetting', () => {
      const nextState = workspaceShellReducer(baseState, {
        type: 'updateSetting',
        key: 'darkMode',
        value: false,
      });

      expect(nextState.settings).toEqual({
        darkMode: false,
        replaceNewTab: false,
        replaceAddressBarSearch: false,
      });
    });

    it('never starts the panel open even when initialState requests it', () => {
      render(<WorkspaceShell initialState={{ ...baseState, isSettingsOpen: true }} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not render the settings panel when closed', () => {
      render(<WorkspaceShell />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the address-bar search toggle with always-visible disclosure copy', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));

      const toggle = screen.getByLabelText('Use address bar for Fanout search');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('type', 'checkbox');
      expect(
        screen.getByText(/typing a search query \(not a URL\) in the address bar opens Fanout/i),
      ).toBeInTheDocument();
    });

    it('defaults the address-bar search toggle to off', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));

      expect(screen.getByLabelText('Use address bar for Fanout search')).not.toBeChecked();
    });

    it('updateSetting toggles replaceAddressBarSearch without mutating other settings', () => {
      const nextState = workspaceShellReducer(baseState, {
        type: 'updateSetting',
        key: 'replaceAddressBarSearch',
        value: true,
      });

      expect(nextState.settings).toEqual({
        darkMode: true,
        replaceNewTab: false,
        replaceAddressBarSearch: true,
      });
    });

    it('persists the address-bar search toggle through debounced storage writes', async () => {
      vi.useFakeTimers();
      const set = vi.fn().mockResolvedValue(undefined);
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({}),
        set,
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
      fireEvent.click(screen.getByLabelText('Use address bar for Fanout search'));
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(set).toHaveBeenCalled();
      const persistedPayload = set.mock.calls.at(-1)?.[0]?.fanout_workspace_preferences;
      expect(persistedPayload?.settings).toMatchObject({
        darkMode: true,
        replaceNewTab: false,
        replaceAddressBarSearch: true,
      });
    });

    it('opens settings panel and moves focus to close button', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));

      expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Close settings')).toHaveFocus();
    });

    it('closes settings via close button and returns focus to settings button', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      await user.click(screen.getByLabelText('Close settings'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open settings/i })).toHaveFocus();
    });

    it('closes settings on Escape and returns focus to settings button', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open settings/i })).toHaveFocus();
    });

    it('applies data-theme=light when dark mode is toggled off', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-theme', 'dark');

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      await user.click(screen.getByLabelText('Dark mode'));

      expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-theme', 'light');
    });

    it('persists the replace-new-tab toggle through debounced storage writes', async () => {
      vi.useFakeTimers();
      const set = vi.fn().mockResolvedValue(undefined);
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({}),
        set,
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
      fireEvent.click(screen.getByLabelText('Replace new tab page'));
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(set).toHaveBeenCalled();
      const persistedPayload = set.mock.calls.at(-1)?.[0]?.fanout_workspace_preferences;
      expect(persistedPayload?.settings).toMatchObject({
        darkMode: true,
        replaceNewTab: true,
        replaceAddressBarSearch: false,
      });
    });

    it('preserves workspace context immediately when settings panel opens', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: '3' }));
      await user.type(screen.getByRole('textbox', { name: 'Shared query' }), 'best coffee beans');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Column 2 provider' }), 'bing');

      await user.click(screen.getByRole('button', { name: /open settings/i }));

      expect(getDisplayedColumnCount()).toHaveTextContent('3');
      expect(screen.getByRole('textbox', { name: 'Shared query' })).toHaveValue('best coffee beans');
      expect(screen.getByRole('combobox', { name: 'Column 2 provider' })).toHaveValue('bing');
    });

    it('preserves workspace context across an open and close cycle', async () => {
      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: '3' }));
      await user.type(screen.getByRole('textbox', { name: 'Shared query' }), 'best coffee beans');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Column 2 provider' }), 'bing');

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      await user.click(screen.getByLabelText('Close settings'));

      expect(getDisplayedColumnCount()).toHaveTextContent('3');
      expect(screen.getByRole('textbox', { name: 'Shared query' })).toHaveValue('best coffee beans');
      expect(screen.getByRole('combobox', { name: 'Column 2 provider' })).toHaveValue('bing');
    });

    it('restores dark mode preference after unmount and remount', async () => {
      let storedPayload: unknown;
      const set = vi.fn().mockImplementation(async (items: Record<string, unknown>) => {
        storedPayload = items.fanout_workspace_preferences;
      });
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({}),
        set,
        remove: vi.fn().mockResolvedValue(undefined),
      });

      const user = userEvent.setup();
      const { unmount } = render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      await user.click(screen.getByLabelText('Dark mode'));
      await waitFor(() => expect(set).toHaveBeenCalled());
      unmount();

      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: storedPayload,
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      await waitFor(() => {
        expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-theme', 'light');
      });
    });

    it('restores replace-new-tab preference after unmount and remount', async () => {
      let storedPayload: unknown;
      const set = vi.fn().mockImplementation(async (items: Record<string, unknown>) => {
        storedPayload = items.fanout_workspace_preferences;
      });
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({}),
        set,
        remove: vi.fn().mockResolvedValue(undefined),
      });

      const user = userEvent.setup();
      const { unmount } = render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      await user.click(screen.getByLabelText('Replace new tab page'));
      await waitFor(() => expect(set).toHaveBeenCalled());
      unmount();

      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: storedPayload,
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));
      expect(await screen.findByLabelText('Replace new tab page')).toBeChecked();
    });

    it('does not block preference hydration when settings is opened before storage load completes', async () => {
      let resolveGet: ((value: Record<string, unknown>) => void) | undefined;
      const getPromise = new Promise<Record<string, unknown>>((resolve) => {
        resolveGet = resolve;
      });
      installBrowserStorageLocalMock({
        get: vi.fn().mockReturnValue(getPromise),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      const user = userEvent.setup();
      render(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /open settings/i }));

      resolveGet?.({
        fanout_workspace_preferences: {
          schemaVersion: 1,
          columnCount: 3,
          providersByColumn: {
            1: 'bing',
            2: 'google',
            3: 'duckduckgo',
          },
          settings: {
            darkMode: false,
            replaceNewTab: true,
            replaceAddressBarSearch: false,
          },
        },
      });

      expect(await screen.findByRole('region', { name: 'Column 3' })).toBeInTheDocument();
      expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-theme', 'light');
      expect(screen.getByLabelText('Replace new tab page')).toBeChecked();
    });
  });

  describe('address-bar routing indicator', () => {
    it('renders the active-state badge when address-bar routing is enabled', () => {
      render(
        <WorkspaceShell
          initialState={{
            ...baseState,
            settings: { ...baseState.settings, replaceAddressBarSearch: true },
          }}
        />,
      );

      expect(screen.getByLabelText('Address-bar routing is on')).toBeInTheDocument();
    });

    it('does not render the active-state badge when address-bar routing is disabled', () => {
      render(<WorkspaceShell />);

      expect(screen.queryByLabelText('Address-bar routing is on')).not.toBeInTheDocument();
    });
  });

  describe('address-bar routing intake and fallback', () => {
    it('prefills the shared input with the routed query on first render', () => {
      const markup = renderToStaticMarkup(<WorkspaceShell initialQuery="best coffee beans" />);

      expect(markup).toContain('value="best coffee beans"');
    });

    it('auto-dispatches the routed query to active columns after hydration', async () => {
      render(<WorkspaceShell initialQuery="best coffee beans" />);

      expect(await screen.findByTitle('Google results for best coffee beans')).toBeInTheDocument();
      expect(screen.getByTitle('DuckDuckGo results for best coffee beans')).toBeInTheDocument();
    });

    it('auto-dispatches the routed query using saved providers after hydration', async () => {
      installBrowserStorageLocalMock({
        get: vi.fn().mockResolvedValue({
          fanout_workspace_preferences: {
            schemaVersion: 1,
            columnCount: 2,
            providersByColumn: {
              1: 'bing',
              2: 'brave',
            },
            settings: {
              darkMode: true,
              replaceNewTab: false,
              replaceAddressBarSearch: true,
            },
          },
        }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell initialQuery="best coffee beans" />);

      expect(await screen.findByTitle('Bing results for best coffee beans')).toBeInTheDocument();
      expect(screen.getByTitle('Brave results for best coffee beans')).toBeInTheDocument();
    });

    it('does not auto-dispatch any query when no routed query is provided', async () => {
      render(<WorkspaceShell />);

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: 'Workspace restore notice' })).not.toBeInTheDocument();
      });
      expect(screen.queryByTitle(/results for/)).not.toBeInTheDocument();
      expect(screen.getByText('Column 1 Placeholder')).toBeInTheDocument();
    });

    it('auto-dispatches the routed query when hydration hangs past the timeout', async () => {
      vi.useFakeTimers();

      installBrowserStorageLocalMock({
        get: vi.fn().mockReturnValue(new Promise<Record<string, unknown>>(() => {})),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      render(<WorkspaceShell initialQuery="best coffee beans" />);

      await act(() => {
        vi.advanceTimersByTime(WORKSPACE_HYDRATION_TIMEOUT_MS);
      });

      expect(screen.getByTitle('Google results for best coffee beans')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Address-bar routing notice' })).toHaveTextContent(
        /enter your query above and press Enter to search manually/i,
      );

      vi.useRealTimers();
    });

    it('shows the routing fallback notice when the routed query fails on every column', () => {
      // A never-resolving storage read keeps the hydration effect from
      // overwriting the seeded all-error dispatch state during the test.
      installBrowserStorageLocalMock({
        get: vi.fn().mockReturnValue(new Promise<Record<string, unknown>>(() => {})),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      });

      const erroredState: WorkspaceShellState = {
        ...baseState,
        dispatchByColumn: {
          1: {
            status: 'error',
            query: 'best coffee beans',
            provider: 'google',
            requestId: 'request-1',
            pendingStartedAt: 0,
            errorMessage: 'Could not load Google results.',
          },
          2: {
            status: 'error',
            query: 'best coffee beans',
            provider: 'duckduckgo',
            requestId: 'request-1',
            pendingStartedAt: 0,
            errorMessage: 'Could not load DuckDuckGo results.',
          },
        },
      };

      render(<WorkspaceShell initialState={erroredState} initialQuery="best coffee beans" />);

      expect(screen.getByRole('status', { name: 'Address-bar routing notice' })).toHaveTextContent(
        /enter your query above and press Enter to search manually/i,
      );
    });

    it('does not show the routing fallback notice without a routed query', () => {
      const erroredState: WorkspaceShellState = {
        ...baseState,
        dispatchByColumn: {
          1: {
            status: 'error',
            query: 'best coffee beans',
            provider: 'google',
            requestId: 'request-1',
            pendingStartedAt: 0,
            errorMessage: 'Could not load Google results.',
          },
          2: {
            status: 'error',
            query: 'best coffee beans',
            provider: 'duckduckgo',
            requestId: 'request-1',
            pendingStartedAt: 0,
            errorMessage: 'Could not load DuckDuckGo results.',
          },
        },
      };

      render(<WorkspaceShell initialState={erroredState} />);

      expect(screen.queryByRole('status', { name: 'Address-bar routing notice' })).not.toBeInTheDocument();
    });

    it('setRoutingError sets and clears the transient routing error message', () => {
      const withError = workspaceShellReducer(baseState, {
        type: 'setRoutingError',
        message: 'Routing handoff failed.',
      });
      expect(withError.routingError).toBe('Routing handoff failed.');

      const cleared = workspaceShellReducer(withError, {
        type: 'setRoutingError',
        message: null,
      });
      expect(cleared.routingError).toBeNull();
    });

    it('never restores routingError from provided initial state', () => {
      render(
        <WorkspaceShell
          initialState={{ ...baseState, routingError: 'stale error' }}
        />,
      );

      expect(screen.queryByRole('status', { name: 'Address-bar routing notice' })).not.toBeInTheDocument();
    });
  });
});

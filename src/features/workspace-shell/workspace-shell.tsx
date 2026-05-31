import { useEffect, useReducer, useRef, useState } from 'react';
import './workspace-shell.css';
import {
  COLUMN_COUNTS,
  DEFAULT_WORKSPACE_PREFERENCES,
  SEARCH_PROVIDERS,
  WORKSPACE_RESTORE_WARNING_MESSAGE,
  loadWorkspacePreferences,
  saveWorkspacePreferences,
  type PersistedWorkspaceSettings,
  type SearchProvider,
  type WorkspacePreferencesSnapshot,
} from './workspace-preferences-storage';

export { COLUMN_COUNTS, SEARCH_PROVIDERS };

export type ProvidersByColumn = Record<number, SearchProvider>;
export type ColumnDispatchStatus = 'idle' | 'pending' | 'success' | 'error';
export type ColumnDispatchState = {
  status: ColumnDispatchStatus;
  query: string;
  provider: SearchProvider;
  requestId: string;
  pendingStartedAt: number;
  errorMessage?: string;
};
export type DispatchByColumn = Record<number, ColumnDispatchState | undefined>;
export type WorkspaceShellState = {
  columnCount: (typeof COLUMN_COUNTS)[number];
  commandInput: string;
  providersByColumn: ProvidersByColumn;
  settings: PersistedWorkspaceSettings;
  dispatchByColumn: DispatchByColumn;
};

const PROVIDER_LABELS: Record<SearchProvider, string> = {
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
  brave: 'Brave',
  bing: 'Bing',
};

const DEFAULT_PROVIDERS_BY_COLUMN: ProvidersByColumn = {
  ...DEFAULT_WORKSPACE_PREFERENCES.providersByColumn,
};

let requestCounter = 0;

export function buildDefaultProvidersByColumn(): ProvidersByColumn {
  return { ...DEFAULT_PROVIDERS_BY_COLUMN };
}

function createRequestId(): string {
  requestCounter += 1;
  return `request-${requestCounter}`;
}

export function buildSearchProviderUrl(provider: SearchProvider, query: string): string {
  const encodedQuery = encodeURIComponent(query);

  if (provider === 'google') {
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  if (provider === 'duckduckgo') {
    return `https://duckduckgo.com/?q=${encodedQuery}`;
  }

  if (provider === 'brave') {
    return `https://search.brave.com/search?q=${encodedQuery}`;
  }

  return `https://www.bing.com/search?q=${encodedQuery}`;
}

function isSearchProvider(value: string): value is SearchProvider {
  return (SEARCH_PROVIDERS as readonly string[]).includes(value);
}

function resolveColumnProvider(
  providersByColumn: ProvidersByColumn | undefined,
  columnIndex: number,
): SearchProvider {
  const provider = providersByColumn?.[columnIndex];
  if (provider && isSearchProvider(provider)) {
    return provider;
  }

  return DEFAULT_PROVIDERS_BY_COLUMN[columnIndex];
}

function ensureProvidersForColumnCount(
  providersByColumn: ProvidersByColumn | undefined,
  columnCount: (typeof COLUMN_COUNTS)[number],
): ProvidersByColumn {
  const nextProvidersByColumn = { ...(providersByColumn ?? {}) };

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    const provider = nextProvidersByColumn[columnIndex];
    if (!provider || !isSearchProvider(provider)) {
      nextProvidersByColumn[columnIndex] = DEFAULT_PROVIDERS_BY_COLUMN[columnIndex];
    }
  }

  return nextProvidersByColumn;
}

function buildInitialState(initialState?: WorkspaceShellState): WorkspaceShellState {
  const columnCount = initialState?.columnCount ?? DEFAULT_STATE.columnCount;

  return {
    ...DEFAULT_STATE,
    ...initialState,
    columnCount,
    providersByColumn: ensureProvidersForColumnCount(
      initialState?.providersByColumn ?? DEFAULT_STATE.providersByColumn,
      columnCount,
    ),
    settings: {
      ...DEFAULT_STATE.settings,
      ...initialState?.settings,
    },
    dispatchByColumn: { ...(initialState?.dispatchByColumn ?? DEFAULT_STATE.dispatchByColumn) },
  };
}

function hasPendingColumnDispatches(dispatchByColumn: DispatchByColumn): boolean {
  return Object.values(dispatchByColumn).some((columnDispatch) => columnDispatch?.status === 'pending');
}

function clearInactiveColumnDispatches(
  dispatchByColumn: DispatchByColumn,
  columnCount: WorkspaceShellState['columnCount'],
): DispatchByColumn {
  const nextDispatchByColumn = { ...dispatchByColumn };

  for (let columnIndex = columnCount + 1; columnIndex <= 4; columnIndex += 1) {
    delete nextDispatchByColumn[columnIndex];
  }

  return nextDispatchByColumn;
}

type WorkspaceShellAction =
  | {
      type: 'setColumnCount';
      columnCount: WorkspaceShellState['columnCount'];
    }
  | {
      type: 'setCommandInput';
      commandInput: string;
    }
  | {
      type: 'hydratePreferences';
      preferences: WorkspacePreferencesSnapshot;
    }
  | {
      type: 'setColumnProvider';
      columnIndex: number;
      provider: SearchProvider;
      requestId?: string;
    }
  | {
      type: 'submitQuery';
      query: string;
      requestId: string;
    }
  | {
      type: 'resolveColumnDispatch';
      columnIndex: number;
      requestId: string;
      status: Exclude<ColumnDispatchStatus, 'idle' | 'pending'>;
      errorMessage?: string;
    }
  | {
      type: 'retryColumnDispatch';
      columnIndex: number;
      requestId: string;
    };

const DEFAULT_STATE: WorkspaceShellState = {
  columnCount: 2,
  commandInput: '',
  providersByColumn: buildDefaultProvidersByColumn(),
  settings: { ...DEFAULT_WORKSPACE_PREFERENCES.settings },
  dispatchByColumn: {},
};

const COLUMN_DISPATCH_TIMEOUT_MS = 10_000;

export function workspaceShellReducer(state: WorkspaceShellState, action: WorkspaceShellAction): WorkspaceShellState {
  if (action.type === 'setColumnCount') {
    return {
      ...state,
      columnCount: action.columnCount,
      providersByColumn: ensureProvidersForColumnCount(state.providersByColumn, action.columnCount),
      dispatchByColumn: clearInactiveColumnDispatches(state.dispatchByColumn, action.columnCount),
    };
  }

  if (action.type === 'hydratePreferences') {
    return {
      ...state,
      columnCount: action.preferences.columnCount,
      providersByColumn: ensureProvidersForColumnCount(
        action.preferences.providersByColumn,
        action.preferences.columnCount,
      ),
      settings: { ...action.preferences.settings },
      dispatchByColumn: state.dispatchByColumn,
    };
  }

  if (action.type === 'setColumnProvider') {
    if (action.columnIndex < 1 || action.columnIndex > 4) {
      return state;
    }

    if (!isSearchProvider(action.provider)) {
      return state;
    }

    const existingDispatch = state.dispatchByColumn[action.columnIndex];
    // During an in-flight query, changing provider restarts only that column with a new requestId.
    const shouldRestartPendingDispatch =
      existingDispatch?.status === 'pending' && Boolean(existingDispatch.query.trim()) && Boolean(action.requestId);

    const nextDispatchByColumn: DispatchByColumn = existingDispatch
      ? {
          ...state.dispatchByColumn,
          [action.columnIndex]: shouldRestartPendingDispatch
            ? {
                ...existingDispatch,
                provider: action.provider,
                requestId: action.requestId ?? existingDispatch.requestId,
                status: 'pending' as const,
                pendingStartedAt: Date.now(),
                errorMessage: undefined,
              }
            : {
                ...existingDispatch,
                provider: action.provider,
              },
        }
      : state.dispatchByColumn;

    return {
      ...state,
      providersByColumn: {
        ...state.providersByColumn,
        [action.columnIndex]: action.provider,
      },
      dispatchByColumn: nextDispatchByColumn,
    };
  }

  if (action.type === 'submitQuery') {
    if (!action.query.trim()) {
      return state;
    }

    const nextDispatchByColumn = clearInactiveColumnDispatches(
      { ...state.dispatchByColumn },
      state.columnCount,
    );
    const pendingStartedAt = Date.now();

    for (let columnIndex = 1; columnIndex <= state.columnCount; columnIndex += 1) {
      nextDispatchByColumn[columnIndex] = {
        status: 'pending',
        query: action.query,
        provider: resolveColumnProvider(state.providersByColumn, columnIndex),
        requestId: action.requestId,
        pendingStartedAt,
      };
    }

    return {
      ...state,
      dispatchByColumn: nextDispatchByColumn,
    };
  }

  if (action.type === 'resolveColumnDispatch') {
    const currentDispatch = state.dispatchByColumn[action.columnIndex];

    if (
      !currentDispatch ||
      currentDispatch.requestId !== action.requestId ||
      currentDispatch.status !== 'pending'
    ) {
      return state;
    }

    return {
      ...state,
      dispatchByColumn: {
        ...state.dispatchByColumn,
        [action.columnIndex]: {
          ...currentDispatch,
          status: action.status,
          errorMessage:
            action.status === 'error'
              ? action.errorMessage ?? `Could not load ${PROVIDER_LABELS[currentDispatch.provider]} results.`
              : undefined,
        },
      },
    };
  }

  if (action.type === 'retryColumnDispatch') {
    const currentDispatch = state.dispatchByColumn[action.columnIndex];

    if (!currentDispatch || currentDispatch.status !== 'error' || !currentDispatch.query.trim()) {
      return state;
    }

    return {
      ...state,
      dispatchByColumn: {
        ...state.dispatchByColumn,
        [action.columnIndex]: {
          ...currentDispatch,
          status: 'pending',
          requestId: action.requestId,
          pendingStartedAt: Date.now(),
          errorMessage: undefined,
        },
      },
    };
  }

  return {
    ...state,
    commandInput: action.commandInput,
  };
}

type WorkspaceShellProps = {
  initialState?: WorkspaceShellState;
};

export function WorkspaceShell({ initialState }: WorkspaceShellProps = {}) {
  const [state, dispatch] = useReducer(workspaceShellReducer, initialState, buildInitialState);
  const { columnCount, commandInput, providersByColumn, settings, dispatchByColumn } = state;
  const providerSelectRefs = useRef<Record<number, HTMLSelectElement | null>>({});
  const hasMountedPersistenceEffect = useRef(false);
  const hasUserEditedPreferences = useRef(false);
  const dispatchByColumnRef = useRef(dispatchByColumn);
  const preferencesSnapshotRef = useRef<WorkspacePreferencesSnapshot>({
    columnCount: DEFAULT_STATE.columnCount,
    providersByColumn: DEFAULT_STATE.providersByColumn,
    settings: DEFAULT_STATE.settings,
  });
  const [restoreNotice, setRestoreNotice] = useState<string>();

  useEffect(() => {
    preferencesSnapshotRef.current = {
      columnCount,
      providersByColumn,
      settings,
    };
    dispatchByColumnRef.current = dispatchByColumn;
  }, [columnCount, providersByColumn, settings, dispatchByColumn]);

  useEffect(() => {
    let isActive = true;

    void loadWorkspacePreferences()
      .then(({ preferences, warning, didLoadPersistedValue }) => {
        if (!isActive) {
          return;
        }

        setRestoreNotice(warning);

        if (
          didLoadPersistedValue &&
          !hasUserEditedPreferences.current &&
          !hasPendingColumnDispatches(dispatchByColumnRef.current)
        ) {
          dispatch({
            type: 'hydratePreferences',
            preferences,
          });
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setRestoreNotice(WORKSPACE_RESTORE_WARNING_MESSAGE);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasMountedPersistenceEffect.current) {
      hasMountedPersistenceEffect.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveWorkspacePreferences(preferencesSnapshotRef.current);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
      void saveWorkspacePreferences(preferencesSnapshotRef.current);
    };
  }, [columnCount, providersByColumn, settings]);

  useEffect(() => {
    const activeTimers: number[] = [];
    const now = Date.now();

    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const columnDispatch = dispatchByColumn[columnIndex];
      if (!columnDispatch || columnDispatch.status !== 'pending') {
        continue;
      }

      const remainingMs = Math.max(0, COLUMN_DISPATCH_TIMEOUT_MS - (now - columnDispatch.pendingStartedAt));
      const { requestId, provider } = columnDispatch;

      const timeoutId = window.setTimeout(() => {
        dispatch({
          type: 'resolveColumnDispatch',
          columnIndex,
          requestId,
          status: 'error',
          errorMessage: `${PROVIDER_LABELS[provider]} did not finish loading before timeout.`,
        });
      }, remainingMs);
      activeTimers.push(timeoutId);
    }

    return () => {
      for (const timeoutId of activeTimers) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [columnCount, dispatchByColumn]);

  return (
    <div className="workspace-shell" data-testid="workspace-shell">
      <header className="command-bar" data-testid="command-bar">
        <input
          aria-label="Shared query"
          className="command-input"
          placeholder="Type one query to fan out..."
          value={commandInput}
          onChange={(event) => {
            dispatch({
              type: 'setCommandInput',
              commandInput: event.target.value,
            });
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.repeat) {
              return;
            }

            const trimmedQuery = commandInput.trim();
            if (!trimmedQuery) {
              event.preventDefault();
              return;
            }

            event.preventDefault();

            dispatch({
              type: 'submitQuery',
              query: trimmedQuery,
              requestId: createRequestId(),
            });
          }}
        />

        <div className="column-controls" aria-label="Column count controls">
          {COLUMN_COUNTS.map((count) => (
            <button
              key={count}
              className={columnCount === count ? 'column-button column-button-active' : 'column-button'}
              aria-pressed={columnCount === count}
              onClick={() => {
                hasUserEditedPreferences.current = true;
                dispatch({
                  type: 'setColumnCount',
                  columnCount: count,
                });
              }}
              type="button">
              {count}
            </button>
          ))}
        </div>

        <button className="settings-button" type="button" aria-label="Open settings">
          Settings
        </button>
      </header>

      <main className="workspace-region">
        <h1>Fanout Workspace</h1>
        <p>
          Mode: <strong>Search</strong> | Columns: <strong>{columnCount}</strong>
        </p>
        {restoreNotice ? (
          <p
            className="workspace-restore-notice"
            role="status"
            aria-live="polite"
            aria-label="Workspace restore notice">
            {restoreNotice}
          </p>
        ) : null}
        <div
          className="column-layout"
          data-testid="column-layout"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: columnCount }).map((_, index) => (
            <section key={index} className="column-placeholder" aria-label={`Column ${index + 1}`}>
              <header className="column-placeholder-header">
                <label className="column-provider-label" htmlFor={`column-provider-${index + 1}`}>
                  Column {index + 1} provider
                </label>
                {(() => {
                  const columnIndex = index + 1;
                  const selectedProvider = resolveColumnProvider(providersByColumn, columnIndex);
                  const columnDispatch = dispatchByColumn[columnIndex];
                  const columnStatus = columnDispatch?.status ?? 'idle';
                  const providerLabel = PROVIDER_LABELS[selectedProvider];
                  const statusText =
                    columnStatus === 'idle'
                      ? 'Idle'
                      : columnStatus === 'pending'
                        ? 'Pending'
                        : columnStatus === 'success'
                          ? 'Success'
                          : 'Error';

                  return (
                    <>
                <select
                  id={`column-provider-${columnIndex}`}
                  className="column-provider-select"
                  value={selectedProvider}
                  ref={(element) => {
                    providerSelectRefs.current[columnIndex] = element;
                  }}
                  onChange={(event) => {
                    const provider = event.target.value;
                    if (!isSearchProvider(provider)) {
                      return;
                    }

                    hasUserEditedPreferences.current = true;
                    dispatch({
                      type: 'setColumnProvider',
                      columnIndex,
                      provider,
                      requestId:
                        columnDispatch?.status === 'pending' && Boolean(columnDispatch.query.trim())
                          ? createRequestId()
                          : undefined,
                    });
                  }}>
                  {SEARCH_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))}
                </select>
                      <span
                        aria-label={`Column ${columnIndex} status`}
                        role="status"
                        aria-live="polite"
                        className={`column-status column-status-${columnStatus}`}>
                        {statusText}
                      </span>
                      {columnDispatch?.query ? (
                        <div className="column-portal">
                          <iframe
                            key={`${columnIndex}-${columnDispatch.requestId}-${selectedProvider}`}
                            className="column-portal-frame"
                            title={`${providerLabel} results for ${columnDispatch.query}`}
                            src={buildSearchProviderUrl(selectedProvider, columnDispatch.query)}
                            onLoad={() => {
                              dispatch({
                                type: 'resolveColumnDispatch',
                                columnIndex,
                                requestId: columnDispatch.requestId,
                                status: 'success',
                              });
                            }}
                            onError={() => {
                              dispatch({
                                type: 'resolveColumnDispatch',
                                columnIndex,
                                requestId: columnDispatch.requestId,
                                status: 'error',
                                errorMessage: `Could not load ${providerLabel} results.`,
                              });
                            }}
                          />
                        </div>
                      ) : (
                        <span>Column {columnIndex} Placeholder</span>
                      )}
                      {columnStatus === 'error' && columnDispatch ? (
                        <div className="column-error" role="alert">
                          <p>
                            {columnDispatch.errorMessage ?? `Could not load ${providerLabel} results.`}
                          </p>
                          <div className="column-error-actions">
                            <button
                              type="button"
                              className="column-action-button"
                              aria-label={`Retry column ${columnIndex}`}
                              onClick={() => {
                                dispatch({
                                  type: 'retryColumnDispatch',
                                  columnIndex,
                                  requestId: createRequestId(),
                                });
                              }}>
                              Retry
                            </button>
                            <button
                              type="button"
                              className="column-action-button"
                              aria-label={`Change provider for column ${columnIndex}`}
                              onClick={() => {
                                providerSelectRefs.current[columnIndex]?.focus();
                              }}>
                              Change provider
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </header>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

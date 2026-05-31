import { useReducer } from 'react';
import './workspace-shell.css';

export const COLUMN_COUNTS = [2, 3, 4] as const;
export const SEARCH_PROVIDERS = ['google', 'duckduckgo', 'brave', 'bing'] as const;

export type SearchProvider = (typeof SEARCH_PROVIDERS)[number];
export type ProvidersByColumn = Record<number, SearchProvider>;

const PROVIDER_LABELS: Record<SearchProvider, string> = {
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
  brave: 'Brave',
  bing: 'Bing',
};

const DEFAULT_PROVIDERS_BY_COLUMN: ProvidersByColumn = {
  1: 'google',
  2: 'duckduckgo',
  3: 'brave',
  4: 'bing',
};

export function buildDefaultProvidersByColumn(): ProvidersByColumn {
  return { ...DEFAULT_PROVIDERS_BY_COLUMN };
}

function ensureProvidersForColumnCount(
  providersByColumn: ProvidersByColumn,
  columnCount: (typeof COLUMN_COUNTS)[number],
): ProvidersByColumn {
  const nextProvidersByColumn = { ...providersByColumn };

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    if (!nextProvidersByColumn[columnIndex]) {
      nextProvidersByColumn[columnIndex] = DEFAULT_PROVIDERS_BY_COLUMN[columnIndex];
    }
  }

  return nextProvidersByColumn;
}

export type WorkspaceShellState = {
  columnCount: (typeof COLUMN_COUNTS)[number];
  commandInput: string;
  providersByColumn: ProvidersByColumn;
};

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
      type: 'setColumnProvider';
      columnIndex: number;
      provider: SearchProvider;
    };

const DEFAULT_STATE: WorkspaceShellState = {
  columnCount: 2,
  commandInput: '',
  providersByColumn: buildDefaultProvidersByColumn(),
};

export function workspaceShellReducer(state: WorkspaceShellState, action: WorkspaceShellAction): WorkspaceShellState {
  if (action.type === 'setColumnCount') {
    return {
      ...state,
      columnCount: action.columnCount,
      providersByColumn: ensureProvidersForColumnCount(state.providersByColumn, action.columnCount),
    };
  }

  if (action.type === 'setColumnProvider') {
    return {
      ...state,
      providersByColumn: {
        ...state.providersByColumn,
        [action.columnIndex]: action.provider,
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
  const [state, dispatch] = useReducer(workspaceShellReducer, initialState ?? DEFAULT_STATE);
  const { columnCount, commandInput, providersByColumn } = state;

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
        />

        <div className="column-controls" aria-label="Column count controls">
          {COLUMN_COUNTS.map((count) => (
            <button
              key={count}
              className={columnCount === count ? 'column-button column-button-active' : 'column-button'}
              aria-pressed={columnCount === count}
              onClick={() => {
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
                <select
                  id={`column-provider-${index + 1}`}
                  className="column-provider-select"
                  value={providersByColumn[index + 1]}
                  onChange={(event) => {
                    dispatch({
                      type: 'setColumnProvider',
                      columnIndex: index + 1,
                      provider: event.target.value as SearchProvider,
                    });
                  }}>
                  {SEARCH_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))}
                </select>
              </header>
              <span>Column {index + 1} Placeholder</span>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

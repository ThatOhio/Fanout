import { useReducer } from 'react';
import './workspace-shell.css';

export const COLUMN_COUNTS = [2, 3, 4] as const;

export type WorkspaceShellState = {
  columnCount: (typeof COLUMN_COUNTS)[number];
  commandInput: string;
};

type WorkspaceShellAction =
  | {
      type: 'setColumnCount';
      columnCount: WorkspaceShellState['columnCount'];
    }
  | {
      type: 'setCommandInput';
      commandInput: string;
    };

const DEFAULT_STATE: WorkspaceShellState = {
  columnCount: 2,
  commandInput: '',
};

export function workspaceShellReducer(state: WorkspaceShellState, action: WorkspaceShellAction): WorkspaceShellState {
  if (action.type === 'setColumnCount') {
    return {
      ...state,
      columnCount: action.columnCount,
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
  const { columnCount, commandInput } = state;

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
              Column {index + 1} Placeholder
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

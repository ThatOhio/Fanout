import { useState } from 'react';
import { WORKSPACE_MODES, type WorkspaceMode } from '../../shared/mode';
import './workspace-shell.css';

const COLUMN_COUNTS = [2, 3, 4] as const;

export function WorkspaceShell() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('Search');
  const [columnCount, setColumnCount] = useState<(typeof COLUMN_COUNTS)[number]>(2);
  const [commandInput, setCommandInput] = useState('');

  return (
    <div className="workspace-shell" data-testid="workspace-shell">
      <header className="command-bar" data-testid="command-bar">
        <input
          aria-label="Shared query"
          className="command-input"
          placeholder="Type one query to fan out..."
          value={commandInput}
          onChange={(event) => {
            setCommandInput(event.target.value);
          }}
        />

        <div className="mode-toggle-group" role="tablist" aria-label="Mode">
          {WORKSPACE_MODES.map((mode) => (
            <button
              key={mode}
              className={workspaceMode === mode ? 'mode-toggle mode-toggle-active' : 'mode-toggle'}
              onClick={() => {
                setWorkspaceMode(mode);
              }}
              role="tab"
              aria-selected={workspaceMode === mode}
              type="button">
              {mode}
            </button>
          ))}
        </div>

        <div className="column-controls" aria-label="Column count controls">
          {COLUMN_COUNTS.map((count) => (
            <button
              key={count}
              className={columnCount === count ? 'column-button column-button-active' : 'column-button'}
              onClick={() => {
                setColumnCount(count);
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

      <main className="workspace-region" data-mode={workspaceMode}>
        <h1>Fanout Workspace</h1>
        <p>
          Mode: <strong>{workspaceMode}</strong> | Columns: <strong>{columnCount}</strong>
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

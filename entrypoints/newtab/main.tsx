import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorkspaceShell } from '../../src/features/workspace-shell/workspace-shell';
import '../shared/base.css';

const params = new URLSearchParams(location.search);
const initialQuery = params.get('q') ?? undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceShell initialQuery={initialQuery} />
  </React.StrictMode>,
);

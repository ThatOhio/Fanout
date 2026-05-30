import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorkspaceShell } from '../../src/features/workspace-shell/workspace-shell';
import '../shared/base.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceShell />
  </React.StrictMode>,
);

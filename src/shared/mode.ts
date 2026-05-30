export const WORKSPACE_MODES = ['Search', 'AI'] as const;

export type WorkspaceMode = (typeof WORKSPACE_MODES)[number];

export type PolicyFileRecord = {
  path: string;
  content: string;
};

export type PolicyViolation = {
  path: string;
  pattern: string;
  message: string;
};

export function findBroadPermissionViolations(records: PolicyFileRecord[]): PolicyViolation[];

export type PolicyFileRecord = {
  path: string;
  content: string;
};

export type PolicyViolation = {
  path: string;
  pattern: string;
  message: string;
};

export type PermissionRationaleViolation = {
  permission: string;
  message: string;
};

export function findBroadPermissionViolations(records: PolicyFileRecord[]): PolicyViolation[];

export function findUnmappedPermissions(
  wxtConfigContent: string,
  rationaleDocContent: string,
): PermissionRationaleViolation[];

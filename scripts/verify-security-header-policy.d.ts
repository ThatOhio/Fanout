export type PolicyFileRecord = {
  path: string;
  content: string;
};

export type PolicyViolation = {
  path: string;
  pattern: string;
  message: string;
};

export type OverrideViolation = {
  path: string;
  message: string;
};

export function findSecurityHeaderPolicyViolations(records: PolicyFileRecord[]): PolicyViolation[];

export function findUndocumentedJsonHeaderOverrides(
  records: PolicyFileRecord[],
  overridesDocContent: string,
): OverrideViolation[];

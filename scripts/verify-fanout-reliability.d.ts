export type FanoutViolation = { path: string; message: string };

export declare function findFanoutReliabilityViolations(
  records: Array<{ path: string; content: string }>,
): FanoutViolation[];

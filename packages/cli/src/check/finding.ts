import type { DetectorContext, Finding } from './types.js';

export function mkFinding(
  ctx: DetectorContext,
  detector: string,
  file: string,
  line: number,
  message: string,
  excerpt?: string,
): Finding {
  return {
    ruleId: ctx.ruleId,
    detector,
    bucket: ctx.bucket,
    severity: ctx.severity,
    file,
    line,
    message,
    excerpt,
  };
}

export function classifyInboundSmsKeyword(
  body: string | null | undefined,
  optOutType?: string | null,
): "opt_out" | "opt_in" | "help" | null;
export function inboundFromE164(from: unknown): string | null;

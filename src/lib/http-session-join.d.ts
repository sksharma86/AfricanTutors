declare module "@/lib/http-session-join.mjs" {
  export function joinMustWithholdToken(rpcResult?: {
    data?: { ok?: boolean } | null;
    error?: { message?: string } | null;
  } | null): boolean;
  export function joinPresenceRpcName(): string;
}

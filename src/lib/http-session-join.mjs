/**
 * HTTP join vs customer no-show gate.
 *
 * Daily may mint a token before this check. joinSession must withhold that
 * token whenever finalize_http_session_join fails. Unreturned tokens are inert.
 * Already-issued tokens from an earlier successful join mean student presence
 * already exists, so Guide no-show is rejected. This module does not revoke
 * Daily tokens or tear down rooms.
 */

/**
 * True when joinSession must throw not_joinable and must not return roomUrl/token.
 * Inspects supabase-js `{ data, error }` — never treat a failed RPC as success.
 *
 * @param {{ data?: { ok?: boolean } | null, error?: { message?: string } | null } | null | undefined} rpcResult
 */
export function joinMustWithholdToken(rpcResult) {
  if (!rpcResult) return true;
  if (rpcResult.error) return true;
  const data = rpcResult.data;
  if (!data || typeof data !== "object") return true;
  return data.ok !== true;
}

export function joinPresenceRpcName() {
  return "finalize_http_session_join";
}

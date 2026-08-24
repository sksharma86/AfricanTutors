import "server-only";

import {
  CALL_PARENT_SMS_MESSAGE,
  CALL_PARENT_VOICE_MESSAGE,
} from "@/lib/call-parent.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";
import { isTwilioConfigured } from "@/lib/telephony/config";
import { placeParentAttentionCall, sendParentAttentionSms } from "@/lib/telephony/client";
import { classifyTwilioCallStatus } from "@/lib/telephony/twilio-signature.mjs";

export type CallParentGuideStatus =
  | "contacting"
  | "parent_contacted"
  | "parent_alerted_sms"
  | "unable_to_contact"
  | "not_configured";

export interface CallParentResult {
  escalationId: string;
  guideStatus: CallParentGuideStatus;
  /** Safe message for the Guide UI — never includes phone or provider internals. */
  message: string;
}

const GUIDE_MESSAGES: Record<CallParentGuideStatus, string> = {
  contacting: "Contacting parent…",
  parent_contacted: "Parent contacted",
  parent_alerted_sms: "Parent alerted by text",
  unable_to_contact: "Unable to contact parent — notify manager",
  not_configured: "Unable to contact parent — notify manager",
};

export function guideStatusFromDb(status: string | null | undefined): CallParentGuideStatus {
  switch (status) {
    case "contacting":
    case "pending":
      return "contacting";
    case "call_answered":
      return "parent_contacted";
    case "sms_sent":
      return "parent_alerted_sms";
    case "not_configured":
      return "not_configured";
    default:
      return "unable_to_contact";
  }
}

export function guideMessage(status: CallParentGuideStatus): string {
  return GUIDE_MESSAGES[status];
}

/**
 * After `request_parent_escalation` inserted a pending row, place the outbound
 * call. Queued ≠ answered — Guide sees "Contacting parent…" until the Twilio
 * status callback finalizes (or immediate place-failure triggers SMS).
 */
export async function fulfillParentEscalation(escalationId: string): Promise<CallParentResult> {
  const service = getServiceSupabase();

  const { data: row, error } = await service
    .from("parent_escalation_requests")
    .select("id, account_id, status")
    .eq("id", escalationId)
    .maybeSingle();

  if (error || !row) {
    return resultOf(escalationId, "unable_to_contact");
  }

  if (row.status !== "pending") {
    return resultOf(escalationId, guideStatusFromDb(row.status));
  }

  if (!isTwilioConfigured()) {
    await complete(service, escalationId, {
      p_status: "not_configured",
      p_outcome: "not_configured",
      p_error_detail: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER missing",
    });
    return resultOf(escalationId, "not_configured");
  }

  const { data: profile } = await service
    .from("profiles")
    .select("phone_e164")
    .eq("id", row.account_id)
    .maybeSingle();

  const phone = typeof profile?.phone_e164 === "string" ? profile.phone_e164.trim() : "";
  if (!phone) {
    await complete(service, escalationId, {
      p_status: "failed",
      p_outcome: "no_phone",
      p_error_detail: "parent has no phone_e164 on file",
    });
    return resultOf(escalationId, "unable_to_contact");
  }

  const call = await placeParentAttentionCall({
    toE164: phone,
    message: CALL_PARENT_VOICE_MESSAGE,
  });

  if (call.status === "queued" && call.sid) {
    await service.rpc("mark_parent_escalation_contacting", {
      p_id: escalationId,
      p_call_sid: call.sid,
      p_call_status: "queued",
    });
    // Async: webhook will finalize answered vs SMS fallback.
    return resultOf(escalationId, "contacting");
  }

  // Could not place the call at all → SMS fallback immediately (sync).
  return sendSmsFallbackForEscalation(service, escalationId, phone, call.status, call.error ?? null);
}

/**
 * Handle a validated Twilio voice status callback (CallSid + CallStatus).
 * Never trusts client input for phone numbers.
 */
export async function handleTwilioVoiceStatus(opts: {
  callSid: string;
  callStatus: string;
}): Promise<{ ok: boolean; action: string }> {
  const service = getServiceSupabase();
  const kind = classifyTwilioCallStatus(opts.callStatus);

  // Intermediate (queued/ringing/in-progress): persist status only — not success.
  if (kind === "intermediate") {
    await service.rpc("touch_parent_escalation_call_status", {
      p_call_sid: opts.callSid,
      p_call_status: opts.callStatus,
    });
    return { ok: true, action: "touched" };
  }

  if (kind === "answered") {
    const { data: won } = await service.rpc("finalize_parent_escalation_call_answered", {
      p_call_sid: opts.callSid,
      p_call_status: opts.callStatus,
    });
    return { ok: true, action: won ? "call_answered" : "noop" };
  }

  // Unsuccessful terminal (busy|failed|no-answer|canceled|rejected) or unexpected
  // non-answered status on the completed StatusCallbackEvent → claim SMS once.
  const { data: escalationId } = await service.rpc("claim_parent_escalation_sms_fallback", {
    p_call_sid: opts.callSid,
    p_call_status: opts.callStatus,
  });

  if (!escalationId) {
    return { ok: true, action: "sms_already_claimed_or_final" };
  }

  const { data: row } = await service
    .from("parent_escalation_requests")
    .select("id, account_id")
    .eq("id", escalationId)
    .maybeSingle();

  if (!row) return { ok: true, action: "missing_row" };

  const { data: profile } = await service
    .from("profiles")
    .select("phone_e164")
    .eq("id", row.account_id)
    .maybeSingle();

  const phone = typeof profile?.phone_e164 === "string" ? profile.phone_e164.trim() : "";
  if (!phone) {
    await complete(service, row.id, {
      p_status: "failed",
      p_outcome: "no_phone",
      p_call_status: opts.callStatus,
      p_sms_status: "failed",
      p_error_detail: "parent has no phone_e164 on file at SMS fallback",
      p_sms_attempted: true,
    });
    return { ok: true, action: "sms_no_phone" };
  }

  const sms = await sendParentAttentionSms({
    toE164: phone,
    body: CALL_PARENT_SMS_MESSAGE,
  });

  if (sms.status === "sent") {
    await complete(service, row.id, {
      p_status: "sms_sent",
      p_outcome: "sms",
      p_call_status: opts.callStatus,
      p_sms_sid: sms.sid ?? null,
      p_sms_status: "sent",
      p_sms_attempted: true,
    });
    return { ok: true, action: "sms_sent" };
  }

  await complete(service, row.id, {
    p_status: "failed",
    p_outcome: "failed",
    p_call_status: opts.callStatus,
    p_sms_status: sms.status,
    p_error_detail: sms.error ?? "sms fallback failed",
    p_sms_attempted: true,
  });
  return { ok: true, action: "sms_failed" };
}

async function sendSmsFallbackForEscalation(
  service: ReturnType<typeof getServiceSupabase>,
  escalationId: string,
  phone: string,
  callStatus: string,
  callError: string | null,
): Promise<CallParentResult> {
  const sms = await sendParentAttentionSms({
    toE164: phone,
    body: CALL_PARENT_SMS_MESSAGE,
  });

  if (sms.status === "sent") {
    await complete(service, escalationId, {
      p_status: "sms_sent",
      p_outcome: "sms",
      p_call_provider: "twilio",
      p_call_status: callStatus,
      p_error_detail: callError,
      p_sms_sid: sms.sid ?? null,
      p_sms_status: "sent",
      p_call_attempted: true,
      p_sms_attempted: true,
    });
    return resultOf(escalationId, "parent_alerted_sms");
  }

  await complete(service, escalationId, {
    p_status: "failed",
    p_outcome: "failed",
    p_call_provider: "twilio",
    p_call_status: callStatus,
    p_sms_status: sms.status,
    p_error_detail: [callError, sms.error].filter(Boolean).join("; ") || "call and sms failed",
    p_call_attempted: true,
    p_sms_attempted: true,
  });
  return resultOf(escalationId, "unable_to_contact");
}

async function complete(
  service: ReturnType<typeof getServiceSupabase>,
  id: string,
  args: Record<string, unknown>,
) {
  await service.rpc("complete_parent_escalation", {
    p_id: id,
    p_status: args.p_status,
    p_outcome: args.p_outcome,
    p_call_provider: args.p_call_provider ?? null,
    p_call_sid: args.p_call_sid ?? null,
    p_call_status: args.p_call_status ?? null,
    p_sms_sid: args.p_sms_sid ?? null,
    p_sms_status: args.p_sms_status ?? null,
    p_error_detail: args.p_error_detail ?? null,
    p_call_attempted: Boolean(args.p_call_attempted),
    p_sms_attempted: Boolean(args.p_sms_attempted),
  });
}

function resultOf(escalationId: string, guideStatus: CallParentGuideStatus): CallParentResult {
  return {
    escalationId,
    guideStatus,
    message: guideMessage(guideStatus),
  };
}

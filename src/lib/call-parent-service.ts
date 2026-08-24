import "server-only";

import {
  CALL_PARENT_SMS_MESSAGE,
  CALL_PARENT_VOICE_MESSAGE,
} from "@/lib/call-parent.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";
import { isTwilioConfigured } from "@/lib/telephony/config";
import { placeParentAttentionCall, sendParentAttentionSms } from "@/lib/telephony/client";

export type CallParentGuideStatus =
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

/**
 * After `request_parent_escalation` inserted a pending row, place the call
 * (SMS fallback) using service-role phone lookup. Never returns the phone.
 */
export async function fulfillParentEscalation(escalationId: string): Promise<CallParentResult> {
  const service = getServiceSupabase();

  const { data: row, error } = await service
    .from("parent_escalation_requests")
    .select("id, account_id, status")
    .eq("id", escalationId)
    .maybeSingle();

  if (error || !row) {
    return {
      escalationId,
      guideStatus: "unable_to_contact",
      message: "Unable to contact parent — notify manager",
    };
  }

  if (row.status !== "pending") {
    return mapExisting(row.status, escalationId);
  }

  if (!isTwilioConfigured()) {
    await complete(service, escalationId, {
      p_status: "not_configured",
      p_outcome: "not_configured",
      p_error_detail: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER missing",
    });
    return {
      escalationId,
      guideStatus: "not_configured",
      message: "Unable to contact parent — notify manager",
    };
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
    return {
      escalationId,
      guideStatus: "unable_to_contact",
      message: "Unable to contact parent — notify manager",
    };
  }

  const call = await placeParentAttentionCall({
    toE164: phone,
    message: CALL_PARENT_VOICE_MESSAGE,
  });

  if (call.status === "queued") {
    await complete(service, escalationId, {
      p_status: "call_placed",
      p_outcome: "call",
      p_call_provider: "twilio",
      p_call_sid: call.sid ?? null,
      p_call_status: "queued",
      p_call_attempted: true,
    });
    return {
      escalationId,
      guideStatus: "parent_contacted",
      message: "Parent contacted",
    };
  }

  // Call not placed → SMS fallback
  const sms = await sendParentAttentionSms({
    toE164: phone,
    body: CALL_PARENT_SMS_MESSAGE,
  });

  if (sms.status === "sent") {
    await complete(service, escalationId, {
      p_status: "sms_sent",
      p_outcome: "sms",
      p_call_provider: "twilio",
      p_call_status: call.status,
      p_error_detail: call.error ?? null,
      p_sms_sid: sms.sid ?? null,
      p_sms_status: "sent",
      p_call_attempted: true,
      p_sms_attempted: true,
    });
    return {
      escalationId,
      guideStatus: "parent_alerted_sms",
      message: "Parent alerted by text",
    };
  }

  await complete(service, escalationId, {
    p_status: "failed",
    p_outcome: "failed",
    p_call_provider: "twilio",
    p_call_status: call.status,
    p_sms_status: sms.status,
    p_error_detail: [call.error, sms.error].filter(Boolean).join("; ") || "call and sms failed",
    p_call_attempted: true,
    p_sms_attempted: true,
  });

  return {
    escalationId,
    guideStatus: "unable_to_contact",
    message: "Unable to contact parent — notify manager",
  };
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

function mapExisting(status: string, escalationId: string): CallParentResult {
  if (status === "call_placed") {
    return { escalationId, guideStatus: "parent_contacted", message: "Parent contacted" };
  }
  if (status === "sms_sent") {
    return { escalationId, guideStatus: "parent_alerted_sms", message: "Parent alerted by text" };
  }
  return {
    escalationId,
    guideStatus: "unable_to_contact",
    message: "Unable to contact parent — notify manager",
  };
}

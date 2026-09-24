/**
 * Guide application WhatsApp number → E.164.
 * Same shape as profiles.phone_e164. Does not send messages.
 */

export const GUIDE_PHONE_E164 = /^\+[1-9][0-9]{7,14}$/;

/** Calling codes applicants can pick. National numbers are combined with these. */
export const GUIDE_CALLING_CODES = Object.freeze([
  { id: "US", label: "United States / Canada", callingCode: "+1" },
  { id: "GB", label: "United Kingdom", callingCode: "+44" },
  { id: "KE", label: "Kenya", callingCode: "+254" },
  { id: "NG", label: "Nigeria", callingCode: "+234" },
  { id: "GH", label: "Ghana", callingCode: "+233" },
  { id: "ZA", label: "South Africa", callingCode: "+27" },
  { id: "UG", label: "Uganda", callingCode: "+256" },
  { id: "TZ", label: "Tanzania", callingCode: "+255" },
  { id: "IN", label: "India", callingCode: "+91" },
  { id: "PH", label: "Philippines", callingCode: "+63" },
]);

export function isGuidePhoneE164(value) {
  return typeof value === "string" && GUIDE_PHONE_E164.test(value.trim());
}

/**
 * @param {string | null | undefined} raw national number, or a full +E.164
 * @param {string | null | undefined} callingCode selected country code, including +
 * @returns {string | null}
 */
export function normalizeGuidePhone(raw, callingCode) {
  const compact = String(raw ?? "")
    .trim()
    .replace(/[\s().-]/g, "");
  if (!compact) return null;

  if (compact.startsWith("+")) {
    return isGuidePhoneE164(compact) ? compact : null;
  }
  if (compact.startsWith("00")) {
    const intl = `+${compact.slice(2)}`;
    return isGuidePhoneE164(intl) ? intl : null;
  }

  const code = String(callingCode ?? "").trim();
  if (!/^\+[1-9][0-9]{0,3}$/.test(code)) return null;
  const national = compact.replace(/^0+/, "");
  if (!/^[0-9]{6,14}$/.test(national)) return null;
  const combined = `${code}${national}`;
  return isGuidePhoneE164(combined) ? combined : null;
}

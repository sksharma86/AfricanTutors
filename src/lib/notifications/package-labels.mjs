/**
 * Study Hall package / prepaid hours labels (pure).
 * Maps product minutes → friendly package name for receipts.
 */

export function packageHoursLabel(minutes) {
  const m = Number(minutes) || 0;
  const hrs = m / 60;
  if (m === 840) return "14 Hour Routine";
  if (m === 1680) return "28 Hour Routine";
  if (Number.isInteger(hrs)) return `${hrs} Hour Study Hall package`;
  return `${hrs.toFixed(1)} Hour Study Hall package`;
}

export function hoursFromMinutes(minutes) {
  const m = Number(minutes) || 0;
  const hrs = m / 60;
  return Number.isInteger(hrs) ? String(hrs) : hrs.toFixed(1);
}

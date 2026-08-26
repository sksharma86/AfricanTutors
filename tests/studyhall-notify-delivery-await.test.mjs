import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * Distinguishes `await notifyX(...)` from fire-and-forget `void notifyX(...)`.
 * Does not merely assert that the symbol name appears in the file.
 */
function assertAwaitedNotify(source, fnName, { tryCatch = true } = {}) {
  const voidCall = new RegExp(`void\\s+${fnName}\\s*\\(`);
  assert.doesNotMatch(source, voidCall, `${fnName} must not be fire-and-forget (void)`);

  const awaited = new RegExp(`await\\s+${fnName}\\s*\\(`);
  assert.match(source, awaited, `${fnName} must be awaited`);

  if (tryCatch) {
    // Best-effort: await inside try so provider failure cannot roll back the mutation response.
    const tryAwait = new RegExp(`try\\s*\\{[\\s\\S]{0,200}?await\\s+${fnName}\\s*\\(`);
    assert.match(source, tryAwait, `${fnName} await should be wrapped in try/catch for best-effort delivery`);
  }
}

describe("Notify delivery hardening — await vs void (source)", () => {
  const checkout = read("src/lib/checkout-service.ts");
  const stripeWh = read("src/app/api/stripe/webhook/route.ts");
  const cancel = read("src/app/api/bookings/cancel/route.ts");
  const report = read("src/app/api/tutor/session-report/route.ts");
  const guideCancel = read("src/app/api/tutor/cancellation-request/route.ts");
  const disputes = read("src/app/api/disputes/route.ts");
  const adminBooking = read("src/app/api/admin/booking/route.ts");
  const refund = read("src/app/api/admin/refund/route.ts");
  const disputeAdmin = read("src/app/api/admin/dispute/route.ts");
  const transport = read("src/lib/email/transport.ts");
  const notify = read("src/lib/notify.ts");

  it("free / prepaid / full-credit booking path awaits notifyBookingConfirmed (not void)", () => {
    // Immediate confirm branch is the stripe_cents_due <= 0 block.
    assert.match(checkout, /stripe_cents_due\s*<=\s*0/);
    assert.match(checkout, /funding !== "request"/);
    assertAwaitedNotify(checkout, "notifyBookingConfirmed");
  });

  it("zero-Stripe package purchase awaits notifyPackagePurchased (not void)", () => {
    assertAwaitedNotify(checkout, "notifyPackagePurchased");
  });

  it("PAYG Stripe webhook still awaits notifyBookingConfirmed after fulfillment", () => {
    assertAwaitedNotify(stripeWh, "notifyBookingConfirmed", { tryCatch: false });
    assert.match(stripeWh, /await notifyPackagePurchased/);
    assert.match(stripeWh, /result\?\.status === "confirmed"/);
    // Webhook notifyFulfillment already catches; must not use void.
    assert.doesNotMatch(stripeWh, /void\s+notifyBookingConfirmed/);
  });

  it("notification failure cannot undo booking: await is best-effort try/catch after book_session", () => {
    // book_session completes before notify; notify errors are swallowed.
    const block = checkout.slice(
      checkout.indexOf("stripe_cents_due <= 0"),
      checkout.indexOf("Stripe amount is due"),
    );
    assert.match(block, /await\s+notifyBookingConfirmed/);
    assert.match(block, /try\s*\{/);
    assert.match(block, /best-effort|catch\s*\{/);
    // No cancel_pending_payment / rollback in the notify catch path.
    assert.doesNotMatch(block, /cancel_pending_payment|rollbackReservation/);
  });

  it("customer cancel / report-ready / Guide cancel / disputes await notifications", () => {
    assertAwaitedNotify(cancel, "notifyCancellation");
    assertAwaitedNotify(report, "notifySessionReportReady");
    assertAwaitedNotify(guideCancel, "notifyReassignment");
    assertAwaitedNotify(guideCancel, "notifyAdminAlert");
    assertAwaitedNotify(disputes, "notifyDisputeReceived");
  });

  it("admin reassignment / refund / dispute-resolved await notifications", () => {
    assertAwaitedNotify(adminBooking, "notifyReassignment");
    assertAwaitedNotify(refund, "notifyRefund");
    assertAwaitedNotify(disputeAdmin, "notifyDisputeResolved");
  });

  it("idempotency keys for booking + package remain claim-based", () => {
    assert.match(notify, /booking-confirmed:\$\{bookingId\}/);
    assert.match(notify, /package-purchased:\$\{paymentId\}/);
    assert.match(notify, /claim_email_delivery/);
    assert.match(notify, /if \(claim\.data !== true\) return \{ status: "duplicate" \}/);
  });

  it("email transport logs sent/failed without logging recipient or body", () => {
    assert.match(transport, /\[email\] sent/);
    assert.match(transport, /console\.error\(`\[email\] failed/);
    assert.doesNotMatch(transport, /\[email\] sent[\s\S]{0,80}to=/);
    assert.doesNotMatch(transport, /console\.(info|error).*html/);
    // Must not interpolate the raw API key into log strings.
    assert.doesNotMatch(transport, /console\.(info|error)[^\n]*RESEND_API_KEY/);
  });

  it("pricing / payment semantics unchanged in checkout-service", () => {
    assert.match(checkout, /book_session/);
    assert.match(checkout, /purchase_package/);
    assert.match(checkout, /stripe_cents_due/);
    assert.match(checkout, /cancel_pending_payment/);
    assert.doesNotMatch(checkout, /14000|25200|SESSION_OPTIONS/);
  });

  it("no fire-and-forget void notify remains in mutation API routes", () => {
    const files = [
      "src/lib/checkout-service.ts",
      "src/app/api/bookings/cancel/route.ts",
      "src/app/api/tutor/session-report/route.ts",
      "src/app/api/tutor/cancellation-request/route.ts",
      "src/app/api/disputes/route.ts",
      "src/app/api/admin/booking/route.ts",
      "src/app/api/admin/refund/route.ts",
      "src/app/api/admin/dispute/route.ts",
      "src/app/api/daily/webhook/route.ts",
      "src/app/api/cron/recording-retention/route.ts",
      "src/app/dashboard/admin/actions.ts",
      "src/lib/call-parent-service.ts",
    ];
    for (const f of files) {
      const src = read(f);
      assert.doesNotMatch(src, /void\s+notify[A-Z]/, `${f} still has void notify*`);
    }
  });
});

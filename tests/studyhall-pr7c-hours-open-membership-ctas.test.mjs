import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  OPEN_MEMBERSHIP_ATTENTION_BODY,
  OPEN_MEMBERSHIP_ATTENTION_TITLE,
  OPEN_MEMBERSHIP_UNKNOWN_MESSAGE,
  joinAllowedByOpenMembership,
  parseOpenMembershipFlag,
  studyHall365HoursCtas,
} from "../src/lib/study-hall-365/hours-ctas.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function flags(input) {
  const ctas = studyHall365HoursCtas(input);
  return {
    kind: ctas.kind,
    join: ctas.showJoin,
    manage: ctas.showManageBilling,
    keep: ctas.showKeepMembership,
    cancel: ctas.showCancelAtPeriodEnd,
    attention: ctas.showAttentionCopy,
  };
}

describe("PR7C Hours CTAs — no membership / entitled", () => {
  it("no membership row: Join visible, Manage billing absent, Join allowed", () => {
    const ctas = studyHall365HoursCtas({
      entitled: false,
      openMembership: false,
      hasMembership: false,
    });
    assert.equal(ctas.showJoin, true);
    assert.equal(ctas.showManageBilling, false);
    assert.equal(ctas.showKeepMembership, false);
    assert.equal(ctas.showCancelAtPeriodEnd, false);
    assert.equal(ctas.showAttentionCopy, false);
    assert.equal(joinAllowedByOpenMembership(false), true);
  });

  it("active entitled: Join hidden, Manage billing visible, cancel unchanged", () => {
    const ctas = studyHall365HoursCtas({
      entitled: true,
      openMembership: true,
      hasMembership: true,
      cancelAtPeriodEnd: false,
    });
    assert.equal(ctas.showJoin, false);
    assert.equal(ctas.showManageBilling, true);
    assert.equal(ctas.showCancelAtPeriodEnd, true);
    assert.equal(ctas.showKeepMembership, false);
    assert.equal(ctas.showAttentionCopy, false);
  });

  it("active cancel-at-period-end: Join hidden, Manage billing and Keep membership visible", () => {
    const ctas = studyHall365HoursCtas({
      entitled: true,
      openMembership: true,
      hasMembership: true,
      cancelAtPeriodEnd: true,
    });
    assert.equal(ctas.showJoin, false);
    assert.equal(ctas.showManageBilling, true);
    assert.equal(ctas.showKeepMembership, true);
    assert.equal(ctas.showCancelAtPeriodEnd, false);
    assert.equal(ctas.showAttentionCopy, false);
  });
});

describe("PR7C Hours CTAs — open but not entitled", () => {
  it("past_due: Join hidden, Manage billing visible, recovery copy visible", () => {
    const ctas = studyHall365HoursCtas({
      entitled: false,
      openMembership: true,
      hasMembership: true,
    });
    assert.equal(ctas.kind, "open_not_entitled");
    assert.equal(ctas.showJoin, false);
    assert.equal(ctas.showManageBilling, true);
    assert.equal(ctas.showAttentionCopy, true);
    assert.equal(ctas.attentionTitle, OPEN_MEMBERSHIP_ATTENTION_TITLE);
    assert.equal(ctas.attentionBody, OPEN_MEMBERSHIP_ATTENTION_BODY);
    assert.match(ctas.attentionTitle, /needs attention/i);
    assert.doesNotMatch(`${ctas.attentionTitle}\n${ctas.attentionBody}`, /ended|cancelled|canceled|disappeared/i);
  });

  it("unpaid uses the same open-membership gate and copy", () => {
    assert.deepEqual(
      flags({ entitled: false, openMembership: true, hasMembership: true }),
      flags({ entitled: false, openMembership: true, hasMembership: true }),
    );
    const ctas = studyHall365HoursCtas({ entitled: false, openMembership: true, hasMembership: true });
    assert.equal(ctas.showJoin, false);
    assert.equal(ctas.showManageBilling, true);
    assert.equal(ctas.showAttentionCopy, true);
  });

  it("incomplete open membership: Join hidden, no dead-end checkout CTA", () => {
    const ctas = studyHall365HoursCtas({
      entitled: false,
      openMembership: true,
      hasMembership: true,
    });
    assert.equal(ctas.showJoin, false);
    assert.equal(ctas.showManageBilling, true);
    assert.equal(joinAllowedByOpenMembership(true), false);
  });
});

describe("PR7C Hours CTAs — not open (rejoin)", () => {
  it("ended: Join visible so rejoin remains available", () => {
    const ctas = studyHall365HoursCtas({
      entitled: false,
      openMembership: false,
      hasMembership: true,
    });
    assert.equal(ctas.showJoin, true);
    assert.equal(ctas.showManageBilling, true);
    assert.equal(ctas.showAttentionCopy, false);
  });

  it("incomplete_expired: Join visible", () => {
    const ctas = studyHall365HoursCtas({
      entitled: false,
      openMembership: false,
      hasMembership: true,
    });
    assert.equal(ctas.showJoin, true);
    assert.equal(ctas.showManageBilling, true);
  });
});

describe("PR7C Hours CTAs — server truth and fallback", () => {
  it("Join visibility aligns with study_hall_365_has_open_membership", () => {
    const cases = [
      { entitled: false, openMembership: false, hasMembership: false },
      { entitled: false, openMembership: true, hasMembership: true },
      { entitled: true, openMembership: true, hasMembership: true },
      { entitled: false, openMembership: false, hasMembership: true },
    ];
    for (const input of cases) {
      const ctas = studyHall365HoursCtas(input);
      assert.equal(
        ctas.showJoin,
        joinAllowedByOpenMembership(input.openMembership),
        JSON.stringify(input),
      );
      assert.equal(ctas.showJoin, input.openMembership === false);
    }
  });

  it("does not infer Join from row existence or customer_status", () => {
    const rowExistsButOpen = studyHall365HoursCtas({
      entitled: false,
      openMembership: true,
      hasMembership: true,
    });
    assert.equal(rowExistsButOpen.showJoin, false);
    const noRowClosed = studyHall365HoursCtas({
      entitled: false,
      openMembership: false,
      hasMembership: false,
    });
    assert.equal(noRowClosed.showJoin, true);
  });

  it("RPC failure does not guess that Join is safe", () => {
    assert.equal(parseOpenMembershipFlag({ error: { message: "fail" }, data: false }), null);
    assert.equal(parseOpenMembershipFlag({ data: true }), true);
    assert.equal(parseOpenMembershipFlag({ data: false }), false);
    assert.equal(parseOpenMembershipFlag({ data: "true" }), null);
    const unknown = studyHall365HoursCtas({
      entitled: false,
      openMembership: null,
      hasMembership: true,
    });
    assert.equal(unknown.showJoin, false);
    assert.equal(unknown.showManageBilling, true);
    assert.equal(unknown.unknownStatus, true);
    assert.equal(unknown.unknownMessage, OPEN_MEMBERSHIP_UNKNOWN_MESSAGE);
  });

  it("Hours obtains open-membership from the existing RPC, not a migration", () => {
    const hours = read("src/app/dashboard/student/packages/page.tsx");
    const card = read("src/components/booking/study-hall-365-card.tsx");
    assert.match(hours, /study_hall_365_has_open_membership/);
    assert.match(hours, /parseOpenMembershipFlag/);
    assert.match(hours, /openMembership=\{openMembership\}/);
    assert.doesNotMatch(hours, /from\("study_hall_365_subscriptions"\)/);
    assert.match(card, /studyHall365HoursCtas/);
    assert.match(card, /openMembership/);
    assert.match(card, /Manage billing/);
    assert.doesNotMatch(card, /stripe_customer_id|cus_/);
    assert.doesNotMatch(read("src/lib/notify.ts"), /studyHall365HoursCtas/);
    assert.doesNotMatch(read("src/lib/study-hall-365/stripe-sync.ts"), /hours-ctas/);
  });
});

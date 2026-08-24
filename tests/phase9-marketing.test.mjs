import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { adminClient, hasSupabaseEnv } from "./helpers.mjs";
import { packageEconomics } from "../src/lib/packages.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Marketing source surface we scan for claims / leakage.
const MARKETING_FILES = [
  "src/app/(marketing)/page.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  "src/app/(marketing)/subjects/page.tsx",
  "src/app/(marketing)/faq/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/free-trial-section.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/trust-safety.tsx",
  "src/components/marketing/trust-row.tsx",
  "src/components/marketing/subjects-section.tsx",
  "src/components/marketing/audiences.tsx",
  "src/components/marketing/faq.tsx",
  "src/components/layout/navbar.tsx",
  "src/components/layout/mobile-menu.tsx",
  "src/components/layout/footer.tsx",
  "src/lib/faq.ts",
];
const marketingText = MARKETING_FILES.map(read).join("\n");

describe("Phase 9 — package pricing claims (items 6-10)", () => {
  it("10/20/40-hour packages: price, effective rate, savings", () => {
    const p10 = packageEconomics(600, 19000);
    assert.deepEqual([p10.priceCents ?? 19000, p10.effectiveHourlyCents, p10.savingsCents], [19000, 1900, 1000]);
    const p20 = packageEconomics(1200, 36000);
    assert.deepEqual([p20.effectiveHourlyCents, p20.savingsCents], [1800, 4000]);
    const p40 = packageEconomics(2400, 68000);
    assert.deepEqual([p40.effectiveHourlyCents, p40.savingsCents], [1700, 12000]);
  });
});

describe("Phase 9 — marketing copy matches real business rules", () => {
  const faq = read("src/lib/faq.ts");
  const pricing = read("src/components/marketing/pricing-section.tsx");
  const trust = read("src/components/marketing/trust-safety.tsx");

  it("FAQ free-trial answer is account-scoped, 30 min, no card (items 1,2,19)", () => {
    assert.match(faq, /one per account/i);
    assert.match(faq, /first 30-minute session/i);
    assert.match(faq, /no credit card/i);
  });

  it("FAQ cancellation answer matches the 24-hour policy (item 18)", () => {
    assert.match(faq, /24 or more hours/i);
    assert.match(faq, /non-refundable/i);
  });

  it("packages are prepaid (not subscriptions) and never expire (items 11,12)", () => {
    assert.match(pricing, /not a subscription/i);
    assert.match(pricing, /never expire/i);
    assert.match(faq, /never expire/i);
    assert.doesNotMatch(marketingText, /subscription plan|monthly plan|recurring billing subscription/i);
  });

  it("trust/safety avoids absolute claims and matches real controls (item 14)", () => {
    assert.doesNotMatch(marketingText, /100% safe|guaranteed safe|completely secure|totally safe/i);
    assert.match(trust, /recorded for quality and safety/i);
    assert.match(trust, /approved before they work with families/i);
  });

  it("no fabricated testimonials, reviews, ratings, or press claims (item 13)", () => {
    assert.doesNotMatch(marketingText, /testimonial|as seen in|featured in|\b5[- ]star|★|reviews from|trusted by (thousands|millions)|\b\d{1,3},?\d{3}\+? (families|students|customers|tutors)/i);
  });

  it("no raw internal enums on marketing pages (item 21)", () => {
    assert.doesNotMatch(marketingText, /awaiting_payment|no_show|not_required|requires_payment|payment_status|booking_status/);
  });

  it("no tutor private-contact leakage on marketing pages (item 20)", () => {
    assert.doesNotMatch(marketingText, /mailto:/i);
    assert.doesNotMatch(marketingText, /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/); // phone-like
  });
});

describe("Phase 9 — CTA routing & navigation semantics (items 15,16,17)", () => {
  const home = read("src/app/(marketing)/page.tsx");
  const mobile = read("src/components/layout/mobile-menu.tsx");
  const navbar = read("src/components/layout/navbar.tsx");

  it("anonymous primary CTA routes to signup with consistent label (item 15)", () => {
    assert.match(home, /href:\s*"\/signup",\s*label:\s*"Start free session"/);
  });

  it("authenticated student CTA routes to booking (item 16)", () => {
    assert.match(home, /role === "student"/);
    assert.match(home, /\/dashboard\/student\/book/);
    assert.match(navbar, /getCurrentUser/);
  });

  it("mobile navigation is accessible and auth-aware (item 17)", () => {
    assert.match(mobile, /aria-expanded/);
    assert.match(mobile, /aria-label/);
    assert.match(mobile, /md:hidden/);
    assert.match(mobile, /isAuthed/);
  });
});

describe("Phase 9 — SEO metadata exists (item 22)", () => {
  it("root layout defines OpenGraph, Twitter, and metadataBase", () => {
    const layout = read("src/app/layout.tsx");
    assert.match(layout, /metadataBase/);
    assert.match(layout, /openGraph/);
    assert.match(layout, /twitter/);
  });
  it("homepage exports metadata with a description", () => {
    const home = read("src/app/(marketing)/page.tsx");
    assert.match(home, /export const metadata/);
    assert.match(home, /description:/);
  });
});

describe("Phase 9 — authoritative pricing & free trial (live)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const ANY = "00000000-0000-0000-0000-000000000001";

  it("standard session prices are $12 / $20 (items 4,5)", async () => {
    const q30 = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 30, p_is_free_trial: false });
    assert.equal(q30.data.session_price_cents, 1200);
    const q60 = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 60, p_is_free_trial: false });
    assert.equal(q60.data.session_price_cents, 2000);
  });

  it("free trial quote is $0 with no payment due (items 1,2)", async () => {
    const qf = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 30, p_is_free_trial: true });
    assert.equal(qf.data.session_price_cents, 0);
    assert.equal(qf.data.stripe_cents_due, 0);
    assert.equal(qf.data.funding, "free_trial");
  });

  it("prepaid packages are $190 / $360 / $680 (items 6,7,8)", async () => {
    const { data } = await svc
      .from("package_products")
      .select("minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    const rows = (data ?? []).map((r) => [r.minutes, r.price_cents]);
    assert.deepEqual(rows, [[600, 19000], [1200, 36000], [2400, 68000]]);
  });

  it("free trial is enforced one-per-account (item 3: account helper exists)", async () => {
    const r = await svc.rpc("account_has_used_free_trial", { p_account: ANY });
    assert.equal(r.error, null);
    assert.equal(typeof r.data, "boolean");
  });
});

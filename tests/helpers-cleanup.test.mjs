import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import {
  adminClient,
  CANONICAL_DEMO_PROJECT_REF,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  isCanonicalDemoProject,
} from "./helpers.mjs";

describe("Test cleanup infrastructure", () => {
  it("identifies the canonical demo project from the Supabase URL", () => {
    assert.equal(isCanonicalDemoProject(`https://${CANONICAL_DEMO_PROJECT_REF}.supabase.co`), true);
    assert.equal(isCanonicalDemoProject("https://some-other-project.supabase.co"), false);
  });

  it("refuses createUser when DEMO_DB_LOCK=1 on the demo project", async () => {
    if (!isCanonicalDemoProject()) return;
    const prev = process.env.DEMO_DB_LOCK;
    process.env.DEMO_DB_LOCK = "1";
    try {
      await assert.rejects(() => createUser({ displayName: "Lock Probe" }), /DEMO_DB_LOCK/);
    } finally {
      if (prev === undefined) delete process.env.DEMO_DB_LOCK;
      else process.env.DEMO_DB_LOCK = prev;
    }
  });
});

describe("cleanupAll fails loudly and honors RESTRICT order", { skip: !hasSupabaseEnv }, () => {
  after(async () => {
    await cleanupAll();
  });

  it("removes a user even when a RESTRICT payment row exists", async () => {
    const user = await createUser({ displayName: "Cleanup Probe" });
    const admin = adminClient();
    const { error } = await admin.from("payments").insert({
      account_id: user.id,
      purpose: "booking",
      gross_cents: 0,
      status: "canceled",
    });
    assert.equal(error, null, error?.message);
    await cleanupAll();
    const { count } = await admin.from("payments").select("*", { count: "exact", head: true }).eq("account_id", user.id);
    assert.equal(count, 0);
    const { data, error: lookupErr } = await admin.auth.admin.getUserById(user.id);
    assert.ok(!data?.user, lookupErr?.message || "auth user should be gone");
  });
});

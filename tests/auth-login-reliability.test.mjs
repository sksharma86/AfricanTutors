import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";

import { AuthLookupTimeoutError, getUserBounded, withTimeout } from "../src/lib/auth-user.mjs";
import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Auth login reliability — source wiring", () => {
  it("browser client is a singleton", () => {
    const client = read("src/lib/supabase/client.ts");
    assert.match(client, /let browserClient/);
    assert.match(client, /if \(!browserClient\)/);
  });

  it("getCurrentUser is request-cached and uses bounded getUser", () => {
    const auth = read("src/lib/auth.ts");
    assert.match(auth, /from "react"/);
    assert.match(auth, /cache\(/);
    assert.match(auth, /auth-user\.mjs/);
    assert.match(auth, /getUserBounded/);
    assert.match(auth, /DASHBOARD_PATH_BY_ROLE/);
  });

  it("proxy and callback use bounded getUser", () => {
    assert.match(read("src/proxy.ts"), /getUserBounded/);
    assert.match(read("src/app/auth/callback/route.ts"), /getUserBounded/);
  });

  it("login hard-navigates after success and cannot stay on Logging in forever", () => {
    const login = read("src/components/auth/login-form.tsx");
    assert.match(login, /location\.assign/);
    assert.match(login, /20_000|20000/);
    assert.match(login, /We couldn’t sign you in right now/);
    assert.doesNotMatch(login, /router\.push\(/);
    assert.doesNotMatch(login, /router\.refresh\(/);
    assert.doesNotMatch(login, /error\.message\}/);
    assert.match(login, /sanitizeNextPath/);
  });

  it("Parent Home does not await welcome email", () => {
    const page = read("src/app/dashboard/student/page.tsx");
    assert.match(page, /notifyWelcome/);
    assert.match(page, /void notifyWelcome/);
    assert.match(page, /getGuideApplicantInfo/);
    assert.doesNotMatch(page, /await notifyWelcome/);
  });

  it("email transport cannot hang forever on Resend", () => {
    assert.match(read("src/lib/email/transport.ts"), /AbortSignal\.timeout/);
  });

  it("logout hard-navigates and roles are unchanged", () => {
    assert.match(read("src/components/dashboard/logout-button.tsx"), /location\.assign\("\/"\)/);
    const roles = read("src/lib/roles.ts");
    assert.match(roles, /student: "\/dashboard\/student"/);
    assert.match(roles, /tutor: "\/dashboard\/tutor"/);
    assert.match(roles, /admin: "\/dashboard\/admin"/);
  });
});

describe("Auth login reliability — timeout helper", () => {
  it("withTimeout rejects when the lookup never settles", async () => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 20, "probe"),
      (err) => err instanceof AuthLookupTimeoutError,
    );
  });

  it("getUserBounded retries then fails closed without throwing", async () => {
    let calls = 0;
    const result = await getUserBounded(
      async () => {
        calls += 1;
        await new Promise(() => {});
        return { data: { user: { id: "x" } }, error: null };
      },
      { timeoutMs: 15, retries: 1, label: "probe.getUser" },
    );
    assert.equal(calls, 2);
    assert.equal(result.data.user, null);
    assert.match(result.error?.message ?? "", /timed out|failed/i);
  });

  it("getUserBounded returns the first successful lookup", async () => {
    const result = await getUserBounded(async () => ({ data: { user: { id: "ok" } }, error: null }), {
      timeoutMs: 200,
      retries: 1,
    });
    assert.equal(result.data.user?.id, "ok");
  });
});

describe(
  "Auth login reliability — live sign-in",
  { skip: !hasSupabaseEnv || process.env.ALLOW_DEMO_DB_WRITES !== "1" },
  () => {
  const svc = hasSupabaseEnv ? adminClient() : null;

  after(async () => {
    await cleanupAll();
  });

  it("password sign-in, getUser, and role homes stay correct", async () => {
    const parent = await createUser({ requestedRole: "student", displayName: "Auth Rel Parent" });
    const guide = await createUser({ requestedRole: "tutor", displayName: "Auth Rel Guide" });
    const admin = await createUser({ requestedRole: "student", displayName: "Auth Rel Admin" });
    await svc.from("tutor_profiles").update({ status: "approved" }).eq("profile_id", guide.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", guide.id);
    await makeAdmin(admin.id);

    const samples = [];
    for (const account of [parent, guide, admin]) {
      const t0 = Date.now();
      const client = await signIn(account.email, account.password);
      const authMs = Date.now() - t0;
      const t1 = Date.now();
      const { data, error } = await client.auth.getUser();
      const userMs = Date.now() - t1;
      assert.equal(error, null, error?.message);
      assert.equal(data.user?.id, account.id);
      const { data: profile } = await client.from("profiles").select("role").eq("id", account.id).maybeSingle();
      samples.push({ role: profile?.role, authMs, userMs });
      await client.auth.signOut();
    }

    assert.deepEqual(
      samples.map((s) => s.role),
      ["student", "tutor", "admin"],
    );
    for (const s of samples) {
      assert.ok(s.authMs < 15_000, `signIn too slow: ${s.authMs}`);
      assert.ok(s.userMs < 15_000, `getUser too slow: ${s.userMs}`);
    }
  });

  it("invalid password is rejected", async () => {
    const user = await createUser({ requestedRole: "student", displayName: "Auth Rel BadPw" });
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: user.email,
      password: "definitely-wrong-password-xx",
    });
    assert.ok(error);
    assert.match(error.message, /invalid/i);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  GUIDE_HOST,
  PARENT_ORIGIN,
  guideHostRoute,
  hostnameFrom,
  isGuideRecruitmentHost,
  isParentMarketingPath,
} from "../src/lib/guide-host.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Guide host routing", () => {
  it("recognizes only the guides host", () => {
    assert.equal(hostnameFrom("Guides.StudyHallAtHome.com:443"), GUIDE_HOST);
    assert.equal(hostnameFrom("guides.studyhallathome.com, studyhallathome.com"), GUIDE_HOST);
    assert.equal(isGuideRecruitmentHost(GUIDE_HOST), true);
    assert.equal(isGuideRecruitmentHost("studyhallathome.com"), false);
    assert.equal(isGuideRecruitmentHost("www.studyhallathome.com"), false);
    assert.equal(isGuideRecruitmentHost("localhost"), false);
  });

  it("serves the recruitment landing at / and sends parent marketing home", () => {
    assert.deepEqual(guideHostRoute(GUIDE_HOST, "/"), { type: "rewrite", pathname: "/guides" });
    assert.equal(guideHostRoute("studyhallathome.com", "/"), null);
    for (const path of ["/pricing", "/faq", "/how-it-works", "/signup", "/the-study-hall-hour"]) {
      assert.equal(isParentMarketingPath(path), true);
      assert.equal(guideHostRoute(GUIDE_HOST, path, "?x=1").destination, `${PARENT_ORIGIN}${path}?x=1`);
    }
    assert.equal(guideHostRoute(GUIDE_HOST, "/login"), null);
    assert.equal(guideHostRoute(GUIDE_HOST, "/apply-to-tutor"), null);
    assert.equal(guideHostRoute(GUIDE_HOST, "/guides/apply"), null);
    assert.equal(guideHostRoute(GUIDE_HOST, "/dashboard/tutor"), null);
    assert.equal(guideHostRoute(GUIDE_HOST, "/terms"), null);
    assert.equal(guideHostRoute(GUIDE_HOST, "/api/auth/signup"), null);
  });

  it("proxy applies the host decision before the supabase bypass", () => {
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /guideHostRoute/);
    assert.match(proxy, /x-forwarded-host/);
    assert.match(proxy, /NextResponse\.redirect\(guideRoute\.destination, 308\)/);
    assert.match(proxy, /NextResponse\.rewrite/);
    const hostAt = proxy.indexOf("guideHostRoute");
    const bypassAt = proxy.indexOf("if (!isSupabaseConfigured)");
    assert.ok(hostAt > 0 && hostAt < bypassAt);
    assert.match(proxy, /PROTECTED_PREFIXES = \["\/dashboard"\]/);
  });

  it("the landing sells the role and logs existing Guides into the current portal", () => {
    const page = read("src/app/guides/page.tsx");
    assert.match(page, /Become a Guide/);
    assert.match(page, /Already a Guide\? Log in/);
    assert.match(page, /href="\/apply-to-tutor"/);
    assert.match(page, /href="\/login"/);
    assert.match(page, /not tutoring/);
    assert.doesNotMatch(page, /\$12|\$99|\$149|Try It Free|Try your first Study Hall/);
    const login = read("src/app/(marketing)/login/page.tsx");
    assert.match(login, /isGuideRecruitmentHost/);
    assert.match(login, /Guide log in/);
    assert.match(login, /LoginForm/);
    const nav = read("src/components/layout/navbar.tsx");
    assert.match(nav, /guideSite \? "Log in" : "Sign In"/);
    assert.match(nav, /NAV_TRIAL_CTA/);
  });
});

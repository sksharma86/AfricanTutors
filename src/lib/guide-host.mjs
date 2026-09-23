/**
 * Host split for the Guide recruitment site.
 * guides.studyhallathome.com is the same app. Parents stay on studyhallathome.com.
 * Does not change auth, pricing, or the Guide portal.
 */

export const PARENT_ORIGIN = "https://studyhallathome.com";
export const GUIDE_HOST = "guides.studyhallathome.com";

/** Parent product pages. Auth, apply, dashboard, API, and legal stay on the Guide host. */
export const PARENT_MARKETING_PATHS = [
  "/pricing",
  "/faq",
  "/how-it-works",
  "/why-it-works",
  "/subjects",
  "/about",
  "/the-study-hall-hour",
  "/signup",
];

export function hostnameFrom(headerValue) {
  const first = String(headerValue ?? "").split(",")[0].trim().toLowerCase();
  if (!first) return "";
  return first.replace(/:\d+$/, "");
}

export function isGuideRecruitmentHost(hostname) {
  return hostname === GUIDE_HOST;
}

export function isParentMarketingPath(pathname) {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname || "/";
  return PARENT_MARKETING_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * What the Guide host should do with this request.
 * `/` is the recruitment landing (internal rewrite to /guides).
 * Parent marketing paths leave for the parent site.
 * Everything else (login, apply, dashboard, legal) stays.
 *
 * @returns {{ type: "rewrite", pathname: string } | { type: "redirect", destination: string } | null}
 */
export function guideHostRoute(hostname, pathname, search = "") {
  if (!isGuideRecruitmentHost(hostname)) return null;
  const path = pathname || "/";
  if (path === "/") return { type: "rewrite", pathname: "/guides" };
  if (isParentMarketingPath(path)) {
    const q = search && !search.startsWith("?") ? `?${search}` : search || "";
    return { type: "redirect", destination: `${PARENT_ORIGIN}${path}${q}` };
  }
  return null;
}

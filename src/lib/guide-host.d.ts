declare module "@/lib/guide-host.mjs" {
  export const PARENT_ORIGIN: string;
  export const GUIDE_HOST: string;
  export const PARENT_MARKETING_PATHS: readonly string[];
  export function hostnameFrom(headerValue: string | null | undefined): string;
  export function isGuideRecruitmentHost(hostname: string): boolean;
  export function isParentMarketingPath(pathname: string): boolean;
  export function guideHostRoute(
    hostname: string,
    pathname: string,
    search?: string,
  ): { type: "rewrite"; pathname: string } | { type: "redirect"; destination: string } | null;
}

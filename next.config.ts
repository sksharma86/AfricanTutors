import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    MANAGEMENT_VISUAL_REVIEW: process.env.MANAGEMENT_VISUAL_REVIEW ?? "",
    GUIDE_HOME_VISUAL_REVIEW: process.env.GUIDE_HOME_VISUAL_REVIEW ?? "",
  },
};

export default nextConfig;

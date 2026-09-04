import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  env: {
    MANAGEMENT_VISUAL_REVIEW: process.env.MANAGEMENT_VISUAL_REVIEW ?? "",
    GUIDE_HOME_VISUAL_REVIEW: process.env.GUIDE_HOME_VISUAL_REVIEW ?? "",
    STUDY_HALL_FILM: process.env.STUDY_HALL_FILM ?? "",
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oshi-geinin/db", "@oshi-geinin/shared"],
};

export default nextConfig;

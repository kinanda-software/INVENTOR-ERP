
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* Disable the Next.js development indicator */
  devIndicators: false,

  experimental: {
    agentFeedback: true,
  },

  cacheComponents: true,
  partialPrefetching: true,

  turbopack: {
    root: path.resolve(__dirname),

    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiInternalBase =
  process.env.INTERNAL_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Avoid SegmentViewNode / React Client Manifest errors in dev on Windows (Next 15.5+)
  experimental: {
    devtoolSegmentExplorer: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas memuat binary native (.node), jadi tidak boleh dibundle
  // oleh Webpack/Turbopack — biarkan di-load langsung lewat require() Node.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;

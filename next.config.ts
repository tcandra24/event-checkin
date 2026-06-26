import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas memuat binary native (.node), jadi tidak boleh dibundle
  // oleh Webpack/Turbopack — biarkan di-load langsung lewat require() Node.
  serverExternalPackages: ["@napi-rs/canvas"],

  // File font di-load dinamis lewat path.join() saat runtime, bukan lewat
  // `import` statis, sehingga Next.js's file tracer tidak otomatis
  // menyertakannya ke bundle serverless function saat deploy ke Vercel.
  // Tanpa baris ini, font akan hilang/gagal ditemukan di produksi padahal
  // normal saat development lokal.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/fonts/**"],
  },
};

export default nextConfig;

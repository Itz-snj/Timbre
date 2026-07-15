import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // archiver and adm-zip are CommonJS with export shapes Turbopack won't bundle
  // cleanly; keeping them external means Node require()s them at runtime with
  // correct interop (same treatment Next gives firebase-admin).
  serverExternalPackages: ["archiver", "adm-zip"],
};

export default nextConfig;

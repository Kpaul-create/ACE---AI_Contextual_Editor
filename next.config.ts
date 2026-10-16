import type { NextConfig } from "next";
import { flags } from "./src/flags";

const BACKEND = process.env.NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT ?? "http://localhost:8080";

/**
 * COOP + COEP headers are required for SharedArrayBuffer / WebContainer.
 * Applied via headers() in server mode; mirrored in public/_headers for
 * Cloudflare Pages static export mode (Phase 12 cutOver).
 *
 * NOTE: output:'export' requires all dynamic routes to have generateStaticParams().
 * Clerk auth routes (/sign-in, /sign-up) are catch-all server routes that cannot
 * be statically exported until auth is replaced (Phase 12). Static export is
 * therefore gated on flags.cutOver, not flags.deployGate.
 * flags.deployGate gates: COOP/COEP headers + DeployGateProbe only.
 */
const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
  { key: "Cross-Origin-Resource-Policy",  value: "cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND}/api/v1/:path*`,
      },
    ];
  },

  // COOP/COEP always on once deployGate is true — safe to apply in server mode.
  // _headers file handles the same for static export (Phase 12).
  ...(flags.deployGate && {
    async headers() {
      return [{ source: "/(.*)", headers: securityHeaders }];
    },
  }),
};

export default nextConfig;

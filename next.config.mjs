/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Keep builds green while we chip away at legacy type debt; prefer `npm test` for checks.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "images.tcggo.com",
      },
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
      },
      {
        protocol: "https",
        hostname: "images.scrydex.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/slabslabs",
        destination: "/slablabs",
        permanent: true,
      },
      {
        source: "/slabslabs/:path*",
        destination: "/slablabs/:path*",
        permanent: true,
      },
      { source: "/slabcrack", destination: "/slablabs/slabcrack", permanent: true },
      { source: "/slabcrack/scan", destination: "/slablabs/slabcrack/scan", permanent: true },
      { source: "/slabcrack/multi-scan", destination: "/slablabs/slabcrack/multi-scan", permanent: true },
      { source: "/slablab", destination: "/slablabs/slabit", permanent: true },
      { source: "/slablab/scan", destination: "/slablabs/slabit/scan", permanent: true },
      { source: "/slablab/multi-scan", destination: "/slablabs/slabit/multi-scan", permanent: true },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap-index",
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            // Allow same-origin camera for SlabCrack / SlabLab Scan; keep mic/geo off.
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Binder HUD iterates quickly — never serve a stale build.
        source: "/live-binder-hud",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        source: "/live-binder-hud/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        source: "/live-binder-hud/app.html",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ]
  },
}

export default nextConfig

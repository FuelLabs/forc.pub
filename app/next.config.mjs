const envVars = {
  API_URL: process.env.API_URL,
};

const apiUrlForClient = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
if (apiUrlForClient) {
  envVars.NEXT_PUBLIC_API_URL = apiUrlForClient;
}

const inferredAppOrigin =
  process.env.NEXT_PUBLIC_APP_ORIGIN ??
  process.env.APP_ORIGIN ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

if (inferredAppOrigin) {
  envVars.NEXT_PUBLIC_APP_ORIGIN = inferredAppOrigin;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  distDir: "build",
  env: envVars,
  images: {
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
  async headers() {
    return [
      {
        // Apply security headers to all documentation pages
        source: '/docs/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https://gateway.pinata.cloud https://ipfs.io https://*.amazonaws.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

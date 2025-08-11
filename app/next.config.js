/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable default CSP to allow our inline scripts
  async headers() {
    return []
  },
  // Skip CSP middleware
  poweredByHeader: false,
}

module.exports = nextConfig
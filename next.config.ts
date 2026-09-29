import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  allowedDevOrigins: ['hrms.infraplan.co.in'],
  experimental: {
    serverActions: {
      bodySizeLimit: '1000mb'
    },
    proxyClientMaxBodySize: '1000mb'
  }
};

export default nextConfig;
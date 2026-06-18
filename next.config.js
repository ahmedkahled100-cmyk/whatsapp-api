/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.BUILD_APK === 'true' ? 'export' : undefined,
  images: {
    unoptimized: process.env.BUILD_APK === 'true',
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '300mb',
    },
  },
};

module.exports = nextConfig;


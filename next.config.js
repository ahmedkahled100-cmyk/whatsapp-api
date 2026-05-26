/** @type {import('next').NextConfig} */
const nextConfig = {
  optimizeFonts: false,
  output: process.env.BUILD_APK === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
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


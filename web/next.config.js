/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
    ],
  },
  // Firebase Hosting에서 Next.js 지원
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:5002'],
    },
  },
};

module.exports = nextConfig;

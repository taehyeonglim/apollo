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
  // Firebase SDK 트랜스파일
  transpilePackages: ['firebase', '@firebase/functions', 'undici'],
  // Firebase SDK 및 Node.js 모듈 호환성 해결
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

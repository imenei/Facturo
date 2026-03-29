/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'facturo-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  },
};

module.exports = withPWA(nextConfig);

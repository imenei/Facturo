/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config')

const withPWA = require('next-pwa')({
  dest: 'public',
  register: false,
  disable: true,
});

const nextConfig = {
  reactStrictMode: true,
  i18n,
  swcMinify: false,
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    // Exclure docx du bundle webpack côté serveur (build time)
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('docx');
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);

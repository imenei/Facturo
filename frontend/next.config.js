/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config')

const withPWA = require('next-pwa')({
  dest: 'public',
  register: false,
  disable: true,
});

const nextConfig = {
  reactStrictMode: true,
  i18n: {
    ...i18n,
    localeDetection: false,
  },
  swcMinify: false,
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    return config;
  },
};

module.exports = withPWA(nextConfig);
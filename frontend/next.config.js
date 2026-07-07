/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config')
// La mise en cache PWA (Service Worker / Workbox) a été désactivée :
// elle provoquait des problèmes de version figée ("le site garde le cache").
// On garde next-pwa importé au cas où elle serait réactivée plus tard,
// mais disable:true empêche toute génération/enregistrement de Service Worker
// et toute mise en cache des assets ou des requêtes réseau.
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
};
module.exports = withPWA(nextConfig);

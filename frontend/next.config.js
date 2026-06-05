// next.config.js
// Using @ducanh2912/next-pwa — the maintained fork of next-pwa.
// The original next-pwa package is abandoned and incompatible with Next.js 14.

const withPWA = require('@ducanh2912/next-pwa').default

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable x-powered-by header — minor security hardening
  poweredByHeader: false,

  // All API calls go through NEXT_PUBLIC_API_URL — never hardcoded
  // No rewrites needed since the frontend calls the API directly
}

module.exports = withPWA({
  dest: 'public',
  // PWA disabled in dev to avoid service worker caching headaches during development
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})(nextConfig)

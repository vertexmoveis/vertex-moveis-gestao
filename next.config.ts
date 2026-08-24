import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'
const defaultAppOrigin = 'https://vertex-moveis-gestao.vercel.app'

function configuredAppOrigin() {
  try {
    return new URL(process.env.NEXTAUTH_URL?.trim() || defaultAppOrigin).origin
  } catch {
    return defaultAppOrigin
  }
}

const appOrigin = configuredAppOrigin()
const publicMetadataHeaders = [
  { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['bcryptjs'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Access-Control-Allow-Origin', value: appOrigin },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
        ],
      },
      {
        source: '/api/public/quote-approvals/:token/document',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/api/projects/:id/files/:fileId',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: publicMetadataHeaders,
      },
      {
        source: '/robots.txt',
        headers: publicMetadataHeaders,
      },
      {
        source: '/sitemap.xml',
        headers: publicMetadataHeaders,
      },
    ]
  },
}

export default nextConfig

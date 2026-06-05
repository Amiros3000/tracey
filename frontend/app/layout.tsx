/**
 * app/layout.tsx — Root layout.
 *
 * Wraps the entire app in:
 *   - AuthProvider (auth state + token management)
 *   - Viewport meta for mobile (no scaling, safe areas)
 *   - PWA meta tags for iOS "Add to Home Screen"
 */

import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'tracey',
  description: 'Personal finance tracker — private, encrypted, yours.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'tracey',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#22c55e',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Apple touch icon for "Add to Home Screen" */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

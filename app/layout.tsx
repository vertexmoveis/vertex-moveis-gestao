import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/providers'

export const metadata: Metadata = {
  title: 'Vertex Móveis — Gestão',
  description: 'Sistema de gestão de clientes e produção para Vertex Móveis',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Vertex',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#121212',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

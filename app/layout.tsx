import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/providers'

const appOrigin = process.env.NEXTAUTH_URL?.trim() || 'https://vertex-moveis-gestao.vercel.app'
const sharingTitle = 'Vertex Móveis | Móveis planejados sob medida'
const sharingDescription = 'Projetos de móveis planejados com atendimento, produção e instalação acompanhados pela Vertex Móveis.'

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin),
  title: 'Vertex Móveis — Gestão',
  description: sharingDescription,
  applicationName: 'Vertex Móveis',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '64x64' }],
    shortcut: '/icon.png',
    apple: [{ url: '/icon.png', type: 'image/png', sizes: '64x64' }],
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Vertex Móveis',
    title: sharingTitle,
    description: sharingDescription,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Vertex Móveis - Móveis planejados',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: sharingTitle,
    description: sharingDescription,
    images: ['/opengraph-image'],
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

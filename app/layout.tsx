import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/providers'

export const metadata: Metadata = {
  title: 'Vertex Móveis — Gestão',
  description: 'Sistema de gestão de clientes e produção para Vertex Móveis',
  icons: { icon: '/favicon.ico' },
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

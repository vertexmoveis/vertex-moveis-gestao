import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vertex Móveis - Gestão',
    short_name: 'Vertex',
    description: 'CRM, orçamentos, produção, financeiro e instalações da Vertex Móveis.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F5F5F5',
    theme_color: '#121212',
    lang: 'pt-BR',
    orientation: 'any',
    icons: [
      {
        src: '/icon.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}

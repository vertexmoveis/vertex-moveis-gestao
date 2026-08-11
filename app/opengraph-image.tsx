import { ImageResponse } from 'next/og'

export const alt = 'Vertex Móveis - Móveis planejados'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const appOrigin = process.env.NEXTAUTH_URL?.trim() || 'https://vertex-moveis-gestao.vercel.app'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#121212',
          color: '#FFFFFF',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: 1040,
            height: 470,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '10px solid #FF6B00',
            padding: '64px 70px',
            background: '#181818',
          }}
        >
          {/* ImageResponse requires a native image element. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${appOrigin}/vertex-symbol.png`}
            width={245}
            height={170}
            alt=""
            style={{ objectFit: 'contain' }}
          />

          <div style={{ width: 610, display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#FF6B00', fontSize: 24, fontWeight: 700, textTransform: 'uppercase' }}>
              Marcenaria sob medida
            </div>
            <div style={{ marginTop: 14, fontSize: 64, fontWeight: 800, lineHeight: 1 }}>
              Vertex Móveis
            </div>
            <div style={{ marginTop: 24, color: '#D5D5D5', fontSize: 30, lineHeight: 1.3 }}>
              Projetos, produção e instalação de móveis planejados.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}

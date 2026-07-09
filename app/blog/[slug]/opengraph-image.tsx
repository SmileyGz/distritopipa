import { ImageResponse } from 'next/og'
import { getPostData } from '../../../lib/markdown'

export const alt = 'Blog de Distrito Pipa Cancún'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string } }) {
  const postData = getPostData(params.slug)
  const title = postData ? postData.title : 'Cultura Distrito Pipa'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#1A1A1A',
          padding: '100px',
          border: '20px solid #DC143C',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              backgroundColor: '#DC143C',
              color: 'white',
              fontSize: '40px',
              fontWeight: 'bold',
              padding: '10px 30px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            DISTRITO PIPA
          </div>
          <div
            style={{
              color: '#888888',
              fontSize: '36px',
              marginLeft: '30px',
            }}
          >
            CANCÚN
          </div>
        </div>

        <div
          style={{
            color: '#FFFFFF',
            fontSize: '90px',
            fontWeight: 900,
            textTransform: 'uppercase',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            maxWidth: '1000px',
          }}
        >
          {title}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

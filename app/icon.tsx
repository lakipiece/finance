import { brand } from '@/lib/styles'
import { ImageResponse } from 'next/og'


export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: brand.iconBg,
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: brand.iconMark,
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          6
        </span>
      </div>
    ),
    { ...size }
  )
}

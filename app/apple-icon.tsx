import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#1e1e1e',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#FF1F8E',
            fontSize: 130,
            fontWeight: 700,
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          6
        </span>
      </div>
    ),
    { ...size }
  )
}

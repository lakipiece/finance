import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Scale factor: 180/32 = 5.625 (mirrors icon.svg design exactly)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: 'flex', background: '#1e293b' }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* F: vertical stem */}
          <rect x="34" y="34" width="17" height="112" rx="8" fill="white"/>
          {/* F: top bar */}
          <rect x="34" y="34" width="84" height="17" rx="8" fill="white"/>
          {/* F: middle bar */}
          <rect x="34" y="73" width="56" height="17" rx="8" fill="white"/>
          {/* green bottom accent */}
          <rect x="34" y="124" width="28" height="23" rx="8" fill="#00695C"/>
          {/* pink diagonal arrow line */}
          <line x1="68" y1="146" x2="141" y2="39" stroke="#C2185B" strokeWidth="14" strokeLinecap="round"/>
          {/* arrowhead */}
          <polyline points="107,39 141,39 141,73" stroke="#C2185B" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
    ),
    { ...size }
  )
}

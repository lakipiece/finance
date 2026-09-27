/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['xlsx'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // 옛 경로 — 북마크·홈 화면 바로가기 호환 (쿼리스트링은 자동 유지)
  async redirects() {
    return [
      { source: '/admin', destination: '/settings', permanent: true },
      { source: '/portfolio/settings', destination: '/settings', permanent: true },
      { source: '/portfolio/holdings', destination: '/portfolio/accounts', permanent: true },
      { source: '/expenses/input', destination: '/input', permanent: true },
      { source: '/incomes/input', destination: '/input', permanent: true },
      { source: '/income', destination: '/input', permanent: true },
      { source: '/monthly', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig

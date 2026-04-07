/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig

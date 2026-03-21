/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig

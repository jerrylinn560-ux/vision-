/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backend = process.env.VISION_API_URL ?? 'http://127.0.0.1:8000'
    return [{ source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` }]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://*.supabase.co; img-src 'self' data: blob: https:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ai-gateway.vercel.sh https://ai-gateway-api.vercel.sh",
          },
        ],
      },
    ]
  },
}

export default nextConfig

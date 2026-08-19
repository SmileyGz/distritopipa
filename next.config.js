/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/blog/01_smoke_shop_cancun_a_domicilio', destination: '/blog/smoke-shop-cancun-a-domicilio', permanent: true },
      { source: '/blog/02_guia_pipas_de_cristal_cancun', destination: '/blog/guia-pipas-de-cristal-cancun', permanent: true },
      { source: '/blog/03_smoke_shop_de_noche_cancun', destination: '/blog/smoke-shop-de-noche-cancun', permanent: true },
      { source: '/blog/04_comprar_pipas_vidrio_marketplaces_cancun', destination: '/blog/comprar-pipas-vidrio-marketplaces-cancun', permanent: true },
      { source: '/blog/05_como_funciona_anticipo_50_pesos', destination: '/blog/como-funciona-anticipo-50-pesos', permanent: true },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ]
  },
}

module.exports = nextConfig

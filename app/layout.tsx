import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Distrito Pipa — Cancún',
  description: 'Accesorios de uso personal en Cancún. Pipas de vidrio, grinders, bongs y más. Envío a domicilio.',
  keywords: ['pipas cancun', 'distrito pipa', 'accesorios fumar cancun', 'bongs cancun'],
  openGraph: {
    title: 'Distrito Pipa — Cancún',
    description: 'Accesorios de uso personal · Cancún · Envío a domicilio',
    url: 'https://distritopipa.com',
    siteName: 'Distrito Pipa',
    locale: 'es_MX',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

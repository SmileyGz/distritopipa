import type { Metadata } from 'next'
import { Inter, Bebas_Neue, Great_Vibes } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas' })
const vibes = Great_Vibes({ weight: '400', subsets: ['latin'], variable: '--font-vibes' })

export const metadata: Metadata = {
  metadataBase: new URL('https://distritopipa.com'),
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

export const viewport = {
  themeColor: '#0f0f0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

import AgeGate from '@/components/AgeGate'
import { Toaster } from 'react-hot-toast'
import LayoutWrapper from '@/components/LayoutWrapper'
import { CSPostHogProvider } from './providers'
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${bebas.variable} ${vibes.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        <CSPostHogProvider>
          <AgeGate>
            <LayoutWrapper>
              {children}
              {modal}
            </LayoutWrapper>
          </AgeGate>
          <Toaster position="bottom-center" toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid #333' } }} />
        </CSPostHogProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}


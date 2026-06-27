import { Metadata } from 'next'
import Shelf from '@/components/Shelf'

export const metadata: Metadata = {
  title: 'Menú · Distrito Pipa',
  description: 'Explora nuestro catálogo completo de accesorios de uso personal en Cancún.',
}

export default function MenuPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#111' }}>
      <Shelf language="es" />
    </main>
  )
}

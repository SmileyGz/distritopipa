import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Proveedores locales de accesorios Cancún | Distrito Pipa Mayoreo',
  description: 'Comprar pipas y accesorios por mayoreo en Cancún sin intermediarios. Conoce nuestros planes para Smoke Shops y revendedores con envíos locales. Márgenes desde 91%.',
  keywords: ['Proveedores locales de accesorios Cancún', 'Comprar pipas por mayoreo Cancún', 'Distribuidores de pipas Cancún', 'Negocio de reventa Cancún']
}

export default function MayoreoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

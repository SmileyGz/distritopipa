import { Metadata } from 'next'
import { Suspense } from 'react'
import Shelf from '@/components/Shelf'

import { getProducts, Product } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'Catálogo · Distrito Pipa',
  description: 'Explora nuestro catálogo completo de accesorios de uso personal en Cancún.',
}

export const revalidate = 60 // Revalidate every 60 seconds

export default async function MenuPage() {
  let products: Product[] = []
  try {
    products = await getProducts()
  } catch (err) {
    console.error('Error fetching products for SSR catalog', err)
  }

  return (
    <main className="menu-flyer-page">
      <div className="flyer-container">
        
        {/* Main Shelf Content */}
        <Suspense fallback={<div style={{ color: 'white', textAlign: 'center' }}>Cargando catálogo...</div>}>
          <Shelf language="es" initialProducts={products} />
        </Suspense>

        {/* Bottom Logistics Footer */}
        <div className="flyer-footer">
          <div className="footer-item">
            <span className="footer-icon">📍</span>
            <span className="footer-text"><strong>Recoger en persona:</strong> Región 96 (por Coppel y Soriana Nichupté)</span>
          </div>
          <div className="footer-item">
            <span className="footer-icon">🛵</span>
            <span className="footer-text"><strong>Envíos 1-6 km ($50):</strong> Se pide $50 de anticipo como GARANTÍA y cubre el servicio de envío, el producto se puede pagar en efectivo al recibir</span>
          </div>
        </div>
      </div>

      <style>{`
        .menu-flyer-page {
          min-height: 100vh;
          background-color: var(--bg);
          display: flex;
          justify-content: center;
          padding: 20px 20px 60px 20px;
        }

        .flyer-container {
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .flyer-footer {
          background: var(--surface-1);
          color: var(--text-primary);
          padding: 30px;
          border-radius: 12px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .footer-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-family: var(--font-inter), sans-serif;
          font-size: 14px;
          line-height: 1.5;
        }
        .footer-icon { font-size: 20px; }
        .footer-text strong { color: #DC143C; font-weight: 600; }
      `}</style>
    </main>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, getImageUrl, type Product } from '@/lib/supabase'
import { mockProducts } from '@/lib/mockProducts'
import ProductCard from './ProductCard'
import ProductDetail from './ProductDetail'
import { AnimatePresence } from 'framer-motion'

const CATEGORIES = [
  { id: 'all',         title: 'Todo el Catálogo' },
  { id: 'pipes',       title: 'Pipas y Burbujas' },
  { id: 'bongs',       title: 'Bongs' },
  { id: 'rolling',     title: 'Para Forjar' },
  { id: 'accessories', title: 'Accesorios' },
  { id: 'torches',     title: 'Sopletes' },
  { id: 'parts',       title: 'Repuestos' },
]

export default function Shelf({ language = 'es', initialProducts = [] }: { language?: 'es' | 'en', initialProducts?: Product[] }) {
  const searchParams = useSearchParams()
  const initialCategory = searchParams.get('category') || 'all'

  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [loading, setLoading]   = useState(initialProducts.length === 0)
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    // If the URL param changes, update local state
    const cat = searchParams.get('category')
    if (cat && CATEGORIES.some(c => c.id === cat)) {
      setActiveCategory(cat)
    }
  }, [searchParams])

  useEffect(() => {
    if (initialProducts.length === 0) {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
        const stored = localStorage.getItem('dp_mock_products')
        if (stored) {
          setProducts(JSON.parse(stored))
        } else {
          setProducts(mockProducts)
        }
        setLoading(false)
      } else {
        supabase.from('products').select('*').order('category').order('sort_order')
          .then(({ data, error }) => {
            if (error) {
              console.error('Supabase fetch failed, falling back to mock data:', error)
              const stored = localStorage.getItem('dp_mock_products')
              if (stored) {
                setProducts(JSON.parse(stored))
              } else {
                setProducts(mockProducts)
              }
              setLoading(false)
              return
            }
            if (data && data.length > 0) {
              setProducts(data as Product[])
            } else {
              const stored = localStorage.getItem('dp_mock_products')
              if (stored) {
                setProducts(JSON.parse(stored))
              } else {
                setProducts(mockProducts)
              }
            }
            setLoading(false)
          })
      }
    }

    const channel = supabase.channel('products-shelf')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setProducts(ps => ps.map(p => p.id === (payload.new as Product).id ? payload.new as Product : p))
        }
        if (payload.eventType === 'INSERT') {
          setProducts(ps => [...ps, payload.new as Product].sort((a, b) => a.sort_order - b.sort_order))
        }
        if (payload.eventType === 'DELETE') {
          setProducts(ps => ps.filter(p => p.id !== (payload.old as Product).id))
        }
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const displayedProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => p.category === activeCategory)

  if (loading) {
    return (
      <div className="shelf-loading">
        <div className="loading-pulse" />
        <div className="loading-pulse" style={{ width: '60%' }} />
        <style>{`
          .shelf-loading { padding: 48px 20px; display: flex; flex-direction: column; gap: 16px; width: 100%; }
          .loading-pulse { height: 140px; background: var(--surface-1); border-radius: 12px; animation: pulse 1.5s ease-in-out infinite; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    )
  }

  return (
    <div className="catalog-container">
      {/* Category Chips */}
      <div className="category-scroll">
        <div className="category-chips">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`chip ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="product-grid">
        {displayedProducts.length > 0 ? (
          displayedProducts.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              language={language}
              imageUrl={p.image_paths?.[0] ? getImageUrl(p.image_paths[0]) : null}
              onClick={() => setSelectedProduct(p)}
            />
          ))
        ) : (
          <div className="empty-state">No hay productos en esta categoría por el momento.</div>
        )}
      </div>

      {/* Modal Drawer */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            language={language}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>

      <style>{`
        .catalog-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }

        .category-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 8px; /* space for scrollbar */
        }
        
        .category-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .category-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .category-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }

        .category-chips {
          display: flex;
          gap: 12px;
          width: max-content;
        }

        .chip {
          background: var(--surface-1);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 20px;
          font-family: var(--font-inter), sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chip:hover {
          color: var(--text-primary);
          border-color: #666;
        }

        .chip.active {
          background: #DC143C;
          color: #fff;
          border-color: #DC143C;
          box-shadow: 0 4px 10px rgba(220, 20, 60, 0.3);
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 24px 16px;
          justify-items: center;
        }

        @media (min-width: 640px) {
          .product-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 32px 24px;
          }
        }

        .empty-state {
          grid-column: 1 / -1;
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
          font-family: var(--font-inter), sans-serif;
        }
      `}</style>
    </div>
  )
}

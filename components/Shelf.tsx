'use client'
// components/Shelf.tsx — Supabase edition (no Sanity)
// ─────────────────────────────────────────────────────────────
// Reads products from Supabase, groups by category, renders shelf.
// ProductCard and ProductDetail are unchanged from previous version.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase, getImageUrl, type Product } from '@/lib/supabase'
import ProductCard from './ProductCard'
import ProductDetail from './ProductDetail'

const CATEGORIES = [
  { id: 'pipes',       label_es: 'Pipes · Burbujas de vidrio',  order: 1 },
  { id: 'accessories', label_es: 'Accessories · Accesorios',    order: 2 },
  { id: 'rolling',     label_es: 'Rolling · Para armar',        order: 3 },
  { id: 'torches',     label_es: 'Torches · Sopletes',          order: 4 },
  { id: 'bongs',       label_es: 'Bongs · Agua',                order: 5 },
  { id: 'parts',       label_es: 'Parts · Repuestos',           order: 6 },
]

export default function Shelf({ language = 'es' }: { language?: 'es' | 'en' }) {
  const [products, setProducts]           = useState<Product[]>([])
  const [loading, setLoading]             = useState(true)
  const [selectedProduct, setSelected]    = useState<Product | null>(null)

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('category')
      .order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) setProducts(data as Product[])
        setLoading(false)
      })

    // Real-time updates: if you toggle stock in admin, shelf updates live
    const channel = supabase
      .channel('products-shelf')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setProducts(ps =>
            ps.map(p => p.id === (payload.new as Product).id ? payload.new as Product : p)
          )
        }
        if (payload.eventType === 'INSERT') {
          setProducts(ps => [...ps, payload.new as Product].sort((a, b) => a.sort_order - b.sort_order))
        }
        if (payload.eventType === 'DELETE') {
          setProducts(ps => ps.filter(p => p.id !== (payload.old as Product).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = products.filter(p => p.category === cat.id)
    return acc
  }, {} as Record<string, Product[]>)

  const visible = CATEGORIES.filter(c => grouped[c.id]?.length > 0)

  if (loading) {
    return (
      <div className="shelf-loading">
        <div className="loading-pulse" />
        <div className="loading-pulse" style={{ width: '60%' }} />
        <div className="loading-pulse" style={{ width: '80%' }} />
        <style>{`
          .shelf-loading { padding: 48px 20px; display: flex; flex-direction: column; gap: 16px; }
          .loading-pulse {
            height: 140px; background: #1a1a1a; border-radius: 8px;
            animation: pulse 1.5s ease-in-out infinite;
          }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <div className="shelf-wrap">
        <header className="shelf-header">
          <p className="shelf-eyebrow">Explora el estante</p>
          <h1 className="shelf-title">Accesorios premium</h1>
          <p className="shelf-sub">Selecciona, reserva y recibe en casa</p>
        </header>

        {visible.map(cat => (
          <section key={cat.id} className="shelf-row">
            <div className="row-label">
              <span className="label-text">
                {language === 'es' ? cat.label_es : cat.label_es}
              </span>
              <span className="label-line" />
            </div>

            <div className="row-scroll">
              <div className="row-track">
                {grouped[cat.id].map((p, i) => (
                  <motion.div
                    key={p.id}
                    className="card-wrap"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <ProductCard
                      product={p}
                      language={language}
                      imageUrl={p.image_paths?.[0] ? getImageUrl(p.image_paths[0]) : null}
                      onClick={() => setSelected(p)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            language={language}
            imageUrls={(selectedProduct.image_paths || []).map(getImageUrl)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <style>{`
        .shelf-wrap { max-width: 1280px; margin: 0 auto; background: #111; }
        .shelf-header { padding: 48px 20px 32px; border-bottom: 1px solid #2a2a2a; }
        .shelf-eyebrow { font-size: 11px; letter-spacing: .15em; color: #888; text-transform: uppercase; margin-bottom: 8px; }
        .shelf-title { font-size: clamp(28px,5vw,42px); font-weight: 600; color: #fff; margin-bottom: 12px; }
        .shelf-sub { font-size: 15px; color: #888; line-height: 1.6; }
        .shelf-row { padding: 32px 20px; border-bottom: 1px solid #1a1a1a; }
        .row-label { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .label-text { font-family: Georgia,serif; font-style: italic; font-size: 14px; color: #fff; white-space: nowrap; }
        .label-line { flex: 1; height: 1px; background: linear-gradient(to right, #CC2222, transparent); }
        .row-scroll { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; padding-bottom: 8px; }
        .row-scroll::-webkit-scrollbar { height: 5px; }
        .row-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .row-track { display: flex; gap: 12px; min-width: min-content; }
        .card-wrap { flex-shrink: 0; width: 160px; }
        @media (min-width: 640px) { .card-wrap { width: 180px; } }
        @media (min-width: 900px) {
          .row-scroll { overflow-x: visible; }
          .row-track { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); }
          .card-wrap { width: auto; }
        }
      `}</style>
    </>
  )
}
